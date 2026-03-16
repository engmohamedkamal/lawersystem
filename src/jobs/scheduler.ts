import cron from "node-cron";
import { completeExpiredAppointments } from "./completeAppointments.job";
import InvoiceModel from "../DB/model/invoice.model";

export const startCronJobs = () => {

  cron.schedule("* * * * *", async () => {
    try {
      await completeExpiredAppointments();
    } catch (error) {
      console.error("[CRON ERROR]", error);
    }
  });

  console.log("Cron jobs started...");
};


cron.schedule("0 0 * * *", async () => {
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
    console.log("✅ overdue invoices updated")
})