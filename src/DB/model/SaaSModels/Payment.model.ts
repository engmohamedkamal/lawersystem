import mongoose, { Types } from "mongoose"

export const PAYMENT_STATUSES  = ["pending", "success", "failed", "refunded"] as const
export const BILLING_INTERVALS = ["monthly", "yearly"] as const

export type PaymentStatus  = (typeof PAYMENT_STATUSES)[number]
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

export interface IPayment extends mongoose.Document {
    _id:              Types.ObjectId
    office:           Types.ObjectId
    plan:             Types.ObjectId
    billingInterval:  BillingInterval
    amount:           number          
    originalAmount:   number         
    currency:         string
    coupon?:          Types.ObjectId
    discountAmount:   number

    
    paymobOrderId?:       string
    paymobTransactionId?: string
    paymobPaymentKey?:    string
    paymobIframeUrl?:     string

    status:           PaymentStatus
    paidAt?:          Date
    failureReason?:   string

    
    planSnapshot: {
        name:         string
        monthlyPrice: number
        yearlyPrice:  number
        features:     any[]
    }

    createdAt:  Date
    updatedAt:  Date
}

const PaymentSchema = new mongoose.Schema<IPayment>(
    {
        office:          { type: Types.ObjectId, ref: "Office", required: true },
        plan:            { type: Types.ObjectId, ref: "Plan",   required: true },
        billingInterval: { type: String, enum: BILLING_INTERVALS, required: true },
        amount:          { type: Number, required: true },
        originalAmount:  { type: Number, required: true },
        currency:        { type: String, default: "EGP" },
        coupon:          { type: Types.ObjectId, ref: "Coupon" },
        discountAmount:  { type: Number, default: 0 },

        paymobOrderId:       { type: String },
        paymobTransactionId: { type: String },
        paymobPaymentKey:    { type: String },
        paymobIframeUrl:     { type: String },

        status:        { type: String, enum: PAYMENT_STATUSES, default: "pending" },
        paidAt:        { type: Date },
        failureReason: { type: String },

        planSnapshot: {
            name:         { type: String },
            monthlyPrice: { type: Number },
            yearlyPrice:  { type: Number },
            features:     { type: mongoose.Schema.Types.Mixed },
        },
    },
    { timestamps: true }
)

PaymentSchema.index({ office: 1, status: 1 })
PaymentSchema.index({ paymobOrderId: 1 })
PaymentSchema.index({ paymobTransactionId: 1 })
PaymentSchema.index({ status: 1, createdAt: -1 })

const PaymentModel = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema)
export default PaymentModel