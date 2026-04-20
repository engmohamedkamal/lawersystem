import mongoose, { Types } from "mongoose"

export interface IPlanFeature {
    key:          string 
    label:        string
    valueType:    "number" | "boolean"
    defaultValue: number | boolean 
    visible:      boolean           
}

export interface IPlanOffer {
    label:           string
    discountPercent: number
    validUntil?:     Date | undefined
    isActive:        boolean
    applyTo?: "monthly" | "yearly" | "both"
}

export interface IPlan extends mongoose.Document {
    _id:          Types.ObjectId
    name:         string
    slug:         string
    description?: string | undefined
    monthlyPrice: number
    yearlyPrice:  number
    currency:     string
    features:     IPlanFeature[]
    offer?:       IPlanOffer | undefined
    monthlyPriceAfterDiscount?: number | undefined
    yearlyPriceAfterDiscount?: number | undefined
    isActive:     boolean
    isPopular:    boolean
    sortOrder:    number
    createdAt:    Date
    updatedAt:    Date
}

const PlanFeatureSchema = new mongoose.Schema<IPlanFeature>(
    {
        key:          { type: String, required: true },
        label:        { type: String, required: true },
        valueType:    { type: String, enum: ["number", "boolean"], required: true },
        defaultValue: { type: mongoose.Schema.Types.Mixed, required: true },
        visible:      { type: Boolean, default: true },
    },
    { _id: false }
)

const PlanOfferSchema = new mongoose.Schema<IPlanOffer>(
    {
        label:           { type: String,  required: true },
        discountPercent: { type: Number,  required: true, min: 1, max: 100 },
        validUntil:      { type: Date },
        isActive:        { type: Boolean, default: true },
        applyTo:         { type: String, enum: ["monthly", "yearly", "both"], default: "both",}
    },
    { _id: false }
)

const PlanSchema = new mongoose.Schema<IPlan>(
    {
        name:         { type: String, required: true, trim: true },
        slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
        description:  { type: String, trim: true },
        monthlyPrice: { type: Number, required: true, min: 0 },
        yearlyPrice:  { type: Number, required: true, min: 0 },
        currency:     { type: String, default: "EGP" },
        features:     { type: [PlanFeatureSchema], default: [] },
        offer:        { type: PlanOfferSchema },
        monthlyPriceAfterDiscount: { type: Number },
        yearlyPriceAfterDiscount: { type: Number },
        isActive:     { type: Boolean, default: true },
        isPopular:    { type: Boolean, default: false },
        sortOrder:    { type: Number,  default: 0 },
    },
    { timestamps: true }
)

PlanSchema.index({ isActive: 1, sortOrder: 1 })

const PlanModel = (mongoose.models.Plan as mongoose.Model<IPlan>) || mongoose.model<IPlan>("Plan", PlanSchema)
export default PlanModel