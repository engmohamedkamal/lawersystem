import { NextFunction, Request, Response } from "express";
import InvoiceModel from "../../DB/model/invoice.model";
import LegalCaseModel, { calcPaymentStatus } from "../../DB/model/LegalCase.model";
import { AppError } from "../../utils/classError";
import { CreateInvoiceType, CreateStandaloneInvoiceType, UpdateInvoiceType } from "./invoice.validation";
import SettingsModel from "../../DB/model/settings.model";
import { generateAllInvoicesPDF, generateInvoicePDF } from "../../utils/invoicepdf ";
import ClientModel from "../../DB/model/client.model";



const syncCaseFees = async (legalCaseId: string) => {
    const allInvoices = await InvoiceModel.find({
        legalCase:  legalCaseId,
        isDeleted:  false,
        isFromFees: true,
        status:     { $ne: "ملغية" },
    })

    const totalPaid = allInvoices.reduce((sum, inv) => sum + (inv.paidAmount ?? 0), 0)

    const legalCase = await LegalCaseModel.findById(legalCaseId)
    if (!legalCase) return

    const caseTotal     = legalCase.fees?.totalAmount ?? 0
    const paymentStatus = calcPaymentStatus(caseTotal, totalPaid)

    await LegalCaseModel.findByIdAndUpdate(legalCaseId, {
        $set: {
            "fees.paidAmount":    totalPaid,
            "fees.paymentStatus": paymentStatus,
        },
    })
}

const addExtraPayment = async (
    legalCaseId: string,
    clientId: string,
    invoiceId: string,
    amount: number,
    items: { description: string; amount: number }[],
    description: string,
    paymentMethod?: string,
) => {
    const paymentData = {
        amount,
        description,
        paymentMethod,
        paidAt:    new Date(),
        invoiceId,
    }

    await LegalCaseModel.findByIdAndUpdate(legalCaseId, {
        $push: { extraPayments: paymentData },
    })

    await ClientModel.findByIdAndUpdate(clientId, {
        $push: { extraPayments: { ...paymentData, legalCaseId } },
    })
}

const generateInvoiceNumber = async (): Promise<string> => {
    const year  = new Date().getFullYear()
    const count = await InvoiceModel.countDocuments()
    return `INV-${year}-${String(count + 1).padStart(4, "0")}`
}

const calcTotals = (
    items:      { amount: number }[] | undefined,
    discount:   number,
    tax:        number,
    paidAmount: number
) => {
    const subtotal  = items?.length? items.reduce((sum , i)=> sum+ (i.amount ?? 0),0) : paidAmount
    const discountAmount = (subtotal * discount) / 100
    const afterDiscount  = subtotal - discountAmount
    const taxAmount      = (afterDiscount * tax) / 100
    const total          = afterDiscount + taxAmount
    const remaining      = Math.max(total - paidAmount, 0)
    return { subtotal, total, remaining }
}

class invoiceService {
    constructor() {}

    createInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params as { id : string }
        const data: CreateInvoiceType = req.body

    
        if (!data.items?.length) throw new AppError("items are required", 400)

        const legalCase = await( LegalCaseModel as any).findOne({ _id: id, isDeleted: false })
            .populate("client", "fullName phone email address type")
        if (!legalCase) throw new AppError("case not found", 404)

        const clientId = typeof legalCase.client === "object"
            ? (legalCase.client as any)._id.toString()
            : legalCase.client.toString()

        const invoiceNumber = await generateInvoiceNumber()
        const discount  = data.discount   ?? 0
        const tax       = data.tax        ?? 0
        const paidAmount    = (data as any).paidAmount ?? 0
        const isFromFees    = (data as any).isFromFees ?? true
        const items         = data.items ?? []
        const { subtotal, total, remaining } = calcTotals(data.items, discount, tax, paidAmount)

        let status: "مسودة" | "مُصدرة" | "مدفوعة" = "مسودة"
        if (paidAmount >= total)  status = "مدفوعة"
        else if (paidAmount > 0)  status = "مُصدرة"

        const invoice = await InvoiceModel.create({
            invoiceNumber,
            legalCase:     id,
            client:        clientId,
            items:         data.items,
            subtotal,
            discount,
            tax,
            total,
            paidAmount,
            remaining,
            status,
            isFromFees,
            paymentMethod: data.paymentMethod,
            dueDate:       data.dueDate ? new Date(data.dueDate) : undefined,
            notes:         data.notes,
            createdBy:     req.user?.id,
        })

        if (paidAmount > 0) {
            if (isFromFees) {
                await syncCaseFees(id)
                 const updatedCase  = await LegalCaseModel.findById(id)
                const totalAmount  = updatedCase?.fees?.totalAmount ?? 0
                const totalPaid    = updatedCase?.fees?.paidAmount  ?? 0
                if (totalAmount > 0 && totalPaid > totalAmount) {
                    return res.status(201).json({
                        message: "Invoice created successfully",
                        warning: `المبلغ المدفوع (${totalPaid}) تجاوز إجمالي الأتعاب (${totalAmount})`,
                        invoice,
                    })
                }
            } else {
                await addExtraPayment(
                    id,
                    clientId,
                    invoice._id.toString(),
                    paidAmount,
                    items,
                     items.length ? items.map((i: any) => i.description).join(" / ") : `دفعة ${paidAmount}`,
                    data.paymentMethod,
                )
            }
        }

        return res.status(201).json({ message: "Invoice created successfully", invoice })
    }
    
    createStandaloneInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const data: CreateStandaloneInvoiceType = req.body

        const client = await ClientModel.findOne({ _id: data.clientId, isDeleted: false })
        if (!client) throw new AppError("client not found", 404)

        const invoiceNumber = await generateInvoiceNumber()
        const discount      = data.discount   ?? 0
        const tax           = data.tax        ?? 0
        const paidAmount    = data.paidAmount ?? 0
        const items         = data.items ?? []
        const { subtotal, total, remaining } = calcTotals(items, discount, tax, paidAmount)

        let status: "مسودة" | "مُصدرة" | "مدفوعة" = "مسودة"
        if (paidAmount >= total)  status = "مدفوعة"
        else if (paidAmount > 0)  status = "مُصدرة"

        const invoice = await InvoiceModel.create({
            invoiceNumber,
            client: data.clientId,
            legalCase: undefined,
            items ,
            subtotal,
            discount,
            tax,
            total,
            paidAmount,
            remaining,
            status,
            isFromFees:    false,
            paymentMethod: data.paymentMethod,
            dueDate:       data.dueDate ? new Date(data.dueDate) : undefined,
            notes:         data.notes,
            createdBy:     req.user?.id,
        })

        if (paidAmount > 0) {
            await ClientModel.findByIdAndUpdate(data.clientId, {
                $push: {
                    extraPayments: {
                        amount:        paidAmount,
                        description:  items.length ? items.map((i: any) => i.description).join(" / ") : `دفعة ${paidAmount}`,
                         items,
                        paymentMethod: data.paymentMethod,
                        paidAt:        new Date(),
                        invoiceId:     invoice._id,
                    },
                },
            })
        }

        return res.status(201).json({ message: "Invoice created successfully", invoice })
    }

    printInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params

        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status court city fees")
            .populate("createdBy", "UserName")

        if (!invoice) throw new AppError("invoice not found", 404)

        const settings = await SettingsModel.findOne()

        const pdfBuffer = await generateInvoicePDF(invoice, settings)

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition" , `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`)
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

    updateInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params as { invoiceId: string }
        const data: UpdateInvoiceType = req.body
 
        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
        if (!invoice) throw new AppError("invoice not found", 404)
 
        const items = data.items ?? invoice.items
        const discount = data.discount ?? invoice.discount
        const tax = data.tax ?? invoice.tax
        const paidAmount = data.paidAmount ?? invoice.paidAmount
 
        const { subtotal, total, remaining } = calcTotals(items, discount, tax, paidAmount)
 
        let status = data.status ?? invoice.status
        if (paidAmount >= total)  status = "مدفوعة"
        else if (paidAmount > 0)  status = "مُصدرة"
        else                      status = "مسودة"
 
        const updated = await InvoiceModel.findByIdAndUpdate(
            invoiceId,
            {
                $set: {
                    ...data,
                    items,
                    subtotal,
                    total,
                    paidAmount,
                    remaining,
                    status,
                    dueDate: data.dueDate ? new Date(data.dueDate) : invoice.dueDate,
                },
            },
            { new: true }
        )
 
        if (invoice.legalCase) {
 
            if (invoice.isFromFees) {
                await syncCaseFees(invoice.legalCase.toString())
 
                const updatedCase = await LegalCaseModel.findById(invoice.legalCase)
                const totalAmount = updatedCase?.fees?.totalAmount ?? 0
                const totalPaid   = updatedCase?.fees?.paidAmount  ?? 0
                if (totalAmount > 0 && totalPaid > totalAmount) {
                    return res.status(200).json({
                        message: "Invoice updated successfully",
                        warning: `المبلغ المدفوع (${totalPaid}) تجاوز إجمالي الأتعاب (${totalAmount})`,
                        invoice: updated,
                    })
                }
            }
 
            
            if (!invoice.isFromFees && paidAmount > 0) {
                const clientId = typeof invoice.client === "object"
                    ? (invoice.client as any)._id.toString()
                    : invoice.client.toString()
 
                await LegalCaseModel.findByIdAndUpdate(invoice.legalCase.toString(), {
                    $pull: { extraPayments: { invoiceId: invoice._id } }
                })
                await ClientModel.findByIdAndUpdate(clientId, {
                    $pull: { extraPayments: { invoiceId: invoice._id } }
                })
 
                await addExtraPayment(
                    invoice.legalCase.toString(),
                    clientId,
                    invoice._id.toString(),
                    paidAmount,
                    items.map((i: any) => i.description).join(" / "),
                    data.paymentMethod ?? invoice.paymentMethod,
                )
            }
        }
 
        if (!invoice.legalCase && paidAmount > 0) {
            const clientId = typeof invoice.client === "object"
                ? (invoice.client as any)._id.toString()
                : invoice.client.toString()
 
            await ClientModel.findByIdAndUpdate(clientId, {
                $pull: { extraPayments: { invoiceId: invoice._id } }
            })
 
            await ClientModel.findByIdAndUpdate(clientId, {
                $push: {
                    extraPayments: {
                        amount:        paidAmount,
                        description:   items.map((i: any) => i.description).join(" / "),
                        paymentMethod: data.paymentMethod ?? invoice.paymentMethod,
                        paidAt:        new Date(),
                        invoiceId:     invoice._id,
                    }
                }
            })
        }
 
        return res.status(200).json({ message: "Invoice updated successfully", invoice: updated })
    }

    printAllClientInvoices = async (req: Request, res: Response, next: NextFunction) => {
        const { clientId } = req.params as { clientId: string }

        const invoices = await InvoiceModel.find({ client: clientId, isDeleted: false, status: { $ne: "ملغية" } })
            .populate("client",    "fullName phone email address type")
            .populate("legalCase", "caseNumber status court city fees")
            .sort({ createdAt: -1 })

        if (!invoices.length) throw new AppError("no invoices found for this client", 404)

        const settings   = await SettingsModel.findOne()
        const pdfBuffer  = await generateAllInvoicesPDF(invoices, settings)

        res.setHeader("Content-Type",        "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="invoices-${clientId}.pdf"`)
        return res.send(pdfBuffer)
    }

    deleteInvoice = async (req: Request, res: Response, next: NextFunction) => {
        const { invoiceId } = req.params as { invoiceId: string }
 
        const invoice = await InvoiceModel.findOne({ _id: invoiceId, isDeleted: false })
        if (!invoice) throw new AppError("invoice not found", 404)
 
        await InvoiceModel.findByIdAndUpdate(invoiceId, { isDeleted: true })
 
        return res.status(200).json({ message: "Invoice deleted successfully" })
    }

    
}

export default new invoiceService()