import CouponModel from "../../DB/model/SaaSModels/Coupon.model"
import { AppError } from "../../utils/classError"


const buildFeaturesFromPlan  = (plan : any) : Record<string , any> =>{
    const features : Record<string , any> = {} 
    plan.features.forEach((f:any)=>{
        //o(1)
        features[f.key] = f.defaultValue
    })
    return features
}

const calcEndDate = (interval: "monthly" | "yearly", fromDate?: Date): Date => {
    const end = fromDate ? new Date(fromDate) : new Date()
    if (interval === "yearly") { end.setFullYear(end.getFullYear() + 1) }
    else { end.setMonth(end.getMonth() + 1) }
    return end
}

const applyDiscount = async (
    originalAmount: number,
    couponCode:     string | undefined,
    planId:         string
): Promise<{ discountAmount: number; couponDoc: any }> => {
    if (!couponCode) return { discountAmount: 0, couponDoc: null }
 
    const now = new Date()
    const couponDoc = await CouponModel.findOne({
        code:       couponCode.toUpperCase(),
        isActive:   true,
        validFrom:  { $lte: now },
        validUntil: { $gte: now },
    })
 
    if (!couponDoc) throw new AppError("كوبون غير صالح أو منتهي الصلاحية", 400)
    if (couponDoc.maxUses !== -1 && couponDoc.usedCount >= couponDoc.maxUses) {
        throw new AppError("تم استنفاد عدد استخدامات الكوبون", 400)
    }
    if (couponDoc.plans.length > 0 && !couponDoc.plans.some((p: any) => p.toString() === planId)) {
        throw new AppError("الكوبون غير صالح لهذه الخطة", 400)
    }
 
    const discountAmount = couponDoc.type === "percent"
        ? Math.round((originalAmount * couponDoc.value) / 100)
        : Math.min(couponDoc.value, originalAmount)
 
    return { discountAmount, couponDoc }
}

class SubscriptionService {

    
}

export default new SubscriptionService()