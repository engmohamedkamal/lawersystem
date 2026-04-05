// import OfficeModel from "../DB/model/SaaSModels/Office.model";
// import PaymentModel from "../DB/model/SaaSModels/Payment.model";
// import PlanModel from "../DB/model/SaaSModels/Plan.model";


// export const updateExpiredSubscriptions = async () => {
//     const now      = new Date()
//     const in7days  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
//     const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

//     // 1 — خلّي المنتهية expired (بدون autoRenew)
//     const expired = await OfficeModel.updateMany(
//         {
//             "subscription.status":    { $in: ["active", "trial"] },
//             "subscription.endDate":   { $lt: now },
//             "subscription.autoRenew": false,
//         },
//         { $set: { "subscription.status": "expired", isActive: false } }
//     )
//     if (expired.modifiedCount > 0) {
//         console.log(`✅ ${expired.modifiedCount} subscriptions expired`)
//     }

//     // 2 — تذكير للمنتهية خلال 7 أيام بدون autoRenew
//     const expiringSoon = await OfficeModel.find({
//         "subscription.status":    { $in: ["active", "trial"] },
//         "subscription.endDate":   { $gte: now, $lte: in7days },
//         "subscription.autoRenew": false,
//     }).select("name email phone subscription")

//     for (const office of expiringSoon) {
//         const daysLeft = Math.ceil(
//             (new Date(office.subscription.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
//         )
//         console.log(`⚠️  تذكير: ${office.name} — ينتهي خلال ${daysLeft} يوم`)
//         // TODO: بعت email للأدمن بتاع المكتب
//     }

//     // 3 — تجديد تلقائي للمكاتب اللي هتنتهي النهارده وعندها card token
//     const autoRenewOffices = await OfficeModel.find({
//         "subscription.status":          { $in: ["active", "trial"] },
//         "subscription.endDate":         { $gte: now, $lte: todayEnd },
//         "subscription.autoRenew":       true,
//         "subscription.paymobCardToken": { $exists: true, $ne: null },
//     }).select("+subscription.paymobCardToken")

//     for (const office of autoRenewOffices) {
//         try {
//             const plan = await PlanModel.findById(office.subscription.planId)
//             if (!plan) continue

//             const amount = office.subscription.billingInterval === "yearly"
//                 ? plan.yearlyPrice
//                 : plan.monthlyPrice

//             const payment = await PaymentModel.create({
//                 office:          office._id,
//                 plan:            plan._id,
//                 billingInterval: office.subscription.billingInterval ?? "monthly",
//                 paymentMethod:   "card",
//                 amount,
//                 originalAmount:  amount,
//                 discountAmount:  0,
//                 status:          "pending",
//                 planSnapshot: {
//                     name:         plan.name,
//                     monthlyPrice: plan.monthlyPrice,
//                     yearlyPrice:  plan.yearlyPrice,
//                     features:     plan.features,
//                 },
//             })

//             const result = await chargeWithToken({
//                 amountEGP:       amount,
//                 merchantOrderId: payment._id.toString(),
//                 cardToken:       office.subscription.paymobCardToken!,
//                 billingData: {
//                     email:        office.email,
//                     first_name:   office.name.split(" ")[0] ?? office.name,
//                     last_name:    office.name.split(" ")[1] ?? ".",
//                     phone_number: office.phone,
//                 },
//             })

//             if (result.success) {
//                 // التجديد يبدأ من الـ endDate الحالي (مش من دلوقتي)
//                 const newEnd = new Date(office.subscription.endDate)
//                 if (office.subscription.billingInterval === "yearly") {
//                     newEnd.setFullYear(newEnd.getFullYear() + 1)
//                 } else {
//                     newEnd.setMonth(newEnd.getMonth() + 1)
//                 }

//                 await OfficeModel.findByIdAndUpdate(office._id, {
//                     $set: {
//                         "subscription.status":              "active",
//                         "subscription.endDate":             newEnd,
//                         "subscription.lastPaymentAt":       new Date(),
//                         "subscription.lastPaymentAmount":   amount,
//                         "subscription.paymobTransactionId": result.transactionId,
//                         isActive: true,
//                     }
//                 })

//                 await PaymentModel.findByIdAndUpdate(payment._id, {
//                     $set: { status: "success", paymobTransactionId: result.transactionId, paidAt: new Date() }
//                 })

//                 console.log(`✅ Auto-renewed: ${office.name} → ${newEnd.toLocaleDateString("ar-EG")}`)
//             } else {
//                 await PaymentModel.findByIdAndUpdate(payment._id, {
//                     $set: { status: "failed", failureReason: result.error }
//                 })
//                 // فشل التجديد — علّم expired
//                 await OfficeModel.findByIdAndUpdate(office._id, {
//                     $set: { "subscription.status": "expired", isActive: false }
//                 })
//                 console.log(`❌ Auto-renewal failed: ${office.name} — ${result.error}`)
//                 // TODO: بعت email للأدمن إن التجديد فشل
//             }
//         } catch (err) {
//             console.error(`[AUTO-RENEW ERROR] ${office.name}:`, err)
//         }
//     }
// }