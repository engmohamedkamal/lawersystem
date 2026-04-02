import mongoose, { Types } from "mongoose"

export const COUPON_TYPES = ["percent", "fixed"] as const
export type CouponType = (typeof COUPON_TYPES)[number]

export interface ICoupon extends mongoose.Document {
    _id:          Types.ObjectId
    code:         string          
    type:         CouponType      
    value:        number          
    maxUses:      number          
    usedCount:    number
    plans:        Types.ObjectId[] 
    validFrom:    Date
    validUntil:   Date
    isActive:     boolean
    createdBy:    Types.ObjectId
    createdAt:    Date
    updatedAt:    Date
}

const CouponSchema = new mongoose.Schema<ICoupon>(
    {
        code:       { type: String, required: true, unique: true, uppercase: true, trim: true },
        type:       { type: String, enum: COUPON_TYPES, required: true },
        value:      { type: Number, required: true, min: 1 },
        maxUses:    { type: Number, default: -1 },
        usedCount:  { type: Number, default: 0 },
        plans:      [{ type: Types.ObjectId, ref: "Plan" }],
        validFrom:  { type: Date, required: true },
        validUntil: { type: Date, required: true },
        isActive:   { type: Boolean, default: true },
        createdBy:  { type: Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
)

CouponSchema.index({ code: 1 }, { unique: true })
CouponSchema.index({ isActive: 1, validUntil: 1 })

const CouponModel = mongoose.models.Coupon || mongoose.model<ICoupon>("Coupon", CouponSchema)
export default CouponModel