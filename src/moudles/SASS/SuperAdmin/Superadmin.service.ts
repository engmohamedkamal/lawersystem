import { NextFunction, Request, Response } from "express";
import PlanModel from "../../../DB/model/SaaSModels/Plan.model";
import { AppError } from "../../../utils/classError";
import OfficeModel from "../../../DB/model/SaaSModels/Office.model";
import CouponModel from "../../../DB/model/SaaSModels/Coupon.model";
import PaymentModel from "../../../DB/model/SaaSModels/Payment.model";
import UserModel from "../../../DB/model/user.model";
import { sendEmail } from "../../../utils/SendEmail";
import { getIO } from "../../../utils/socket";
import { parseStorageSize } from "../../../utils/sizeConverter";
import { PLAN_FEATURES } from "../constants/planFeatures";
import { syncOfficeStorage } from "../../../jobs/syncStorage.cron";
import { buildCloudinaryBytesMap } from "../../../helpers/cloudinaryStorage.helper";
import UserModel_SA from "../../../DB/model/user.model";
import LegalCaseModel_SA from "../../../DB/model/LegalCase.model";
import SessionModel_SA from "../../../DB/model/session.model";
import TaskModel_SA from "../../../DB/model/tasks.model";
import ClientModel_SA from "../../../DB/model/client.model";
import SettingsModel_SA from "../../../DB/model/settings.model";
import LawModel_SA from "../../../DB/model/law.model";


const buildFeaturesFromPlan = (plan: any): Record<string, any> => {
    const features: Record<string, any> = {}
    plan.features.forEach((f: any) => { features[f.key] = f.defaultValue })
    return features
}

class SuperAdminService {

    //CRUD FOR PLANS

    createPlan = async (req: Request, res: Response, next: NextFunction) => {
        const { name, slug, description, monthlyPrice, yearlyPrice, features, isPopular, sortOrder } = req.body

        const existing = await PlanModel.findOne({ slug })
        if (existing) throw new AppError("plan slug already exists", 409)

        // Convert storage size if present
        if (features && Array.isArray(features)) {
            features.forEach(f => {
                if (f.key === PLAN_FEATURES.STORAGE_MAX) {
                    f.defaultValue = parseStorageSize(f.defaultValue);
                }
            });
        }

        const plan = await PlanModel.create({
            name, slug, description, monthlyPrice, yearlyPrice,
            features: features ?? [], isPopular, sortOrder,
        })

        return res.status(201).json({ message: "Plan created", plan })
    }

    getPlans = async (req: Request, res: Response, next: NextFunction) => {
        const plans = await PlanModel.find().sort({ sortOrder: 1 })
        return res.status(200).json({ message: "success", plans })
    }

    updatePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)

        // Convert storage size if present in features
        if (req.body.features && Array.isArray(req.body.features)) {
            req.body.features.forEach((f: any) => {
                if (f.key === PLAN_FEATURES.STORAGE_MAX) {
                    f.defaultValue = parseStorageSize(f.defaultValue);
                }
            });
        }

        Object.assign(plan, req.body)
        await plan.save()
        return res.status(200).json({ message: "Plan updated", plan })
    }

    freezePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.isActive = false
        await plan.save()
        return res.status(200).json({ message: "Plan deactivated" })
    }

    unfreezePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.isActive = true
        await plan.save()
        return res.status(200).json({ message: "Plan activated" })
    }

    deletePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        await plan.deleteOne()
        return res.status(200).json({ message: "Plan deleted" })
    }

    //CRUD FOR ONE FEATURE
    addFeatureForOnePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)

        if (req.body.key === PLAN_FEATURES.STORAGE_MAX) {
            req.body.defaultValue = parseStorageSize(req.body.defaultValue);
        }

        plan.features.push(req.body)
        await plan.save()
        return res.status(200).json({ message: "Feature added", plan })
    }

    removeFeatureFromOnePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId, key } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.features = plan.features.filter((f: any) => f.key !== key)
        await plan.save()
        return res.status(200).json({ message: "Feature removed", plan })
    }

    updateFeatureForOnePlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId, key } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)

        if (key === PLAN_FEATURES.STORAGE_MAX && req.body.defaultValue !== undefined) {
            req.body.defaultValue = parseStorageSize(req.body.defaultValue);
        }

        plan.features = plan.features.map((f: any) => f.key === key ? { ...f, ...req.body } : f)
        await plan.save()
        return res.status(200).json({ message: "Feature updated", plan })
    }

    //CRUD FOR MANY FEATURES
    addFeatureToAllPlans = async (req: Request, res: Response, next: NextFunction) => {
        const { key, label, valueType, defaultValue, unit, visible = true } = req.body

        const plans = await PlanModel.find()
        const offices = await OfficeModel.find()

        let plansUpdated = 0
        let officesUpdated = 0

        const finalDefaultValue = key === PLAN_FEATURES.STORAGE_MAX ? parseStorageSize(defaultValue) : defaultValue;

        for (const plan of plans) {
            if (!plan.features.some((f: any) => f.key === key)) {
                plan.features.push({ key, label, valueType, defaultValue: finalDefaultValue, visible })
                await plan.save()
                plansUpdated++
            }
        }

        for (const office of offices) {
            if ((office.features as any)[key] === undefined) {
                (office.features as any)[key] = finalDefaultValue
                office.markModified("features")
                await office.save()
                officesUpdated++
            }
        }

        return res.status(200).json({
            message: `Feature "${label}" added to all plans`,
            plansUpdated: plansUpdated,
            officesUpdated: officesUpdated,
        })
    }

    removeFeatureFromAllPlans = async (req: Request, res: Response, next: NextFunction) => {
        const { key } = req.body

        const plans = await PlanModel.find()
        for (const plan of plans) {
            plan.features = plan.features.filter((f: any) => f.key !== key)
            await plan.save()
        }

        const offices = await OfficeModel.find()
        for (const office of offices) {
            delete (office.features as any)[key]
            office.markModified("features")
            await office.save()
        }

        return res.status(200).json({ message: `Feature "${key}" removed from all plans` })
    }

    updateFeatureInAllPlans = async (req: Request, res: Response, next: NextFunction) => {
        const { key, label, valueType, defaultValue, unit, visible = true } = req.body

        const finalDefaultValue = key === PLAN_FEATURES.STORAGE_MAX ? parseStorageSize(defaultValue) : defaultValue;

        const plans = await PlanModel.find()
        for (const plan of plans) {
            plan.features = plan.features.map((f: any) => f.key === key ? { ...f, ...req.body, defaultValue: finalDefaultValue } : f)
            await plan.save()
        }

        const offices = await OfficeModel.find()
        for (const office of offices) {
            if ((office.features as any)[key] !== undefined) {
                (office.features as any)[key] = finalDefaultValue
                office.markModified("features")
                await office.save()
            }
        }

        return res.status(200).json({ message: `Feature "${key}" updated in all plans` })
    }

    //CRUD FOR PLAN OFFER
    setPlanOffer = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const { label, discountPercent, validUntil, isActive, applyTo = "both" } = req.body

        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)

        if (plan.monthlyPrice == null || plan.yearlyPrice == null) {
            throw new AppError("plan prices not found", 400)
        }

        if (discountPercent == null) {
            throw new AppError("discountPercent is required", 400)
        }

        if (discountPercent < 0 || discountPercent > 100) {
            throw new AppError("discountPercent must be between 0 and 100", 400)
        }

        let parsedValidUntil: Date | undefined = undefined

        if (validUntil) {
            parsedValidUntil = new Date(validUntil)

            if (isNaN(parsedValidUntil.getTime())) {
                throw new AppError("validUntil is invalid", 400)
            }

            if (parsedValidUntil.getTime() <= Date.now()) {
                throw new AppError("validUntil must be in the future", 400)
            }
        }

        let monthlyPriceAfterDiscount = plan.monthlyPrice
        let yearlyPriceAfterDiscount = plan.yearlyPrice

        if (applyTo === "monthly" || applyTo === "both") {
            monthlyPriceAfterDiscount = Number(
                (plan.monthlyPrice - (plan.monthlyPrice * discountPercent) / 100).toFixed(2)
            )
        }

        if (applyTo === "yearly" || applyTo === "both") {
            yearlyPriceAfterDiscount = Number(
                (plan.yearlyPrice - (plan.yearlyPrice * discountPercent) / 100).toFixed(2)
            )
        }

        plan.offer = {
            label,
            discountPercent,
            validUntil: parsedValidUntil,
            isActive: isActive ?? true,
            applyTo
        }

        plan.monthlyPriceAfterDiscount = monthlyPriceAfterDiscount
        plan.yearlyPriceAfterDiscount = yearlyPriceAfterDiscount

        await plan.save()

        return res.status(200).json({
            message: "Plan offer set successfully",
            plan
        })
    }

    removePlanOffer = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
        plan.offer = undefined
        plan.monthlyPriceAfterDiscount = undefined
        plan.yearlyPriceAfterDiscount = undefined
        await plan.save()
        return res.status(200).json({ message: "Plan offer removed", plan })
    }

    //CRUD FOR COUPON
    createCoupon = async (req: Request, res: Response, next: NextFunction) => {
        const { code, type, value, maxUses, plans, validFrom, validUntil } = req.body

        if (!code) throw new AppError("code is required", 400)

        if (!type) throw new AppError("type is required", 400)
        if (!["percent", "fixed"].includes(type)) {
            throw new AppError("type must be either 'percent' or 'fixed'", 400)
        }

        if (value == null) throw new AppError("value is required", 400)
        if (type === "percent" && (value <= 0 || value > 100)) {
            throw new AppError("percent value must be between 1 and 100", 400)
        }
        if (type === "fixed" && value <= 0) {
            throw new AppError("fixed value must be greater than 0", 400)
        }
        if (!validFrom || !validUntil) throw new AppError("validFrom and validUntil are required", 400)

        const fromDate = new Date(validFrom)
        const untilDate = new Date(validUntil)

        if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
            throw new AppError("invalid coupon dates", 400)
        }

        if (untilDate <= fromDate) {
            throw new AppError("validUntil must be after validFrom", 400)
        }

        const normalizedCode = code.toUpperCase()

        const existing = await CouponModel.findOne({ code: normalizedCode })
        if (existing) throw new AppError("coupon code already exists", 409)

        const coupon = await CouponModel.create({
            code: normalizedCode,
            type,
            value,
            maxUses: maxUses ?? -1,
            plans: plans ?? [],
            validFrom: fromDate,
            validUntil: untilDate,
            createdBy: req.user?.id,
        })

        return res.status(201).json({
            message: "Coupon created",
            coupon
        })
    }

    deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
        const { couponId } = req.params
        const coupon = await CouponModel.findByIdAndDelete(couponId)
        if (!coupon) throw new AppError("coupon not found", 404)
        return res.status(200).json({ message: "Coupon deleted", coupon })
    }

    getAllCoupons = async (req: Request, res: Response, next: NextFunction) => {
        const { page = "1", limit = "20" } = req.query

        const pageNum = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)

        const [coupons, total] = await Promise.all([
            CouponModel.find()
                .populate("plans", "name slug")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum).lean(),
            CouponModel.countDocuments()
        ])

        const couponIds = coupons.map(c => c._id)

        const payments = await PaymentModel.find({
            coupon: { $in: couponIds },
            status: "success"
        }).populate("office", "name email subdomain")

        const couponsWithStats = coupons.map(coupon => {
            const couponPayments = payments.filter(
                p => p.coupon?.toString() === coupon._id.toString()
            )

            const totalDiscountGiven = couponPayments.reduce((sum, p) => sum + (p.discountAmount || 0), 0)
            const totalRevenueWithCoupon = couponPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

            const uniqueOffices = new Map()
            couponPayments.forEach(p => {
                const office = p.office as any
                if (office && !uniqueOffices.has(office._id.toString())) {
                    uniqueOffices.set(office._id.toString(), {
                        _id: office._id,
                        name: office.name,
                        email: office.email,
                        subdomain: office.subdomain
                    })
                }
            })

            return {
                ...coupon,
                usageStats: {
                    actualUsesCount: couponPayments.length,
                    totalDiscountGiven,
                    totalRevenueWithCoupon,
                    officesUsed: Array.from(uniqueOffices.values())
                }
            }
        })

        return res.status(200).json({
            message: "success",
            coupons: couponsWithStats,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        })
    }

    getCoupon = async (req: Request, res: Response, next: NextFunction) => {
        const { couponId } = req.params
        const coupon = await CouponModel.findById(couponId).populate("plans", "name slug").lean()
        if (!coupon) throw new AppError("coupon not found", 404)

        const payments = await PaymentModel.find({
            coupon: couponId,
            status: "success"
        }).populate("office", "name email subdomain")

        const totalDiscountGiven = payments.reduce((sum, p) => sum + (p.discountAmount || 0), 0)
        const totalRevenueWithCoupon = payments.reduce((sum, p) => sum + (p.amount || 0), 0)

        const uniqueOffices = new Map()
        payments.forEach(p => {
            const office = p.office as any
            if (office && !uniqueOffices.has(office._id.toString())) {
                uniqueOffices.set(office._id.toString(), {
                    _id: office._id,
                    name: office.name,
                    email: office.email,
                    subdomain: office.subdomain
                })
            }
        })

        const couponWithStats = {
            ...coupon,
            usageStats: {
                actualUsesCount: payments.length,
                totalDiscountGiven,
                totalRevenueWithCoupon,
                officesUsed: Array.from(uniqueOffices.values())
            }
        }

        return res.status(200).json({ message: "success", coupon: couponWithStats })
    }

    //BROADCAST
    broadcastMessage = async (req: Request, res: Response, next: NextFunction) => {
        const { title, message, type } = req.body;

        const io = getIO();
        if (io) {
            io.emit("system_announcement", {
                title: title || "إشعار إداري",
                message,
                type: type || "warning",
                createdAt: new Date()
            });
        }

        return res.status(200).json({ message: "Broadcast sent successfully" });
    }

    //DASHBOARD
    dashboard = async (req: Request , res: Response , next: NextFunction)=>{
        const now = new Date()
        const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

        const [totalOffices,
        activeOffices,
        suspendedOffices,
        expiredOffices,
        expiringSoon,
        totalUsers,
        totalRevenue,
        revenueThisMonth,
        recentOffices,
        recentPayments,
    ] = await Promise.all([
        OfficeModel.countDocuments(),
        OfficeModel.countDocuments({ "subscription.status": "active" }),
        OfficeModel.countDocuments({ "subscription.status": "suspended" }),
        OfficeModel.countDocuments({ "subscription.status": "expired" }),
        OfficeModel.find({
            "subscription.status": "active",
            "subscription.endDate": { $gte: now, $lte: in7days },
        }).select("name email subdomain subscription.endDate subscription.planSlug"),
        UserModel.countDocuments({ isDeleted: false }),
        PaymentModel.aggregate([
            { $match: { status: "success" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).then(r => r[0]?.total ?? 0),
        PaymentModel.aggregate([
            {
                $match: {
                    status: "success",
                    createdAt: {
                        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                        $lte: now,
                    },
                },
            },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).then(r => r[0]?.total ?? 0),
        OfficeModel.find()
            .populate("subscription.planId", "name slug")
            .sort({ createdAt: -1 })
            .limit(5)
            .select("name email subdomain subscription isActive createdAt"),
        PaymentModel.find({ status: "success" })
            .populate("office", "name subdomain")
            .populate("plan", "name")
            .sort({ paidAt: -1 })
            .limit(5)
            .select("amount billingInterval paidAt planSnapshot.name paymentMethod"),
    ])

    return res.status(200).json({
        message: "success",
        stats: {
            offices: {
                total: totalOffices,
                active: activeOffices,
                suspended: suspendedOffices,
                expired: expiredOffices,
            },
            users: totalUsers,
            revenue: {
                total: totalRevenue,
                thisMonth: revenueThisMonth,
            },
        },
        expiringSoon,
        recentOffices,
        recentPayments,
    })

    }

    getPayments = async (req: Request, res: Response, next: NextFunction) => {
        const { officeId, status, page = "1", limit = "20" } = req.query
        const filter: any = {}
        if (officeId) filter.office = officeId
        if (status)   filter.status = status
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
 
        const [payments, total] = await Promise.all([
            PaymentModel.find(filter)
                .populate("office", "name email subdomain")
                .populate("plan",   "name slug")
                .populate("coupon", "code type value")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .select("-paymobPaymentKey"),
            PaymentModel.countDocuments(filter),
        ])
 
        return res.status(200).json({ message: "success", total, page: pageNum, totalPages: Math.ceil(total / limitNum), payments })
    }

    //OFFICES

    getAllOffices = async (req: Request, res: Response, next: NextFunction) => {
        const { status, planSlug, search, page = "1", limit = "20" } = req.query
 
        const filter: any = {}
        if (status)   filter["subscription.status"]   = status
        if (planSlug) filter["subscription.planSlug"] = planSlug
        if (search)   filter.$or = [
            { name:      { $regex: search, $options: "i" } },
            { email:     { $regex: search, $options: "i" } },
            { subdomain: { $regex: search, $options: "i" } },
        ]
 
        const pageNum  = Math.max(Number(page), 1)
        const limitNum = Math.min(Math.max(Number(limit), 1), 100)
 
        const [offices, total] = await Promise.all([
            OfficeModel.find(filter)
                .populate("subscription.planId", "name slug monthlyPrice yearlyPrice")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            OfficeModel.countDocuments(filter),
        ])
 
        return res.status(200).json({
            message: "success",
            total, page: pageNum, totalPages: Math.ceil(total / limitNum),
            offices,
        })
    }

    getOfficeById = async (req: Request, res: Response, next: NextFunction) => {
        const { officeId } = req.params
 
        const [office, usersCount, paymentsCount, totalPaid] = await Promise.all([
            OfficeModel.findById(officeId)
                .populate("subscription.planId", "name slug monthlyPrice yearlyPrice features"),
            UserModel.countDocuments({ officeId, isDeleted: false }),
            PaymentModel.countDocuments({ office: officeId, status: "success" }),
            PaymentModel.aggregate([
                { $match: { office: new (require("mongoose").Types.ObjectId)(officeId), status: "success" } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
            ]).then(r => r[0]?.total ?? 0),
        ])
 
        if (!office) throw new AppError("office not found", 404)
 
        return res.status(200).json({ message: "success", office, usersCount, paymentsCount, totalPaid })
    }

    updateOfficeSubscription = async (req: Request, res: Response, next: NextFunction) => {
        const { officeId } = req.params
        const { planSlug, status, endDate, billingInterval } = req.body
 
        const office = await OfficeModel.findById(officeId)
        if (!office) throw new AppError("office not found", 404)
 
        if (planSlug) {
            const plan = await PlanModel.findOne({ slug: planSlug, isActive: true })
            if (!plan) throw new AppError("plan not found", 404)
            office.subscription.planId   = plan._id
            office.subscription.planSlug = plan.slug
            office.features = buildFeaturesFromPlan(plan)
        }
 
        if (status) {
            office.subscription.status = status
            office.isActive = status === "active"
        }
        if (endDate) {
            office.subscription.endDate = new Date(endDate)
        } else if (status === "active" && office.subscription.status !== "active") {
            // تفعيل يدوي بدون تمرير endDate: نحسب المدة أوتوماتيك
            const interval = billingInterval || office.subscription.billingInterval
            const now = new Date()
            if (interval === "yearly") {
                now.setFullYear(now.getFullYear() + 1)
            } else {
                now.setMonth(now.getMonth() + 1)
            }
            office.subscription.endDate = now
            office.subscription.lastPaymentAt = new Date()
        }

        if (billingInterval) office.subscription.billingInterval = billingInterval
 
        await office.save()
 
        return res.status(200).json({ message: "Subscription updated successfully", office })
    }

    updateOfficeFeatures = async (req: Request, res: Response, next: NextFunction) => {
        const { officeId } = req.params
        const { features } = req.body

        const office = await OfficeModel.findById(officeId)
        if (!office) throw new AppError("office not found", 404)

        if (features && features[PLAN_FEATURES.STORAGE_MAX] !== undefined) {
            features[PLAN_FEATURES.STORAGE_MAX] = parseStorageSize(features[PLAN_FEATURES.STORAGE_MAX]);
        }

        Object.assign(office.features, features)
        office.markModified("features")
        await office.save()

        return res.status(200).json({ message: "Features updated", features: office.features })
    }

    toggleOfficeStatus = async (req: Request, res: Response, next: NextFunction) => {
        const { officeId } = req.params
 
        const office = await OfficeModel.findById(officeId)
        if (!office) throw new AppError("office not found", 404)
 
        const newStatus = office.isActive ? "suspended" : "active"
        office.subscription.status = newStatus as any
        office.isActive            = !office.isActive
        await office.save()
 
        return res.status(200).json({
            message:  `Office ${office.isActive ? "activated" : "suspended"} successfully`,
            isActive: office.isActive,
        })
    }

    getRevenueChart = async (req: Request, res: Response, next: NextFunction) => {
        const year = Number(req.query.year) || new Date().getFullYear()
 
        const data = await PaymentModel.aggregate([
            {
                $match: {
                    status:    "success",
                    createdAt: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59) }
                }
            },
            { $lookup: { from: "plans", localField: "plan", foreignField: "_id", as: "planData" } },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        plan:  { $arrayElemAt: ["$planData.name", 0] },
                    },
                    revenue:       { $sum: "$amount" },
                    subscriptions: { $sum: 1 },
                }
            },
            { $sort: { "_id.month": 1 } }
        ])
 
        const months = Array.from({ length: 12 }, (_, i) => i + 1)
        const plans  = [...new Set(data.map((d: any) => d._id.plan).filter(Boolean))]
 
        const chart = months.map(month => {
            const monthData: any = { month }
            plans.forEach(plan => {
                const found = data.find((d: any) => d._id.month === month && d._id.plan === plan)
                monthData[plan as string] = { revenue: found?.revenue ?? 0, subscriptions: found?.subscriptions ?? 0 }
            })
            return monthData
        })
 
        return res.status(200).json({ message: "success", year, plans, chart })
    }

    getRevenueByPlan = async (req: Request, res: Response, next: NextFunction) => {
        const { planId } = req.params
 
        const plan = await PlanModel.findById(planId)
        if (!plan) throw new AppError("plan not found", 404)
 
        const data = await PaymentModel.aggregate([
            {
                $match: {
                    plan:    new (require("mongoose").Types.ObjectId)(planId),
                    status:  "success",
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year:  { $year: "$createdAt" },
                    },
                    revenue:       { $sum: "$amount" },
                    subscriptions: { $sum: 1 },
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ])
 
        return res.status(200).json({ message: "success", plan: plan.name, data })
    }

    //STORAGE MANAGEMENT

    triggerStorageSync = async (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();
        await syncOfficeStorage();
        const duration = Date.now() - startTime;

        return res.status(200).json({
            message: "Storage sync completed successfully (Cloudinary-verified)",
            durationMs: duration,
        });
    }

    auditOfficeStorage = async (req: Request, res: Response, next: NextFunction) => {
        const { officeId } = req.params;

        const office = await OfficeModel.findById(officeId);
        if (!office) throw new AppError("office not found", 404);

        // Build Cloudinary map
        const cloudinaryMap = await buildCloudinaryBytesMap();

        // Collect all files from MongoDB
        const files: {
            source: string;
            publicId: string;
            mongoBytes: number;
            cloudinaryBytes: number | null;
            status: "ok" | "size_mismatch" | "missing_in_cloudinary";
        }[] = [];

        // 1) Users – profile photos
        const users = await UserModel_SA.find({ officeId }).select("ProfilePhoto UserName").lean();
        for (const u of users) {
            const photo = (u as any).ProfilePhoto;
            const pid = photo?.publicId || photo?.PublicId;
            if (pid) {
                const cb = cloudinaryMap.get(pid);
                files.push({
                    source: `user-photo (${(u as any).UserName || u._id})`,
                    publicId: pid,
                    mongoBytes: photo?.sizeBytes || 0,
                    cloudinaryBytes: cb ?? null,
                    status: cb === undefined ? "missing_in_cloudinary" : cb === (photo?.sizeBytes || 0) ? "ok" : "size_mismatch",
                });
            }
        }

        // 2) Legal Cases – attachments
        const cases = await LegalCaseModel_SA.find({ officeId }).select("attachments caseNumber").lean();
        for (const c of cases) {
            for (const att of ((c as any).attachments || [])) {
                if (att.publicId) {
                    const cb = cloudinaryMap.get(att.publicId);
                    files.push({
                        source: `case-attachment (${(c as any).caseNumber || c._id})`,
                        publicId: att.publicId,
                        mongoBytes: att.sizeBytes || 0,
                        cloudinaryBytes: cb ?? null,
                        status: cb === undefined ? "missing_in_cloudinary" : cb === (att.sizeBytes || 0) ? "ok" : "size_mismatch",
                    });
                }
            }
        }

        // 3) Sessions – attachments
        const sessions = await SessionModel_SA.find({ officeId }).select("attachments").lean();
        for (const s of sessions) {
            for (const att of ((s as any).attachments || [])) {
                if (att.publicId) {
                    const cb = cloudinaryMap.get(att.publicId);
                    files.push({
                        source: `session-attachment (${s._id})`,
                        publicId: att.publicId,
                        mongoBytes: att.sizeBytes || 0,
                        cloudinaryBytes: cb ?? null,
                        status: cb === undefined ? "missing_in_cloudinary" : cb === (att.sizeBytes || 0) ? "ok" : "size_mismatch",
                    });
                }
            }
        }

        // 4) Tasks – attachments
        const tasks = await TaskModel_SA.find({ officeId }).select("attachments title").lean();
        for (const t of tasks) {
            for (const att of ((t as any).attachments || [])) {
                if (att.publicId) {
                    const cb = cloudinaryMap.get(att.publicId);
                    files.push({
                        source: `task-attachment (${(t as any).title || t._id})`,
                        publicId: att.publicId,
                        mongoBytes: att.sizeBytes || 0,
                        cloudinaryBytes: cb ?? null,
                        status: cb === undefined ? "missing_in_cloudinary" : cb === (att.sizeBytes || 0) ? "ok" : "size_mismatch",
                    });
                }
            }
        }

        // 5) Clients – documents
        const clients = await ClientModel_SA.find({ officeId }).select("documents fullName").lean();
        for (const cl of clients) {
            for (const doc of ((cl as any).documents || [])) {
                if (doc.publicId) {
                    const cb = cloudinaryMap.get(doc.publicId);
                    files.push({
                        source: `client-document (${(cl as any).fullName || cl._id})`,
                        publicId: doc.publicId,
                        mongoBytes: doc.sizeBytes || 0,
                        cloudinaryBytes: cb ?? null,
                        status: cb === undefined ? "missing_in_cloudinary" : cb === (doc.sizeBytes || 0) ? "ok" : "size_mismatch",
                    });
                }
            }
        }

        // 6) Settings – logo
        const settings = await SettingsModel_SA.findOne({ officeId }).select("logoPublicId logoSizeBytes").lean();
        if (settings?.logoPublicId) {
            const cb = cloudinaryMap.get(settings.logoPublicId);
            files.push({
                source: "settings-logo",
                publicId: settings.logoPublicId,
                mongoBytes: (settings as any).logoSizeBytes || 0,
                cloudinaryBytes: cb ?? null,
                status: cb === undefined ? "missing_in_cloudinary" : cb === ((settings as any).logoSizeBytes || 0) ? "ok" : "size_mismatch",
            });
        }

        // 7) Laws – PDF files
        const laws = await LawModel_SA.find({ officeId }).select("filePublicId fileSizeBytes title").lean();
        for (const law of laws) {
            if ((law as any).filePublicId) {
                const cb = cloudinaryMap.get((law as any).filePublicId);
                files.push({
                    source: `law-pdf (${(law as any).title || law._id})`,
                    publicId: (law as any).filePublicId,
                    mongoBytes: (law as any).fileSizeBytes || 0,
                    cloudinaryBytes: cb ?? null,
                    status: cb === undefined ? "missing_in_cloudinary" : cb === ((law as any).fileSizeBytes || 0) ? "ok" : "size_mismatch",
                });
            }
        }

        // Summary
        const mongoTotal = files.reduce((s, f) => s + f.mongoBytes, 0);
        const cloudinaryTotal = files.reduce((s, f) => s + (f.cloudinaryBytes ?? 0), 0);
        const okCount = files.filter(f => f.status === "ok").length;
        const mismatchCount = files.filter(f => f.status === "size_mismatch").length;
        const missingCount = files.filter(f => f.status === "missing_in_cloudinary").length;

        return res.status(200).json({
            message: "success",
            office: { _id: office._id, name: office.name, subdomain: office.subdomain },
            summary: {
                counterInDB: office.storageUsedBytes || 0,
                mongoFilesTotal: mongoTotal,
                cloudinaryFilesTotal: cloudinaryTotal,
                drift: (office.storageUsedBytes || 0) - cloudinaryTotal,
                totalFiles: files.length,
                ok: okCount,
                sizeMismatches: mismatchCount,
                missingInCloudinary: missingCount,
            },
            files,
        });
    }

}

export default new SuperAdminService()