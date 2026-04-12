import OfficeModel from "../DB/model/SaaSModels/Office.model";
import PaymentModel from "../DB/model/SaaSModels/Payment.model";
import PlanModel from "../DB/model/SaaSModels/Plan.model";
import { chargeWithToken } from "../moudles/SASS/payment/Paymob.service";
import { emitSubscriptionExpired, emitSubscriptionExpiringSoon } from "../utils/EmailEvent";

export const updateExpiredSubscriptions = async () => {
    const now      = new Date()
    const in7days  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    // 1 — خلّي المنتهية expired (بدون autoRenew) وابعت ايميل للأدمن
    const expiredOffices = await OfficeModel.find({
        "subscription.status":    { $in: ["active", "trial"] },
        "subscription.endDate":   { $lt: now },
        "subscription.autoRenew": false,
    }).select("_id name email")

    if (expiredOffices.length > 0) {
        const expiredIds = expiredOffices.map(o => o._id)
        const expired = await OfficeModel.updateMany(
            { _id: { $in: expiredIds } },
            { $set: { "subscription.status": "expired", isActive: false } }
        )
        if (expired.modifiedCount > 0) {
            console.log(`✅ ${expired.modifiedCount} subscriptions expired`)
            for (const office of expiredOffices) {
                emitSubscriptionExpired({
                    email: office.email,
                    officeName: office.name,
                })
            }
        }
    }

    // 2 — تذكير للمنتهية خلال 7 أيام (أيا كان autoRenew أو لأ)
    const expiringSoon = await OfficeModel.find({
        "subscription.status":    { $in: ["active", "trial"] },
        "subscription.endDate":   { $gte: now, $lte: in7days },
    }).select("name email phone subscription")

    for (const office of expiringSoon) {
        const daysLeft = Math.ceil(
            (new Date(office.subscription.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        // يبعت الإيميل مرة واحدة بس قبل التجديد أو الانتهاء بـ 7 أيام بالظبط
        if (daysLeft === 7) {
            console.log(`⚠️  تذكير: ${office.name} — ينتهي خلال ${daysLeft} يوم`)
            emitSubscriptionExpiringSoon({
                email: office.email,
                officeName: office.name,
                endDate: office.subscription.endDate,
                daysLeft,
            })
        }
    }

    // 3 — تجديد تلقائي للمكاتب اللي هتنتهي النهارده وعندها card token
    const autoRenewOffices = await OfficeModel.find({
        "subscription.status":          { $in: ["active", "trial"] },
        "subscription.endDate":         { $gte: now, $lte: todayEnd },
        "subscription.autoRenew":       true,
        "subscription.paymobCardToken": { $exists: true, $ne: null },
    }).select("+subscription.paymobCardToken")

    for (const office of autoRenewOffices) {
        try {
            const plan = await PlanModel.findById(office.subscription.planId)
            if (!plan) continue

            let amount = office.subscription.billingInterval === "yearly"
                ? plan.yearlyPrice
                : plan.monthlyPrice

            if (plan.offer?.isActive) {
                const offerValid = !plan.offer.validUntil || plan.offer.validUntil >= new Date()
                if (offerValid) {
                    amount = Math.round(amount * (1 - plan.offer.discountPercent / 100))
                }
            }

            const payment = await PaymentModel.create({
                office:          office._id,
                plan:            plan._id,
                billingInterval: office.subscription.billingInterval ?? "monthly",
                paymentMethod:   "card",
                amount,
                originalAmount:  amount,
                discountAmount:  0,
                status:          "pending",
                planSnapshot: {
                    name:         plan.name,
                    monthlyPrice: plan.monthlyPrice,
                    yearlyPrice:  plan.yearlyPrice,
                    features:     plan.features,
                },
            })

            const result = await chargeWithToken({
                amountEGP:       amount,
                merchantOrderId: payment._id.toString(),
                cardToken:       office.subscription.paymobCardToken!,
                billingData: {
                    email:        office.email,
                    first_name:   office.name.split(" ")[0] ?? office.name,
                    last_name:    office.name.split(" ")[1] ?? ".",
                    phone_number: office.phone,
                },
            })

            if (result.success) {
                // التجديد يبدأ من الـ endDate الحالي (مش من دلوقتي)
                const newEnd = new Date(office.subscription.endDate)
                if (office.subscription.billingInterval === "yearly") {
                    newEnd.setFullYear(newEnd.getFullYear() + 1)
                } else {
                    newEnd.setMonth(newEnd.getMonth() + 1)
                }

                const features: Record<string, any> = {}
                plan.features.forEach((f: any) => { features[f.key] = f.defaultValue })

                await OfficeModel.findByIdAndUpdate(office._id, {
                    $set: {
                        "subscription.status":              "active",
                        "subscription.endDate":             newEnd,
                        "subscription.lastPaymentAt":       new Date(),
                        "subscription.lastPaymentAmount":   amount,
                        "subscription.paymobTransactionId": result.transactionId,
                        features,
                        isActive: true,
                    }
                })

                await PaymentModel.findByIdAndUpdate(payment._id, {
                    $set: { status: "success", paymobTransactionId: result.transactionId, paidAt: new Date() }
                })

                console.log(`✅ Auto-renewed: ${office.name} → ${newEnd.toLocaleDateString("ar-EG")}`)
            } else {
                await PaymentModel.findByIdAndUpdate(payment._id, {
                    $set: { status: "failed", failureReason: result.error }
                })
                // فشل التجديد — علّم expired
                await OfficeModel.findByIdAndUpdate(office._id, {
                    $set: { "subscription.status": "expired", isActive: false }
                })
                console.log(`❌ Auto-renewal failed: ${office.name} — ${result.error}`)
                // TODO: بعت email للأدمن إن التجديد فشل
            }
        } catch (err) {
            console.error(`[AUTO-RENEW ERROR] ${office.name}:`, err)
        }
    }
}