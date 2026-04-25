import { emailQueue } from "../queues/email.queue";
import UserModel from "../DB/model/user.model";
import { buildEmailTemplate } from "./emailTemplate";

// ─── Event Name Constants (kept for backward compat) ───
export const EmailEvents = {
  SEND_CONFIRM_EMAIL: "sendEmail",
  FORGET_PASSWORD: "forgetPassword",
  PASSWORD_RESET_SUCCESS: "passwordResetSuccess",
  SUSPICIOUS_LOGIN: "suspiciousLogin",
  SUBSCRIPTION_EXPIRING_SOON: "subscriptionExpiringSoon",
  SUBSCRIPTION_EXPIRED: "subscriptionExpired",
  ITEM_ASSIGNED: "itemAssigned",
} as const;

// ─── Payload Interfaces ───
interface SendConfirmEmailPayload {
  email: string;
}

interface ForgetPasswordPayload {
  email: string;
  otp: string | number;
}

interface PasswordResetSuccessPayload {
  email: string;
}

interface SuspiciousLoginPayload {
  email: string;
}

interface SubscriptionExpiringSoonPayload {
  email: string;
  officeName: string;
  endDate: Date | string;
  daysLeft: number;
}

interface SubscriptionExpiredPayload {
  email: string;
  officeName: string;
}

interface ItemAssignedPayload {
  userIds: string[];
  title: string;
  body: string;
}

// ─── Queue-based Emitters ───
// All emails now go through BullMQ with automatic retry

export const emitSendConfirmEmail = ({ email }: SendConfirmEmailPayload) => {
  // Not currently active (was commented out) — placeholder for future
};

export const emitForgetPassword = ({ email, otp }: ForgetPasswordPayload) => {
  // Not currently active (was commented out) — placeholder for future
};

export const emitPasswordResetSuccess = ({ email }: PasswordResetSuccessPayload) => {
  // Not currently active (was commented out) — placeholder for future
};

export const emitSuspiciousLogin = ({ email }: SuspiciousLoginPayload) => {
  // Not currently active (was commented out) — placeholder for future
};

export const emitSubscriptionExpiringSoon = ({
  email,
  officeName,
  endDate,
  daysLeft,
}: SubscriptionExpiringSoonPayload) => {
  emailQueue.add("subscription-expiring-soon", {
    to: email,
    subject: "تنبيه بقرب انتهاء الاشتراك",
    fromName: officeName,
    html: buildEmailTemplate(
      "تنبيه بقرب انتهاء الاشتراك",
      `<p>مرحبًا <strong>${officeName}</strong>،</p>
       <p>نود تذكيركم بأن اشتراككم سينتهي خلال <span class="danger">${daysLeft}</span> يوم.</p>
       <p><strong>تاريخ الانتهاء:</strong> ${new Date(endDate).toLocaleDateString("ar-EG")}</p>
       <p>يرجى التجديد قبل انتهاء الاشتراك لتجنب توقف الخدمة.</p>`
    ),
  });
};

export const emitSubscriptionExpired = ({
  email,
  officeName,
}: SubscriptionExpiredPayload) => {
  emailQueue.add("subscription-expired", {
    to: email,
    subject: "تنبيه بانتهاء الاشتراك",
    fromName: officeName,
    html: buildEmailTemplate(
      "تنبيه بانتهاء الاشتراك",
      `<p>مرحبًا <strong>${officeName}</strong>،</p>
       <p>نود إبلاغكم بأن اشتراككم قد انتهى اليوم.</p>
       <p>يرجى تجديد الاشتراك في أقرب وقت لإعادة تفعيل الخدمة.</p>`
    ),
  });
};

export const emitItemAssigned = async ({
  userIds,
  title,
  body,
}: ItemAssignedPayload) => {
  try {
    const users = await UserModel.find({
      _id: { $in: userIds },
      isDeleted: false,
    });

    for (const user of users) {
      if (!user.email) continue;
      await emailQueue.add("item-assigned", {
        to: user.email,
        subject: title,
        html: buildEmailTemplate(
          title,
          `<p>مرحباً <strong>${user.UserName}</strong>،</p>
           <p>${body}</p>
           <br/>
           <p>يرجى مراجعة النظام لمزيد من التفاصيل.</p>`
        ),
      });
    }
  } catch (error) {
    console.error("Error in emitItemAssigned:", error);
  }
};