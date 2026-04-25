import { Queue, Worker } from "bullmq";
import { redisConnection } from "./redisConnection";
import OfficeModel from "../DB/model/SaaSModels/Office.model";
import PaymentModel from "../DB/model/SaaSModels/Payment.model";
import PlanModel from "../DB/model/SaaSModels/Plan.model";
import { chargeWithToken } from "../moudles/SASS/payment/Paymob.service";
import { emailQueue } from "./email.queue";
import { buildEmailTemplate } from "../utils/emailTemplate";

export interface ExpireSubscriptionJobData {
  officeId: string;
  officeName: string;
  email: string;
}

export interface AutoRenewJobData {
  officeId: string;
}

export const expireSubscriptionQueue = new Queue<ExpireSubscriptionJobData>(
  "expire-subscription",
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  }
);

export const autoRenewQueue = new Queue<AutoRenewJobData>("auto-renew", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 }, 
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

let expireWorker: Worker<ExpireSubscriptionJobData> | null = null;
let renewWorker: Worker<AutoRenewJobData> | null = null;

export const startSubscriptionWorkers = () => {
  expireWorker = new Worker<ExpireSubscriptionJobData>(
    "expire-subscription",
    async (job) => {
      const { officeId, officeName, email } = job.data;

      const result = await OfficeModel.findByIdAndUpdate(officeId, {
        $set: { "subscription.status": "expired", isActive: false },
      });

      if (!result) {
        throw new Error(`Office ${officeId} not found`);
      }

      await emailQueue.add("subscription-expired", {
        to: email,
        subject: "تنبيه بانتهاء الاشتراك",
        fromName: officeName,
        html: buildEmailTemplate({
          title: "تنبيه بانتهاء الاشتراك",
          subtitle: officeName,
          badge: "EXPIRED",
          bodyHtml: `
            <p>مرحباً <strong>${officeName}</strong>،</p>
            
            <div class="highlight-box" style="border-color: #ef4444; background-color: #fef2f2; color: #991b1b;">
              لقد انتهى اشتراككم في النظام اليوم. نعتذر عن أي إزعاج قد يسببه توقف بعض الخدمات.
            </div>
            
            <p>لإعادة تفعيل كافة الميزات وضمان استمرارية سير العمل بسلاسة، يرجى تجديد الاشتراك في أقرب وقت.</p>
          `,
          actionBtn: {
            text: "تجديد الاشتراك",
            url: "https://app.helperlawyer.online/Login"
          }
        }),
      });

      console.log(`[EXPIRE WORKER] ✅ ${officeName} marked expired`);
    },
    { connection: redisConnection, concurrency: 5 }
  );

  expireWorker.on("failed", (job, err) => {
    if (job)
      console.error(
        `[EXPIRE WORKER] ❌ ${job.data.officeName} failed (attempt ${job.attemptsMade}):`,
        err.message
      );
  });

  renewWorker = new Worker<AutoRenewJobData>(
    "auto-renew",
    async (job) => {
      const { officeId } = job.data;

      const office = await OfficeModel.findById(officeId).select(
        "+subscription.paymobCardToken"
      );
      if (!office) throw new Error(`Office ${officeId} not found`);

      const plan = await PlanModel.findById(office.subscription.planId);
      if (!plan) throw new Error(`Plan not found for office ${officeId}`);

      let amount =
        office.subscription.billingInterval === "yearly"
          ? plan.yearlyPrice
          : plan.monthlyPrice;

      if (plan.offer?.isActive) {
        const offerValid =
          !plan.offer.validUntil || plan.offer.validUntil >= new Date();
        if (offerValid) {
          amount = Math.round(amount * (1 - plan.offer.discountPercent / 100));
        }
      }

      const payment = await PaymentModel.create({
        office: office._id,
        plan: plan._id,
        billingInterval: office.subscription.billingInterval ?? "monthly",
        paymentMethod: "card",
        amount,
        originalAmount: amount,
        discountAmount: 0,
        status: "pending",
        planSnapshot: {
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          features: plan.features,
        },
      });

      const result = await chargeWithToken({
        amountEGP: amount,
        merchantOrderId: payment._id.toString(),
        cardToken: office.subscription.paymobCardToken!,
        billingData: {
          email: office.email,
          first_name: office.name.split(" ")[0] ?? office.name,
          last_name: office.name.split(" ")[1] ?? ".",
          phone_number: office.phone,
        },
      });

      if (result.success) {
        const newEnd = new Date(office.subscription.endDate);
        if (office.subscription.billingInterval === "yearly") {
          newEnd.setFullYear(newEnd.getFullYear() + 1);
        } else {
          newEnd.setMonth(newEnd.getMonth() + 1);
        }

        const features: Record<string, any> = {};
        plan.features.forEach((f: any) => {
          features[f.key] = f.defaultValue;
        });

        await OfficeModel.findByIdAndUpdate(office._id, {
          $set: {
            "subscription.status": "active",
            "subscription.endDate": newEnd,
            "subscription.lastPaymentAt": new Date(),
            "subscription.lastPaymentAmount": amount,
            "subscription.paymobTransactionId": result.transactionId,
            features,
            isActive: true,
          },
        });

        await PaymentModel.findByIdAndUpdate(payment._id, {
          $set: {
            status: "success",
            paymobTransactionId: result.transactionId,
            paidAt: new Date(),
          },
        });

        console.log(
          `[RENEW WORKER] ✅ ${office.name} renewed → ${newEnd.toLocaleDateString("ar-EG")}`
        );
      } else {
        await PaymentModel.findByIdAndUpdate(payment._id, {
          $set: { status: "failed", failureReason: result.error },
        });

        if (job.attemptsMade + 1 >= (job.opts.attempts ?? 3)) {
          await OfficeModel.findByIdAndUpdate(office._id, {
            $set: { "subscription.status": "expired", isActive: false },
          });
          console.log(
            `[RENEW WORKER] ❌ ${office.name} — all retries exhausted, marked expired`
          );
        }

        throw new Error(
          `Paymob charge failed for ${office.name}: ${result.error}`
        );
      }
    },
    { connection: redisConnection, concurrency: 2 } 
  );

  renewWorker.on("failed", (job, err) => {
    if (job)
      console.error(
        `[RENEW WORKER] ❌ office ${job.data.officeId} failed (attempt ${job.attemptsMade}):`,
        err.message
      );
  });

  renewWorker.on("error", (err) => {
    console.error("[RENEW WORKER] error:", err.message);
  });

  console.log("[SUBSCRIPTION WORKERS] started (expire + auto-renew)");
};

export const stopSubscriptionWorkers = async () => {
  if (expireWorker) await expireWorker.close();
  if (renewWorker) await renewWorker.close();
};
