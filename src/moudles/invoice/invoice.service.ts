import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import InvoiceModel from "../../DB/model/invoice.model";
import LegalCaseModel, { calcPaymentStatus } from "../../DB/model/LegalCase.model";
import { AppError } from "../../utils/classError";
import { CreateInvoiceType, CreateStandaloneInvoiceType, UpdateInvoiceType } from "./invoice.validation";
import SettingsModel from "../../DB/model/settings.model";
import ClientModel from "../../DB/model/client.model";
import { generateAllInvoicesPDF, generateInvoicePDF } from "../../utils/invoicepdf ";
import { assertFeatureEnabled } from "../../helpers/planFeature.helper";
import { PLAN_FEATURES } from "../SASS/constants/planFeatures";
import OfficeModel from "../../DB/model/SaaSModels/Office.model";




const generateInvoiceNumber = async (officeId: string | Types.ObjectId): Promise<string> => {
    const year  = new Date().getFullYear()
    const count = await InvoiceModel.countDocuments({ officeId })
    return `INV-${year}-${String(count + 1).padStart(4, "0")}`
}

const resolveClientId = (val: any): string =>
    typeof val === "object" ? val._id.toString() : val.toString()

const getCaseFeesPaidFromInvoices = async (
    legalCaseId: string,
    excludeInvoiceId?: Types.ObjectId
): Promise<number> => {
    const query: any = {
        legalCase:  legalCaseId,
        isDeleted:  false,
        isFromFees: true,
        status:     { $ne: "ملغية" },
    }
    if (excludeInvoiceId) query._id = { $ne: excludeInvoiceId }
    const invoices = await InvoiceModel.find(query).select("paidAmount")
    return invoices.reduce((sum, inv) => sum + (inv.paidAmount ?? 0), 0)
}


const calcTotals = (
    items:      { amount: number }[] | undefined,
    discount:   number,
    tax:        number,
    paidAmount: number
) => {
    const itemsTotal    = items?.reduce((sum, i) => sum + (i.amount ?? 0), 0) ?? 0
    const subtotal      = itemsTotal > 0 ? itemsTotal : paidAmount
    const discountAmt   = (subtotal * discount) / 100
    const afterDiscount = subtotal - discountAmt
    const taxAmt        = (afterDiscount * tax) / 100
    const total         = afterDiscount + taxAmt
    const remaining     = Math.max(total - paidAmount, 0)
    return { subtotal, total, remaining }
}

const resolveInvoiceStatus = (paidAmount: number, total: number , dueDate : Date | undefined) => {
    if (total <= 0)              return "مسودة"
    if (paidAmount >= total)     return "مدفوعة"
    if (dueDate && dueDate < new Date() && paidAmount < total) return "متأخرة"
    if (paidAmount > 0)          return "مُصدرة"
    return "مسودة"
}

const buildPaymentDescription = (
    items:      { description: string; amount: number }[],
    paidAmount: number
) => items.length ? items.map(i => i.description).join(" / ") : `دفعة ${paidAmount}`

const parseOptionalDate = (value?: string, fallback?: Date): Date | undefined => {
    if (!value) return fallback
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) throw new AppError("invalid due date", 400)
    return d
}

const syncCaseFees = async (legalCaseId: string) => {
    const allInvoices = await InvoiceModel.find({
        legalCase:  legalCaseId,
        isDeleted:  false,
        isFromFees: true,
        status:     { $ne: "ملغية" },
    })
    const totalPaid     = allInvoices.reduce((sum, inv) => sum + (inv.paidAmount ?? 0), 0)
    const legalCase     = await LegalCaseModel.findById(legalCaseId)
    if (!legalCase) return
    const caseTotal     = legalCase.fees?.totalAmount ?? 0
    const paymentStatus = calcPaymentStatus(caseTotal, totalPaid)
    await LegalCaseModel.findByIdAndUpdate(legalCaseId, {
        $set: { "fees.paidAmount": totalPaid, "fees.paymentStatus": paymentStatus },
    }, { new: true })
}


const addExtraPayment = async (
    legalCaseId:    string,
    clientId:       string,
    invoiceId:      Types.ObjectId,   
    amount:         number,
    items:          { description: string; amount: number }[],
    description:    string,
    paymentMethod?: string,
) => {
    const paymentData = { amount, description, paymentMethod, paidAt: new Date(), invoiceId }
    await LegalCaseModel.findByIdAndUpdate(legalCaseId, {
        $push: { extraPayments: { ...paymentData, items } }
    }, { new: true })
    await ClientModel.findByIdAndUpdate(clientId, {
        $push: { extraPayments: { ...paymentData, items, legalCaseId } }
    }, { new: true })
}

const removeExtraPayment = async (
    legalCaseId: string | null,
    clientId:    string,
    invoiceId:   Types.ObjectId,   
) => {
    if (legalCaseId) {
        await LegalCaseModel.findByIdAndUpdate(legalCaseId, {
            $pull: { extraPayments: { invoiceId } }
        }, { new: true })
    }
    await ClientModel.findByIdAndUpdate(clientId, {
        $pull: { extraPayments: { invoiceId } }
    }, { new: true })
}


class invoiceService {
    constructor() {}

    createInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params as { id?: string }
        const data: CreateInvoiceType & { legalCase?: string; caseId?: string } = req.body

        const caseId = id || data.legalCase || data.caseId
        if (!caseId) {
            throw new AppError("يجب تحديد القضية", 400)
        }

        const legalCase = await (LegalCaseModel as any)
            .findOne({ _id: caseId, isDeleted: false, officeId: req.user?.officeId })
            .populate("client", "fullName phone email address type")
        if (!legalCase) throw new AppError("case not found", 404)

        const office = await OfficeModel.findById(req.user?.officeId);
        if (!office) {
            throw new AppError("office not found", 404);
        }
        assertFeatureEnabled(office, PLAN_FEATURES.INVOICE_ENABLED)

        const clientId   = resolveClientId(legalCase.client)
        const discount   = data.discount   ?? 0
        const tax        = data.tax        ?? 0
        const paidAmount = data.paidAmount ?? 0
        const isFromFees = data.isFromFees ?? true
        const items      = data.items ?? []
        const dueDateP = data.dueDate ? new Date(data.dueDate) : undefined

        if (!isFromFees && !items.length) {
            throw new AppError("فاتورة إضافية على القضية تتطلب items", 400)
        }

        const { subtotal, total, remaining } = calcTotals(
            items.length ? items : undefined,
            discount, tax, paidAmount
        )

        if (total <= 0 && paidAmount > 0) {
            throw new AppError("إجمالي الفاتورة يجب أن يكون أكبر من صفر", 400)
        }

        if (isFromFees && paidAmount > 0) {
            const caseTotal    = legalCase.fees?.totalAmount ?? 0
            const existingPaid = await getCaseFeesPaidFromInvoices(caseId)
            if (caseTotal > 0 && existingPaid + paidAmount > caseTotal) {
                throw new AppError(
                    `المبلغ المدفوع (${existingPaid + paidAmount}) سيتجاوز إجمالي الأتعاب (${caseTotal})`,
                    400
                )
            }
        }

        const invoiceNumber = await generateInvoiceNumber(req.user?.officeId as any)
        const status        = resolveInvoiceStatus(paidAmount, total , dueDateP )

        const invoice = await InvoiceModel.create({
            invoiceNumber,
            legalCase:     caseId,
            client:        clientId,
            items,
            subtotal,
            discount,
            tax,
            total,
            paidAmount,
            remaining,
            status,
            isFromFees,
            paymentMethod: data.paymentMethod,
            dueDate:       parseOptionalDate(data.dueDate),
            notes:         data.notes,
            createdBy:     req.user?.id,
            officeId:      req.user?.officeId,
        })

        if (paidAmount > 0) {
            if (isFromFees) {
                await syncCaseFees(caseId)
            } else {
                await addExtraPayment(
                    caseId, clientId, invoice._id,
                    paidAmount, items,
                    buildPaymentDescription(items, paidAmount),
                    data.paymentMethod
                )
            }
        }

        return res.status(201).json({ message: "Invoice created successfully", invoice })
    }

    createStandaloneInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const data: CreateStandaloneInvoiceType = req.body

        const client = await ClientModel.findOne({ _id: data.clientId, isDeleted: false, officeId: req.user?.officeId })
        if (!client) throw new AppError("client not found", 404)

        const office = await OfficeModel.findById(req.user?.officeId);
        if (!office) {
            throw new AppError("office not found", 404);
        }
        assertFeatureEnabled(office, PLAN_FEATURES.INVOICE_ENABLED)

        const discount   = data.discount   ?? 0
        const tax        = data.tax        ?? 0
        const paidAmount = data.paidAmount ?? 0
        const items      = data.items ?? []
        const dueDateP = data.dueDate ? new Date(data.dueDate) : undefined

        if (!items.length) throw new AppError("items are required", 400)

        const { subtotal, total, remaining } = calcTotals(items, discount, tax, paidAmount)

        if (total <= 0 && paidAmount > 0) {
            throw new AppError("إجمالي الفاتورة يجب أن يكون أكبر من صفر", 400)
        }

        if (paidAmount > total) {
            throw new AppError(
                `المبلغ المدفوع (${paidAmount}) لا يمكن أن يتجاوز إجمالي الفاتورة (${total})`,400)
        }

        const invoiceNumber = await generateInvoiceNumber(req.user?.officeId as any)
        const status        = resolveInvoiceStatus(paidAmount, total , dueDateP)

        const invoice = await InvoiceModel.create({
            invoiceNumber,
            client:        data.clientId,
            legalCase:     undefined,
            items,
            subtotal,
            discount,
            tax,
            total,
            paidAmount,
            remaining,
            status,
            isFromFees:    false,
            paymentMethod: data.paymentMethod,
            dueDate:       parseOptionalDate(data.dueDate),
            notes:         data.notes,
            createdBy:     req.user?.id,
            officeId:      req.user?.officeId,
        })

        if (paidAmount > 0) {
            await ClientModel.findByIdAndUpdate(data.clientId, {
                $push: {
                    extraPayments: {
                        amount:        paidAmount,
                        description:   buildPaymentDescription(items, paidAmount),
                        items,
                        paymentMethod: data.paymentMethod,
                        paidAt:        new Date(),
                        invoiceId:     invoice._id,
                    },
                },
            }, { new: true })
        }

        return res.status(201).json({ message: "Invoice created successfully", invoice })
    }

    updateInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params as { invoiceId: string }
        const data: UpdateInvoiceType = req.body

        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false, officeId: req.user?.officeId })
        if (!invoice) throw new AppError("invoice not found", 404)

        if (invoice.status === "ملغية") {
            throw new AppError("cannot update a cancelled invoice", 400)
        }

        const items      = data.items      ?? invoice.items
        const discount   = data.discount   ?? invoice.discount
        const tax        = data.tax        ?? invoice.tax
        const paidAmount = data.paidAmount ?? invoice.paidAmount


        if (!items.length) throw new AppError("items are required", 400)

        const { subtotal, total, remaining } = calcTotals(
            items.length ? items : undefined,
            discount, tax, paidAmount
        )

        if (total <= 0 && paidAmount > 0) {
            throw new AppError("إجمالي الفاتورة يجب أن يكون أكبر من صفر", 400)
        }

        if (invoice.isFromFees && invoice.legalCase && paidAmount > 0) {
            const legalCase    = await LegalCaseModel.findById(invoice.legalCase)
            const caseTotal    = legalCase?.fees?.totalAmount ?? 0
            const existingPaid = await getCaseFeesPaidFromInvoices(
                invoice.legalCase.toString(),
                invoice._id   
            )
            if (caseTotal > 0 && existingPaid + paidAmount > caseTotal) {
                throw new AppError(
                    `المبلغ المدفوع (${existingPaid + paidAmount}) سيتجاوز إجمالي الأتعاب (${caseTotal})`,
                    400
                )
            }
        }

        const parsedDueDate = data.dueDate ? new Date(data.dueDate) : invoice.dueDate
        const status = resolveInvoiceStatus(paidAmount, total , parsedDueDate)

        const updated = await InvoiceModel.findByIdAndUpdate(
            invoiceId,
            {
                $set: {
                    items, subtotal, discount, tax, total, paidAmount, remaining, status,
                    paymentMethod: data.paymentMethod ?? invoice.paymentMethod,
                    dueDate:       parseOptionalDate(data.dueDate, invoice.dueDate),
                    notes:         data.notes ?? invoice.notes,
                },
            },
            { new: true }
        )

        const clientId = resolveClientId(invoice.client)

        if (invoice.legalCase) {
            if (invoice.isFromFees) {
                await syncCaseFees(invoice.legalCase.toString())
            } else {
                await removeExtraPayment(invoice.legalCase.toString(), clientId, invoice._id)
                if (paidAmount > 0) {
                    await addExtraPayment(
                        invoice.legalCase.toString(),
                        clientId,
                        invoice._id,
                        paidAmount,
                        items,
                        buildPaymentDescription(items, paidAmount),
                        data.paymentMethod ?? invoice.paymentMethod,
                    )
                }
            }
        } else {
            await removeExtraPayment(null, clientId, invoice._id)
            if (paidAmount > 0) {
                await ClientModel.findByIdAndUpdate(clientId, {
                    $push: {
                        extraPayments: {
                            amount:        paidAmount,
                            description:   buildPaymentDescription(items, paidAmount),
                            items,
                            paymentMethod: data.paymentMethod ?? invoice.paymentMethod,
                            paidAt:        new Date(),
                            invoiceId:     invoice._id,
                        }
                    }
                }, { new: true })
            }
        }

        return res.status(200).json({ message: "Invoice updated successfully", invoice: updated })
    }

    deleteInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params as { invoiceId: string }

        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false, officeId: req.user?.officeId })
        if (!invoice) throw new AppError("invoice not found", 404)

        if (invoice.status === "ملغية") {
            throw new AppError("cancelled invoice cannot be deleted", 400)
        }

        const clientId = resolveClientId(invoice.client)

        await InvoiceModel.findByIdAndUpdate(invoiceId, { isDeleted: true }, { new: true })

        if (invoice.isFromFees && invoice.legalCase) {
            await syncCaseFees(invoice.legalCase.toString())
        } else {
            await removeExtraPayment(
                invoice.legalCase ? invoice.legalCase.toString() : null,
                clientId,
                invoice._id
            )
        }

        return res.status(200).json({ message: "Invoice deleted successfully" })
    }

    printInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params
        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false, officeId: req.user?.officeId })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status court city fees")
            .populate("createdBy", "UserName")
        if (!invoice) throw new AppError("invoice not found", 404)
        const settings  = await SettingsModel.findOne({ officeId: req.user?.officeId })
        const pdfBuffer = await generateInvoicePDF(invoice, settings)
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`)
        return res.send(pdfBuffer)
    }

    getCaseInvoices = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const invoices = await InvoiceModel.find({ legalCase: id, isDeleted: false, officeId: req.user?.officeId })
            .populate("client", "fullName phone")
            .sort({ createdAt: -1 })
        return res.status(200).json({ message: "success", invoices })
    }

    getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params
        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false, officeId: req.user?.officeId })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status")
            .populate("createdBy", "UserName")
        if (!invoice) throw new AppError("invoice not found", 404)
        return res.status(200).json({ message: "success", invoice })
    }

    printAllClientInvoices = async (req: Request, res: Response, next: NextFunction) => {
        const { clientId } = req.params as { clientId: string }
        const invoices = await InvoiceModel.find({
            client: clientId, isDeleted: false, officeId: req.user?.officeId, status: { $ne: "ملغية" }
        })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status court city fees")
            .sort({ createdAt: -1 })
        if (!invoices.length) throw new AppError("no invoices found for this client", 404)
        const settings  = await SettingsModel.findOne({ officeId: req.user?.officeId })
        const pdfBuffer = await generateAllInvoicesPDF(invoices, settings)
        res.setHeader("Content-Type",        "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="invoices-${clientId}.pdf"`)
        return res.send(pdfBuffer)
    }

    getAllInvoices = async (req: Request, res: Response, next: NextFunction) => {
        const { status, isFromFees, client, search, page = "1", limit = "10" } = req.query
 
        const now = new Date()
 
        const filter: Record<string, any> = { isDeleted: false, officeId: req.user?.officeId }
        if (status)     filter.status     = status
        if (isFromFees !== undefined) filter.isFromFees = isFromFees === "true"
        if (client)     filter.client     = client
        if (search) {
            filter.invoiceNumber = { $regex: search, $options: "i" }
        }
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
        const skip     = (pageNum - 1) * limitNum
 
        const [invoices, total, statsResult] = await Promise.all([
            InvoiceModel.find(filter)
                .populate("client",    "fullName phone type")
                .populate("legalCase", "caseNumber status")
                .populate("createdBy", "UserName")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            InvoiceModel.countDocuments(filter),
            InvoiceModel.aggregate([
                { $match: { isDeleted: false, officeId: req.user?.officeId, status: { $ne: "ملغية" } } },
                {
                    $group: {
                        _id:              null,
                        totalRevenue:     { $sum: "$paidAmount" },
                        totalUnpaid:      { $sum: "$remaining" },
                        totalInvoices:    { $sum: 1 },
                    }
                }
            ]),
        ])
 
        const overdueCount = await InvoiceModel.countDocuments({
            isDeleted: false,
            officeId:  req.user?.officeId,
            status:    { $nin: ["مدفوعة", "ملغية"] },
            dueDate:   { $lt: now },
            remaining: { $gt: 0 },
        })
 
        const overdueAmount = await InvoiceModel.aggregate([
            {
                $match: {
                    isDeleted: false,
                    officeId:  req.user?.officeId,
                    status:    { $nin: ["مدفوعة", "ملغية"] },
                    dueDate:   { $lt: now },
                    remaining: { $gt: 0 },
                }
            },
            { $group: { _id: null, total: { $sum: "$remaining" } } },
        ])
 
        const stats = statsResult[0] ?? { totalRevenue: 0, totalUnpaid: 0, totalInvoices: 0 }
 
        return res.status(200).json({
            message: "success",
            stats: {
                totalRevenue:   stats.totalRevenue,  
                totalUnpaid:    stats.totalUnpaid,    
                overdueAmount:  overdueAmount[0]?.total ?? 0,  
                overdueCount,
            },
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            invoices,
        })
    }

}

export default new invoiceService()