import cron from "node-cron";
import mongoose from "mongoose";
import { completeExpiredAppointments } from "./completeAppointments.job";
import InvoiceModel from "../DB/model/invoice.model";
import { sessionReminderJob } from "./Session.cron";
import { startExpirePlanOffersCron } from "./expirePlanOffers";

let appointmentsJobRunning = false;
let reminderJobRunning = false;
let invoiceJobRunning = false;

const isDbConnected = () => mongoose.connection.readyState === 1;

const isMongoConnectionError = (error: any) => {
  return (
    error?.name === "MongoServerSelectionError" ||
    error?.name === "MongoNetworkError" ||
    error?.code === "ECONNRESET" ||
    error?.cause?.code === "ECONNRESET"
  );
};

export const startCronJobs = () => {
  startExpirePlanOffersCron();

  cron.schedule("*/5 * * * *", async () => {
    if (appointmentsJobRunning) {
      console.warn("[CRON] completeExpiredAppointments skipped: previous run still active");
      return;
    }

    if (!isDbConnected()) {
      console.warn("[CRON] DB not connected, skipping completeExpiredAppointments");
      return;
    }

    appointmentsJobRunning = true;

    try {
      console.log("[CRON] completeExpiredAppointments started");
      await completeExpiredAppointments();
      console.log("[CRON] completeExpiredAppointments finished");
    } catch (error: any) {
      if (isMongoConnectionError(error)) {
        console.warn("[CRON] DB unavailable during completeExpiredAppointments, skipping");
      } else {
        console.error("[CRON ERROR]", error);
      }
    } finally {
      appointmentsJobRunning = false;
    }
  });

  cron.schedule("0 * * * *", async () => {
    if (reminderJobRunning) {
      console.warn("[CRON] sessionReminderJob skipped: previous run still active");
      return;
    }

    if (!isDbConnected()) {
      console.warn("[CRON] DB not connected, skipping sessionReminderJob");
      return;
    }

    reminderJobRunning = true;

    try {
      console.log("[CRON] sessionReminderJob started");
      await sessionReminderJob();
      console.log("[CRON] sessionReminderJob finished");
    } catch (error: any) {
      if (isMongoConnectionError(error)) {
        console.warn("[CRON] DB unavailable during sessionReminderJob, skipping");
      } else {
        console.error("[SESSION REMINDER ERROR]", error);
      }
    } finally {
      reminderJobRunning = false;
    }
  });

  cron.schedule("0 0 * * *", async () => {
    if (invoiceJobRunning) {
      console.warn("[CRON] invoice update skipped: previous run still active");
      return;
    }

    if (!isDbConnected()) {
      console.warn("[CRON] DB not connected, skipping invoice update");
      return;
    }

    invoiceJobRunning = true;

    try {
      console.log("[CRON] overdue invoice update started");

      const now = new Date();

      const result = await InvoiceModel.updateMany(
        {
          isDeleted: false,
          status: { $in: ["مسودة", "مُصدرة"] },
          dueDate: { $lt: now },
          remaining: { $gt: 0 },
        },
        { $set: { status: "متأخرة" } }
      );

      console.log("[CRON] overdue invoices updated:", result.modifiedCount);
    } catch (error: any) {
      if (isMongoConnectionError(error)) {
        console.warn("[CRON] DB unavailable during invoice update, skipping");
      } else {
        console.error("[INVOICE CRON ERROR]", error);
      }
    } finally {
      invoiceJobRunning = false;
    }
  });

  console.log("Cron jobs started...");
};