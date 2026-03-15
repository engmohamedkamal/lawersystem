import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import InvoiceModel from "../../DB/model/invoice.model";
import LegalCaseModel, { calcPaymentStatus } from "../../DB/model/LegalCase.model";
import { AppError } from "../../utils/classError";
import { CreateInvoiceType, CreateStandaloneInvoiceType, UpdateInvoiceType } from "./invoice.validation";
import SettingsModel from "../../DB/model/settings.model";
import ClientModel from "../../DB/model/client.model";
import { generateAllInvoicesPDF, generateInvoicePDF } from "../../utils/invoicepdf ";




const generateInvoiceNumber = async (): Promise<string> => {
    const year  = new Date().getFullYear()
    const count = await InvoiceModel.countDocuments()
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

const resolveInvoiceStatus = (paidAmount: number, total: number) => {
    if (total <= 0)              return "مسودة"
    if (paidAmount >= total)     return "مدفوعة"
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
        const { id } = req.params as { id: string }
        const data: CreateInvoiceType = req.body

        const legalCase = await (LegalCaseModel as any)
            .findOne({ _id: id, isDeleted: false })
            .populate("client", "fullName phone email address type")
        if (!legalCase) throw new AppError("case not found", 404)

        const clientId   = resolveClientId(legalCase.client)
        const discount   = data.discount   ?? 0
        const tax        = data.tax        ?? 0
        const paidAmount = data.paidAmount ?? 0
        const isFromFees = data.isFromFees ?? true
        const items      = data.items ?? []

        if (!isFromFees && !items.length) {
            throw new AppError("فاتورة إضافية على القضية تتطلب items", 400)
        }

        const { subtotal, total, remaining } = calcTotals(
            items.length ? items : undefined,
            discount, tax, paidAmount
        )

        // guard: prevent zero-total invoice with payment
        if (total <= 0 && paidAmount > 0) {
            throw new AppError("إجمالي الفاتورة يجب أن يكون أكبر من صفر", 400)
        }

        // guard: prevent overpayment on fees invoices — uses real invoice data not cached fees.paidAmount
        if (isFromFees && paidAmount > 0) {
            const caseTotal    = legalCase.fees?.totalAmount ?? 0
            const existingPaid = await getCaseFeesPaidFromInvoices(id)
            if (caseTotal > 0 && existingPaid + paidAmount > caseTotal) {
                throw new AppError(
                    `المبلغ المدفوع (${existingPaid + paidAmount}) سيتجاوز إجمالي الأتعاب (${caseTotal})`,
                    400
                )
            }
        }

        const invoiceNumber = await generateInvoiceNumber()
        const status        = resolveInvoiceStatus(paidAmount, total)

        const invoice = await InvoiceModel.create({
            invoiceNumber,
            legalCase:     id,
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
        })

        if (paidAmount > 0) {
            if (isFromFees) {
                await syncCaseFees(id)
            } else {
                await addExtraPayment(
                    id, clientId, invoice._id,
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

        const client = await ClientModel.findOne({ _id: data.clientId, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        const discount   = data.discount   ?? 0
        const tax        = data.tax        ?? 0
        const paidAmount = data.paidAmount ?? 0
        const items      = data.items ?? []

        // guard: standalone invoice must have items
        if (!items.length) throw new AppError("items are required", 400)

        const { subtotal, total, remaining } = calcTotals(items, discount, tax, paidAmount)

        if (total <= 0 && paidAmount > 0) {
            throw new AppError("إجمالي الفاتورة يجب أن يكون أكبر من صفر", 400)
        }

        const invoiceNumber = await generateInvoiceNumber()
        const status        = resolveInvoiceStatus(paidAmount, total)

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

        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
        if (!invoice) throw new AppError("invoice not found", 404)

        // guard: prevent update on cancelled invoice
        if (invoice.status === "ملغية") {
            throw new AppError("cannot update a cancelled invoice", 400)
        }

        const items      = data.items      ?? invoice.items
        const discount   = data.discount   ?? invoice.discount
        const tax        = data.tax        ?? invoice.tax
        const paidAmount = data.paidAmount ?? invoice.paidAmount

        // guard: prevent clearing items on existing invoice
        if (!items.length) throw new AppError("items are required", 400)

        const { subtotal, total, remaining } = calcTotals(
            items.length ? items : undefined,
            discount, tax, paidAmount
        )

        if (total <= 0 && paidAmount > 0) {
            throw new AppError("إجمالي الفاتورة يجب أن يكون أكبر من صفر", 400)
        }

        // guard: prevent overpayment in fees invoices — excludes current invoice from sum
        if (invoice.isFromFees && invoice.legalCase && paidAmount > 0) {
            const legalCase    = await LegalCaseModel.findById(invoice.legalCase)
            const caseTotal    = legalCase?.fees?.totalAmount ?? 0
            const existingPaid = await getCaseFeesPaidFromInvoices(
                invoice.legalCase.toString(),
                invoice._id   // exclude current invoice
            )
            if (caseTotal > 0 && existingPaid + paidAmount > caseTotal) {
                throw new AppError(
                    `المبلغ المدفوع (${existingPaid + paidAmount}) سيتجاوز إجمالي الأتعاب (${caseTotal})`,
                    400
                )
            }
        }

        const status = resolveInvoiceStatus(paidAmount, total)

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
                // حذف الأثر القديم دائمًا ثم إضافة الجديد لو paidAmount > 0
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
            // standalone invoice — حذف الأثر القديم ثم إضافة الجديد لو paidAmount > 0
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

        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
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
        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status court city fees")
            .populate("createdBy", "UserName")
        if (!invoice) throw new AppError("invoice not found", 404)
        const settings  = await SettingsModel.findOne()
        const pdfBuffer = await generateInvoicePDF(invoice, settings)
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`)
        return res.send(pdfBuffer)
    }

    getCaseInvoices = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params
        const invoices = await InvoiceModel.find({ legalCase: id, isDeleted: false })
            .populate("client", "fullName phone")
            .sort({ createdAt: -1 })
        return res.status(200).json({ message: "success", invoices })
    }

    getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params
        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status")
            .populate("createdBy", "UserName")
        if (!invoice) throw new AppError("invoice not found", 404)
        return res.status(200).json({ message: "success", invoice })
    }

    printAllClientInvoices = async (req: Request, res: Response, next: NextFunction) => {
        const { clientId } = req.params as { clientId: string }
        const invoices = await InvoiceModel.find({
            client: clientId, isDeleted: false, status: { $ne: "ملغية" }
        })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status court city fees")
            .sort({ createdAt: -1 })
        if (!invoices.length) throw new AppError("no invoices found for this client", 404)
        const settings  = await SettingsModel.findOne()
        const pdfBuffer = await generateAllInvoicesPDF(invoices, settings)
        res.setHeader("Content-Type",        "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="invoices-${clientId}.pdf"`)
        return res.send(pdfBuffer)
    }
}

export default new invoiceService()