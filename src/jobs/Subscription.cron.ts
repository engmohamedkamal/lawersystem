import OfficeModel from "../DB/model/SaaSModels/Office.model";
import { emitSubscriptionExpiringSoon } from "../utils/EmailEvent";
import {
  expireSubscriptionQueue,
  autoRenewQueue,
} from "../queues/subscription.queue";


export const updateExpiredSubscriptions = async () => {
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const expiredOffices = await OfficeModel.find({
    "subscription.status": { $in: ["active", "trial"] },
    "subscription.endDate": { $lt: now },
    "subscription.autoRenew": false,
  } as any).select("_id name email");

  for (const office of expiredOffices) {
    await expireSubscriptionQueue.add(
      `expire-${office._id}`,
      {
        officeId: office._id.toString(),
        officeName: office.name,
        email: office.email,
      },
      { jobId: `expire-${office._id}-${now.toISOString().split("T")[0]}` } 
    );
  }

  if (expiredOffices.length > 0) {
    console.log(
      `[CRON] Enqueued ${expiredOffices.length} expire-subscription jobs`
    );
  }

  const expiringSoon = await OfficeModel.find({
    "subscription.status": { $in: ["active", "trial"] },
    "subscription.endDate": { $gte: now, $lte: in7days },
  } as any).select("name email phone subscription");

  for (const office of expiringSoon) {
    const daysLeft = Math.ceil(
      (new Date(office.subscription.endDate).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysLeft === 7) {
      console.log(`⚠️  تذكير: ${office.name} — ينتهي خلال ${daysLeft} يوم`);
      emitSubscriptionExpiringSoon({
        email: office.email,
        officeName: office.name,
        endDate: office.subscription.endDate,
        daysLeft,
      });
    }
  }

  const autoRenewOffices = await OfficeModel.find({
    "subscription.status": { $in: ["active", "trial"] },
    "subscription.endDate": { $gte: now, $lte: todayEnd },
    "subscription.autoRenew": true,
    "subscription.paymobCardToken": { $exists: true, $ne: null },
  } as any).select("_id name");

  for (const office of autoRenewOffices) {
    await autoRenewQueue.add(
      `renew-${office._id}`,
      { officeId: office._id.toString() },
      { jobId: `renew-${office._id}-${now.toISOString().split("T")[0]}` } 
    );
  }

  if (autoRenewOffices.length > 0) {
    console.log(
      `[CRON] Enqueued ${autoRenewOffices.length} auto-renew jobs`
    );
  }
};