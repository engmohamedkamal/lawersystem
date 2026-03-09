import { NextFunction, Request, Response } from "express";
import InvoiceModel from "../../DB/model/invoice.model";
import LegalCaseModel, { calcPaymentStatus } from "../../DB/model/LegalCase.model";
import { AppError } from "../../utils/classError";
import { CreateInvoiceType } from "./invoice.validation";
import SettingsModel from "../../DB/model/settings.model";
import { generateInvoicePDF } from "../../utils/invoicepdf ";
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
    clientId:    string,
    invoiceId:   string,
    amount:      number,
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

    // أضف في القضية
    await LegalCaseModel.findByIdAndUpdate(legalCaseId, {
        $push: { extraPayments: paymentData },
    })

    // أضف في العميل
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
    items:      { amount: number }[],
    discount:   number,
    tax:        number,
    paidAmount: number
) => {
    const subtotal  = items.reduce((sum, i) => sum + i.amount, 0)
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

        const legalCase = await LegalCaseModel.findOne({ _id: id, isDeleted: false })
            .populate("client", "fullName phone email address type")
        if (!legalCase) throw new AppError("case not found", 404)

        // استخراج الـ clientId صح سواء populated أو لأ
        const clientId = typeof legalCase.client === "object"
            ? (legalCase.client as any)._id.toString()
            : legalCase.client.toString()

        const invoiceNumber = await generateInvoiceNumber()
        const discount      = data.discount   ?? 0
        const tax           = data.tax        ?? 0
        const paidAmount    = (data as any).paidAmount ?? 0
        const isFromFees    = (data as any).isFromFees ?? true
        const { subtotal, total, remaining } = calcTotals(data.items, discount, tax, paidAmount)

        // تحديد الحالة بناءً على المدفوع
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
            } else {
                await addExtraPayment(
                    id,
                    clientId,
                    invoice._id.toString(),
                    paidAmount,
                    data.items.map((i: any) => i.description).join(" / "),
                    data.paymentMethod,
                )
            }
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

        res.setHeader("Content-Type",        "application/pdf")
        res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`)
        return res.send(pdfBuffer)
    }





}

export default new invoiceService()