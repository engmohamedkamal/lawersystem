import cron from "node-cron"
import { completeExpiredAppointments } from "./completeAppointments.job"
import InvoiceModel from "../DB/model/invoice.model"
import { sessionReminderJob } from "./Session.cron"

export const startCronJobs = () => {

    cron.schedule("*/5 * * * *", async () => {
    try {
        await completeExpiredAppointments()
    } catch (error: any) {
        if (error.name === "MongoServerSelectionError") {
            console.warn("[CRON] DB unavailable, skipping")
            return
        }
        console.error("[CRON ERROR]", error)
    }
})

    cron.schedule("0 * * * *", async () => {
        try {
            await sessionReminderJob()
        } catch (error) {
            console.error("[SESSION REMINDER ERROR]", error)
        }
    })

    cron.schedule("0 0 * * *", async () => {
        try {
            const now = new Date()
            await InvoiceModel.updateMany(
                {
                    isDeleted: false,
                    status:    { $in: ["مسودة", "مُصدرة"] },
                    dueDate:   { $lt: now },
                    remaining: { $gt: 0 },
                },
                { $set: { status: "متأخرة" } }
            )
            console.log("overdue invoices updated")
        } catch (error) {
            console.error("[INVOICE CRON ERROR]", error)
        }
    })

    console.log("Cron jobs started...")
}