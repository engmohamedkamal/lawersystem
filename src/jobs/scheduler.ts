import cron from "node-cron";
import { completeExpiredAppointments } from "./completeAppointments.job";

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