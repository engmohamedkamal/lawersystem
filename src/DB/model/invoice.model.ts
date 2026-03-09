import mongoose, { Types } from "mongoose"

export const INVOICE_STATUSES = ["مسودة", "مُصدرة", "مدفوعة", "ملغية"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export interface IInvoiceItem {
    description: string
    amount:      number
}

export interface IInvoice extends mongoose.Document {
    _id:           Types.ObjectId
    invoiceNumber: string
    legalCase:     Types.ObjectId
    client:        Types.ObjectId
    items:         IInvoiceItem[]
    subtotal:      number
    discount:      number
    tax:           number
    total:         number
    paidAmount:    number
    remaining:     number
    paymentMethod?: string
    status:        InvoiceStatus
    issueDate:     Date
    dueDate?:      Date
    notes?:        string
    isDeleted:     boolean
    isFromFees:    boolean
    createdBy:     Types.ObjectId
}

const InvoiceItemSchema = new mongoose.Schema<IInvoiceItem>(
    {
        description: { type: String, required: true, trim: true },
        amount:      { type: Number, required: true, min: 0 },
    },
    { _id: false }
)

const InvoiceSchema = new mongoose.Schema<IInvoice>(
    {
        invoiceNumber: { type: String, required: true, unique: true, trim: true },
        legalCase:     { type: Types.ObjectId, ref: "LegalCase", required: true },
        client:        { type: Types.ObjectId, ref: "Client",    required: true },
        items:         { type: [InvoiceItemSchema], default: [] },
        subtotal:      { type: Number, default: 0 },
        discount:      { type: Number, default: 0 },
        tax:           { type: Number, default: 0 },
        total:         { type: Number, default: 0 },
        paidAmount:    { type: Number, default: 0 },
        remaining:     { type: Number, default: 0 },
        paymentMethod: { type: String, trim: true },
        status:        { type: String, enum: INVOICE_STATUSES, default: "مسودة" },
        issueDate:     { type: Date, default: Date.now },
        dueDate:       { type: Date },
        notes:         { type: String, trim: true, maxLength: 1000 },
        isDeleted:     { type: Boolean, default: false },
        isFromFees:    { type: Boolean, default: true },
        createdBy:     { type: Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
)

InvoiceSchema.index({ legalCase: 1 })
InvoiceSchema.index({ client: 1 })
InvoiceSchema.index({ status: 1 })

const InvoiceModel = mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema)
export default InvoiceModel