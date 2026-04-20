import { Queue, Worker } from "bullmq";
import { redisConnection } from "./redisConnection";
import { sendEmail } from "../utils/SendEmail";
import UserModel from "../DB/model/user.model";
import OfficeModel from "../DB/model/SaaSModels/Office.model";

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

export const emailQueue = new Queue<EmailJobData>("email", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, 
    },
    removeOnComplete: { count: 200 },  
    removeOnFail: { count: 500 },      
  },
});

let emailWorker: Worker<EmailJobData> | null = null;

export const startEmailWorker = () => {
  emailWorker = new Worker<EmailJobData>(
    "email",
    async (job) => {
      let { to, subject, html, fromName } = job.data;

      if (!fromName) {
        try {
          const user = await UserModel.findOne({ email: to });
          if (user?.officeId) {
            const office = await OfficeModel.findById(user.officeId);
            if (office) fromName = office.name;
          }
        } catch (err) {
          console.error("[EMAIL WORKER] Failed to fetch office name:", err);
        }
      }

      const isSent = await sendEmail({ to, subject, html, fromName });

      if (!isSent) {
        throw new Error(`SMTP failed for ${to}`); 
      }

      console.log(`[EMAIL WORKER] ✅ sent to ${to} (attempt ${job.attemptsMade + 1})`);
    },
    {
      connection: redisConnection,
      concurrency: 3, 
    }
  );

  emailWorker.on("failed", (job, err) => {
    if (job) {
      console.error(
        `[EMAIL WORKER] ❌ job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`,
        err.message
      );
    }
  });

  emailWorker.on("error", (err) => {
    console.error("[EMAIL WORKER] error:", err.message);
  });

  console.log("[EMAIL WORKER] started");
};

export const stopEmailWorker = async () => {
  if (emailWorker) await emailWorker.close();
};
