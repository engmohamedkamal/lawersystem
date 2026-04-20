import cron from "node-cron";
import mongoose from "mongoose";
import { completeExpiredAppointments } from "./completeAppointments.job";
import InvoiceModel from "../DB/model/invoice.model";
import { sessionReminderJob } from "./Session.cron";
import { syncOfficeStorage } from "./syncStorage.cron";
import { updateExpiredSubscriptions } from "./Subscription.cron";
import PlanModel from "../DB/model/SaaSModels/Plan.model";

let appointmentsJobRunning = false;
let reminderJobRunning = false;
let invoiceJobRunning = false;
let storageSyncJobRunning = false;
let subscriptionJobRunning = false;
let planOffersJobRunning = false;



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

  cron.schedule("0 2 * * *", async () => {
    if (storageSyncJobRunning) {
        console.warn("[CRON] storage sync skipped: previous run still active");
        return;
    }

    if (!isDbConnected()) {
        console.warn("[CRON] DB not connected, skipping storage sync");
        return;
    }

    storageSyncJobRunning = true;

    try {
        await syncOfficeStorage();
    } catch (error: any) {
        if (isMongoConnectionError(error)) {
        console.warn("[CRON] DB unavailable during storage sync, skipping");
        } else {
        console.error("[STORAGE SYNC CRON ERROR]", error);
        }
    } finally {
        storageSyncJobRunning = false;
    }
  });

  cron.schedule("5 0 * * *", async () => {
    if (subscriptionJobRunning) {
      console.warn("[CRON] updateExpiredSubscriptions skipped: previous run still active");
      return;
    }

    if (!isDbConnected()) {
      console.warn("[CRON] DB not connected, skipping updateExpiredSubscriptions");
      return;
    }

    subscriptionJobRunning = true;

    try {
      console.log("[CRON] updateExpiredSubscriptions started");
      await updateExpiredSubscriptions();
      console.log("[CRON] updateExpiredSubscriptions finished");
    } catch (error: any) {
      if (isMongoConnectionError(error)) {
        console.warn("[CRON] DB unavailable during updateExpiredSubscriptions, skipping");
      } else {
        console.error("[SUBSCRIPTION CRON ERROR]", error);
      }
    } finally {
      subscriptionJobRunning = false;
    }
  });

  cron.schedule("*/15 * * * *", async () => {
    if (planOffersJobRunning) {
      console.warn("[CRON] expirePlanOffers skipped: previous run still active");
      return;
    }

    if (!isDbConnected()) {
      console.warn("[CRON] DB not connected, skipping expirePlanOffers");
      return;
    }

    planOffersJobRunning = true;

    try {
      const now = new Date();
      const result = await PlanModel.updateMany(
        {
          "offer.validUntil": { $lte: now },
          "offer.isActive": true,
        },
        {
          $unset: {
            offer: 1,
            monthlyPriceAfterDiscount: 1,
            yearlyPriceAfterDiscount: 1,
          },
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`[CRON] Expired offers removed from ${result.modifiedCount} plan(s).`);
      }
    } catch (error: any) {
      if (isMongoConnectionError(error)) {
        console.warn("[CRON] DB unavailable during expirePlanOffers, skipping");
      } else {
        console.error("[PLAN OFFERS CRON ERROR]", error);
      }
    } finally {
      planOffersJobRunning = false;
    }
  });

  console.log("Cron jobs started...");
};