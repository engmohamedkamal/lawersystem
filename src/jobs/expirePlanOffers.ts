import cron from "node-cron"
import PlanModel from "../DB/model/SaaSModels/Plan.model"

export const startExpirePlanOffersCron = () => {
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date()

            const result = await PlanModel.updateMany(
                {
                    "offer.validUntil": { $lte: now },
                    "offer.isActive": true
                },
                {
                    $unset: {
                        offer: 1,
                        monthlyPriceAfterDiscount: 1,
                        yearlyPriceAfterDiscount: 1
                    }
                }
            )

            if (result.modifiedCount > 0) {
                console.log(`[CRON] Expired offers removed from ${result.modifiedCount} plan(s).`)
            }
        } catch (error) {
            console.error("[CRON ERROR] Failed to remove expired plan offers:", error)
        }
    })
}