import mongoose, { Types } from "mongoose"

export const SUBSCRIPTION_STATUSES = ["active", "suspended", "cancelled", "expired"] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export interface ISubscription {
    planId?:    Types.ObjectId   
    planSlug?:  string
    status:     SubscriptionStatus
    startDate:  Date
    endDate:    Date
    billingInterval?: "monthly" | "yearly"

    paymobOrderId?:       string
    paymobTransactionId?: string
    lastPaymentAt?:       Date
    lastPaymentAmount?:   number
    autoRenew:             boolean
    paymobCardToken?:      string
    cardLastFour?:         string
    cardBrand?:            string
}

export interface IOfficeFeatures {
    [key: string]: number | boolean | string 
}

export interface IOffice extends mongoose.Document {
    _id:          Types.ObjectId
    name:         string
    email:        string
    phone:        string
    address?:     string
    logo?:        string
    logoPublicId?: string
    subdomain:    string          
    subscription: ISubscription
    features:     IOfficeFeatures 
    isActive:     boolean
    storageUsedBytes: number
    createdAt:    Date
    updatedAt:    Date
}

const SubscriptionSchema = new mongoose.Schema<ISubscription>(
    {
        planId:              { type: Types.ObjectId, ref: "Plan" },
        planSlug:            { type: String },
        status:              { type: String, enum: SUBSCRIPTION_STATUSES },
        startDate:           { type: Date, default: Date.now },
        endDate:             { type: Date, required: true },
        billingInterval:     { type: String, enum: ["monthly", "yearly"] },
        paymobOrderId:       { type: String },
        paymobTransactionId: { type: String },
        lastPaymentAt:       { type: Date },
        lastPaymentAmount:   { type: Number },
        autoRenew:            { type: Boolean, default: false },
        paymobCardToken:      { type: String, select: false },
        cardLastFour:         { type: String },
        cardBrand:            { type: String },
    },
    { _id: false }
)

const OfficeSchema = new mongoose.Schema<IOffice>(
    {
        name:         { type: String, required: true, trim: true, maxlength: 200 },
        email:        { type: String, required: true, unique: true, trim: true },
        phone:        { type: String, required: true, trim: true },
        address:      { type: String, trim: true },
        logo:         { type: String },
        logoPublicId: { type: String },
        subdomain:    { type: String, required: true, unique: true, lowercase: true, trim: true },
        subscription: { type: SubscriptionSchema, default: () => ({}) },
        features:     { type: mongoose.Schema.Types.Mixed, default: {} },
        isActive:     { type: Boolean, default: true },
        storageUsedBytes: { type: Number, default: 0 },
    },
    { timestamps: true }
)

OfficeSchema.index({ email: 1 },    { unique: true })
OfficeSchema.index({ subdomain: 1 }, { unique: true })
OfficeSchema.index({ "subscription.status":  1 })
OfficeSchema.index({ "subscription.endDate": 1 })

const OfficeModel = mongoose.models.Office || mongoose.model<IOffice>("Office", OfficeSchema)
export default OfficeModel