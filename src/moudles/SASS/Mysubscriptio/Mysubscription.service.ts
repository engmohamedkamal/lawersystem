import { NextFunction, Request, Response } from "express"
import { AppError } from "../../../utils/classError"
import OfficeModel from "../../../DB/model/SaaSModels/Office.model"
import { createPaymobPaymentLink, getAvailablePaymentMethods, PaymentMethod } from "../payment/Paymob.service"
import PlanModel from "../../../DB/model/SaaSModels/Plan.model"
import CouponModel from "../../../DB/model/SaaSModels/Coupon.model"
import PaymentModel from "../../../DB/model/SaaSModels/Payment.model"

class MySubscriptionService {
    constructor() { }

    getMySubscription = async (req: Request, res: Response, next: NextFunction) => {
        const officeId = (req.user as any)?.officeId
        if (!officeId) throw new AppError("office not found", 404)

        const office = await OfficeModel.findById(officeId)
            .populate("subscription.planId", "name slug monthlyPrice yearlyPrice features offer isPopular")
            
        if (!office) throw new AppError("office not found", 404)

        const now = new Date()
        const endDate = new Date(office.subscription.endDate)
        const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        const plan = office.subscription.planId as any

        return res.status(200).json({
            message: "success",
            subscription: {
                status: office.subscription.status,
                planName: plan?.name ?? office.subscription.planSlug,
                planSlug: office.subscription.planSlug,
                billingInterval: office.subscription.billingInterval,
                startDate: office.subscription.startDate,
                endDate: office.subscription.endDate,
                daysLeft,

                autoRenew: office.subscription.autoRenew,
                savedCard: office.subscription.cardLastFour ? {
                    lastFour: office.subscription.cardLastFour,
                    brand: office.subscription.cardBrand,
                } : null,
                lastPaymentAt: office.subscription.lastPaymentAt,
                lastPaymentAmount: office.subscription.lastPaymentAmount,
            },
            features: office.features,
            planDetails: plan ? {
                name: plan.name,
                monthlyPrice: plan.monthlyPrice,
                yearlyPrice: plan.yearlyPrice,
                features: plan.features,
                offer: plan.offer,
            } : null,
        })
    }

    getPaymentMethods = async (req: Request, res: Response, next: NextFunction) => {
        const methods = getAvailablePaymentMethods()
        return res.status(200).json({ message: "success", methods })
    }

    getAvailablePlans = async (req: Request, res: Response, next: NextFunction) => {
        const officeId = (req.user as any)?.officeId
        const office   = await OfficeModel.findById(officeId).select("subscription")
        if (!office) throw new AppError("office not found", 404)
 
        const plans = await PlanModel.find({ isActive: true }).sort({ sortOrder: 1 })
 
        const result = plans.map(plan => ({
            ...plan.toObject(),
            isCurrent: plan._id.toString() === office.subscription.planId?.toString(),
        }))
 
        return res.status(200).json({ message: "success", plans: result })
    }

    initiateRenewal = async (req: Request, res: Response, next: NextFunction) => {
        const officeId = (req.user as any)?.officeId
        const {
            planId,
            billingInterval = "monthly",
            paymentMethod   = "card" as PaymentMethod,
            walletPhone,
            couponCode,
            saveCard = false,
            phone,
        } = req.body
 
        const [office, plan] = await Promise.all([
            OfficeModel.findById(officeId),
            PlanModel.findOne({ _id: planId, isActive: true }),
        ])
        if (!office) throw new AppError("office not found", 404)
        if (!plan)   throw new AppError("plan not found", 404)
 
        const availableMethods = getAvailablePaymentMethods()
        const selectedMethod   = availableMethods.find(m => m.method === paymentMethod)
        if (!selectedMethod?.available) {
            throw new AppError(`طريقة الدفع ${paymentMethod} غير متاحة حالياً`, 400)
        }
 
        if (paymentMethod === "wallet" && !walletPhone && !phone && !office.phone) {
            throw new AppError("رقم التليفون أو رقم المحفظة مطلوب للدفع بالمحفظة الإلكترونية", 400)
        }
 
        let originalAmount = billingInterval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice
 
        if (plan.offer?.isActive) {
            const offerValid = !plan.offer.validUntil || plan.offer.validUntil >= new Date()
            if (offerValid) {
                originalAmount = Math.round(originalAmount * (1 - plan.offer.discountPercent / 100))
            }
        }
 
        let discountAmount = 0
        let couponDoc: any = null
 
        if (couponCode) {
            const now = new Date()
            couponDoc = await CouponModel.findOne({
                code: couponCode.toUpperCase(), isActive: true,
                validFrom: { $lte: now }, validUntil: { $gte: now },
            })
            if (!couponDoc) throw new AppError("كوبون غير صالح", 400)
            if (couponDoc.plans.length > 0 && !couponDoc.plans.some((p: any) => p.toString() === planId)) {
                throw new AppError("الكوبون غير صالح لهذه الخطة", 400)
            }
            discountAmount = couponDoc.type === "percent"
                ? Math.round((originalAmount * couponDoc.value) / 100)
                : Math.min(couponDoc.value, originalAmount)
        }
 
        const finalAmount = Math.max(originalAmount - discountAmount, 0)
 
        const payment = await PaymentModel.create({
            office: officeId, plan: plan._id, billingInterval,
            paymentMethod,
            amount: finalAmount, originalAmount, discountAmount,
            coupon: couponDoc?._id, status: "pending",
            planSnapshot: {
                name: plan.name, monthlyPrice: plan.monthlyPrice,
                yearlyPrice: plan.yearlyPrice, features: plan.features,
            },
        })
 
        const paymobResult = await createPaymobPaymentLink({
            amountEGP:       finalAmount,
            merchantOrderId: payment._id.toString(),
            method:          paymentMethod as PaymentMethod,
            saveCard:        paymentMethod === "card" ? saveCard : false,
            phone:           paymentMethod === "wallet" && walletPhone ? String(walletPhone) : String(phone ?? office.phone),
            billingData: {
                email:        office.email,
                first_name:   office.name.split(" ")[0] ?? office.name,
                last_name:    office.name.split(" ")[1] ?? ".",
                phone_number: String(phone ?? office.phone),
            },
        })
 
        await PaymentModel.findByIdAndUpdate(payment._id, {
            $set: {
                paymobOrderId: paymobResult.orderId,
                paymobPaymentKey: paymobResult.paymentKey,
                paymobIframeUrl: paymobResult.iframeUrl ?? paymobResult.redirectUrl,
            }
        })
 
        const paymentUrl = paymobResult.iframeUrl ?? paymobResult.redirectUrl

        return res.status(200).json({
            message:       "تم إنشاء رابط الدفع",
            paymentId:     payment._id,
            paymentUrl,
            paymentMethod,
            amount:        finalAmount,
            originalAmount,
            discountAmount,
            saving:        originalAmount - finalAmount,
        })
    }

    removeCard = async (req: Request, res: Response, next: NextFunction) => {
        const officeId = (req.user as any)?.officeId
 
        await OfficeModel.findByIdAndUpdate(officeId, {
            $set:   { "subscription.autoRenew": false },
            $unset: {
                "subscription.paymobCardToken": 1,
                "subscription.cardLastFour":    1,
                "subscription.cardBrand":       1,
            },
        })
 
        return res.status(200).json({ message: "تم إزالة الكارت وإلغاء التجديد التلقائي" })
    }
 
    getMyPayments = async (req: Request, res: Response, next: NextFunction) => {
        const officeId = (req.user as any)?.officeId
        const { page = "1", limit = "10" } = req.query
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 50)
 
        const [payments, total] = await Promise.all([
            PaymentModel.find({ office: officeId })
                .populate("plan",   "name slug")
                .populate("coupon", "code type value")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .select("-paymobPaymentKey"),
            PaymentModel.countDocuments({ office: officeId }),
        ])
 
        return res.status(200).json({
            message: "success",
            total,
            page:       pageNum,
            totalPages: Math.ceil(total / limitNum),
            payments,
        })
    }

}

export default new MySubscriptionService()