import { NextFunction, Request, Response } from "express"
import bcrypt from "bcrypt"
import UserModel, { Role } from "../../../DB/model/user.model"
import { AppError } from "../../../utils/classError"
import CouponModel from "../../../DB/model/SaaSModels/Coupon.model"
import PlanModel from "../../../DB/model/SaaSModels/Plan.model"
import OfficeModel from "../../../DB/model/SaaSModels/Office.model"
import PaymentModel from "../../../DB/model/SaaSModels/Payment.model"
import { createPaymobPaymentLink, PaymentMethod, verifyPaymobHmac } from "../payment/Paymob.service"

// ─── helpers ──────────────────────────────────────────────────────────────────
const buildFeaturesFromPlan = (plan: any): Record<string, any> => {
    const features: Record<string, any> = {}
    plan.features.forEach((f: any) => { features[f.key] = f.defaultValue })
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
    couponCode: string | undefined,
    planId: string
): Promise<{ discountAmount: number; couponDoc: any }> => {
    if (!couponCode) return { discountAmount: 0, couponDoc: null }

    const now = new Date()
    const couponDoc = await CouponModel.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: now },
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
    constructor() { }

    // ── الخطط للصفحة العامة (بدون auth) ──────────────────────────────────────
    getPublicPlans = async (req: Request, res: Response, next: NextFunction) => {
        const plans = await PlanModel.find({ isActive: true })
            .sort({ sortOrder: 1 })
            .select("-__v")
            .lean()

        return res.status(200).json({ message: "success", plans })
    }

    // ── تسجيل مكتب جديد ──────────────────────────────────────────────────────
    // NOTE: بيانات المكتب (الاسم، الشعار، العنوان) بتتحط من Settings بعد الدخول
    // هنا بس بنعمل subdomain + admin user + رابط دفع
    registerOffice = async (req: Request, res: Response, next: NextFunction) => {
        const {
            subdomain,
            // بيانات الأدمن — نفس بيانات الـ User model
            email, password, phone, UserName,
            planId, billingInterval = "monthly",
            couponCode, saveCard = false,
            paymentMethod = "card",
        } = req.body

        // تحقق من التكرار
        const [existingSubdomain, existingUser] = await Promise.all([
            OfficeModel.findOne({ subdomain: subdomain.toLowerCase() }),
            UserModel.findOne({ email }),
        ])
        if (existingSubdomain) throw new AppError("الـ subdomain مستخدم بالفعل", 409)
        if (existingUser) throw new AppError("البريد الإلكتروني مستخدم بالفعل", 409)

        // alias للاستخدام في بقية الكود
        const adminEmail = email
        const adminPhone = phone

        const plan = await PlanModel.findOne({ _id: planId, isActive: true })
        if (!plan) throw new AppError("الخطة غير موجودة", 404)

        // حساب المبلغ
        let originalAmount = billingInterval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice

        // تطبيق عرض الخطة
        if (plan.offer?.isActive) {
            const offerValid = !plan.offer.validUntil || plan.offer.validUntil >= new Date()
            if (offerValid) {
                originalAmount = Math.round(originalAmount * (1 - plan.offer.discountPercent / 100))
            }
        }

        const { discountAmount, couponDoc } = await applyDiscount(originalAmount, couponCode, planId)
        const finalAmount = Math.max(originalAmount - discountAmount, 0)
        const features = buildFeaturesFromPlan(plan)

        // إنشاء المكتب — غير نشط لحد ما يكمل الدفع
        const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 1) // endDate مؤقتة

        const office = await OfficeModel.create({
            name: UserName,            // مؤقت — يتغير من Settings
            email: adminEmail,
            phone: String(adminPhone),
            subdomain: subdomain.toLowerCase(),
            subscription: {
                planId: plan._id,
                planSlug: plan.slug,
                status: "active",
                startDate: new Date(),
                endDate: trialEnd,   // هيتحدث بعد الدفع من الـ webhook
                billingInterval,
                autoRenew: saveCard,
            },
            features,
            isActive: false,   // غير نشط لحد ما يدفع
        })

        // إنشاء الـ Admin الأول
        const hashedPassword = await bcrypt.hash(password, 10)
        const admin = await UserModel.create({
            UserName: UserName,
            email: adminEmail,
            password: hashedPassword,
            phone: adminPhone,
            role: Role.ADMIN,
            officeId: office._id,
            employmentDate: new Date(),
        })

        // إنشاء Payment record
        const payment = await PaymentModel.create({
            office: office._id,
            plan: plan._id,
            billingInterval,
            paymentMethod,
            amount: finalAmount,
            originalAmount,
            discountAmount,
            coupon: couponDoc?._id,
            status: "pending",
            planSnapshot: {
                name: plan.name,
                monthlyPrice: plan.monthlyPrice,
                yearlyPrice: plan.yearlyPrice,
                features: plan.features,
            },
        })

        // إنشاء رابط دفع
        const { iframeUrl, orderId, paymentKey } = await createPaymobPaymentLink({
            amountEGP: finalAmount,
            merchantOrderId: payment._id.toString(),
            method: paymentMethod as PaymentMethod,
            saveCard: paymentMethod === "card" ? saveCard : false,
            billingData: {
                email: email,
                first_name: UserName.split(" ")[0] ?? UserName,
                last_name: UserName.split(" ")[1] ?? ".",
                phone_number: String(phone),
            },
        })

        await PaymentModel.findByIdAndUpdate(payment._id, {
            $set: { paymobOrderId: orderId, paymobPaymentKey: paymentKey, paymobIframeUrl: iframeUrl }
        })

        return res.status(201).json({
            message: "تم إنشاء الحساب — أكمل عملية الدفع لتفعيل الاشتراك",
            officeId: office._id,
            subdomain: office.subdomain,
            adminId: admin._id,
            paymentId: payment._id,
            iframeUrl,
            amount: finalAmount,
            originalAmount,
            discountAmount,
        })
    }

    // ── Webhook باي موب ────────────────────────────────────────────────────────
    paymobWebhook = async (req: Request, res: Response, next: NextFunction) => {
        
        const receivedHmac = String(req.query.hmac ?? "")
        const isValid = verifyPaymobHmac(req.body ,receivedHmac )
        if (!isValid) return res.status(400).json({ message: "invalid hmac" })

        const obj = req.body.obj ?? req.body
        const success = obj.success
        const orderId = obj.order?.id?.toString() ?? obj.order?.toString()
        const transactionId = obj.id?.toString()
        const cardToken = obj.source_data?.token
        const cardLastFour = obj.source_data?.pan
        const cardBrand = obj.source_data?.sub_type

        const payment = await PaymentModel.findOne({ paymobOrderId: orderId })
        if (!payment) return res.status(200).json({ message: "skipped" })

        if (success) {
            await PaymentModel.findByIdAndUpdate(payment._id, {
                $set: { status: "success", paymobTransactionId: transactionId, paidAt: new Date() }
            })

            const plan = await PlanModel.findById(payment.plan)
            if (plan) {
                const office = await OfficeModel.findById(payment.office)
                    .select("+subscription.paymobCardToken")
                if (!office) return res.status(200).json({ message: "office not found" })

                // التجديد يبدأ من بعد الـ endDate الحالي لو لسه active
                const fromDate = office.subscription.status === "active" && office.subscription.endDate > new Date()
                    ? office.subscription.endDate
                    : new Date()

                const endDate = calcEndDate(payment.billingInterval, fromDate)
                const features = buildFeaturesFromPlan(plan)

                const updateData: any = {
                    "subscription.planId": plan._id,
                    "subscription.planSlug": plan.slug,
                    "subscription.status": "active",
                    "subscription.startDate": new Date(),
                    "subscription.endDate": endDate,
                    "subscription.billingInterval": payment.billingInterval,
                    "subscription.paymobTransactionId": transactionId,
                    "subscription.lastPaymentAt": new Date(),
                    "subscription.lastPaymentAmount": payment.amount,
                    features,
                    isActive: true,
                }

                // حفظ card token للتجديد التلقائي
                if (cardToken) {
                    updateData["subscription.paymobCardToken"] = cardToken
                    updateData["subscription.cardLastFour"] = cardLastFour
                    updateData["subscription.cardBrand"] = cardBrand
                    updateData["subscription.autoRenew"] = true
                }

                await OfficeModel.findByIdAndUpdate(payment.office, { $set: updateData })

                if (payment.coupon) {
                    await CouponModel.findByIdAndUpdate(payment.coupon, { $inc: { usedCount: 1 } })
                }
            }
        } else {
            await PaymentModel.findByIdAndUpdate(payment._id, {
                $set: { status: "failed", failureReason: obj.data?.message ?? "payment failed" }
            })
        }

        return res.status(200).json({ message: "webhook processed" })
    }

    // ── التحقق من كوبون ───────────────────────────────────────────────────────
    validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
        const { code, planId } = req.body
        const now = new Date()

        const coupon = await CouponModel.findOne({
            code: code.toUpperCase(),
            isActive: true,
            validFrom: { $lte: now },
            validUntil: { $gte: now },
        })

        if (!coupon) throw new AppError("كوبون غير صالح أو منتهي الصلاحية", 400)
        if (coupon.maxUses !== -1 && coupon.usedCount >= coupon.maxUses) {
            throw new AppError("تم استنفاد عدد استخدامات الكوبون", 400)
        }
        if (coupon.plans.length > 0 && !coupon.plans.some((p: any) => p.toString() === planId)) {
            throw new AppError("الكوبون غير صالح لهذه الخطة", 400)
        }

        return res.status(200).json({
            message: "كوبون صالح",
            coupon: { code: coupon.code, type: coupon.type, value: coupon.value },
        })
    }


}

export default new SubscriptionService()