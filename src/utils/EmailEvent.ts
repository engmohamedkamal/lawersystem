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
    html: buildEmailTemplate({
      title: "تنبيه بقرب انتهاء الاشتراك",
      subtitle: officeName,
      badge: "ALERT",
      bodyHtml: `
        <div class="info-card">
          <div class="info-col">
            <span class="label">📅 تاريخ الانتهاء</span>
            <span class="value" style="font-size: 16px;">${new Date(endDate).toLocaleDateString("ar-EG")}</span>
          </div>
          <div class="info-col info-col-left">
            <a href="#" class="btn-black">RENEW NOW &rarr;</a>
          </div>
        </div>

        <div class="quote-box">
          نود تذكيركم بأن اشتراككم سينتهي خلال <span class="danger">${daysLeft}</span> يوم.
          يرجى التجديد قبل انتهاء الاشتراك لتجنب توقف الخدمة.
        </div>
      `
    }),
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
    html: buildEmailTemplate({
      title: "تنبيه بانتهاء الاشتراك",
      subtitle: officeName,
      badge: "EXPIRED",
      bodyHtml: `
        <div class="quote-box">
          نود إبلاغكم بأن اشتراككم قد انتهى اليوم. يرجى تجديد الاشتراك في أقرب وقت لإعادة تفعيل الخدمة.
        </div>
        <div class="info-card" style="text-align: center;">
          <a href="#" class="btn-black">RENEW SUBSCRIPTION &rarr;</a>
        </div>
      `
    }),
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
        html: buildEmailTemplate({
          title: title,
          subtitle: "مراجعة المهام الموكلة وإثبات التوافق القانوني.",
          badge: "HIGH PRIORITY",
          headerId: `ID: ${user._id.toString().slice(-6).toUpperCase()}`,
          bodyHtml: `
            <div class="grid-2">
              <div class="grid-col">
                <span class="label">CLIENT NAME</span>
                <span class="value">Lexore Client</span>
              </div>
              <div class="grid-col">
                <span class="label">ASSIGNED LAWYER</span>
                <span class="value">${user.UserName}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-col">
                <span class="label">📅 FINAL DEADLINE</span>
                <span class="value" style="font-size: 16px;">يرجى المراجعة فوراً</span>
              </div>
              <div class="info-col info-col-left">
                <a href="#" class="btn-black">OPEN CASE &rarr;</a>
              </div>
            </div>

            <div class="quote-box">
              "${body}"
            </div>

            <div class="grid-3">
              <div class="grid-col">
                <span class="label">STATUS</span>
                <span class="value"><span class="dot"></span> Pending Review</span>
              </div>
              <div class="grid-col">
                <span class="label">DOCUMENT TYPE</span>
                <span class="value">Draft v1.0</span>
              </div>
              <div class="grid-col">
                <span class="label">INTERNAL REFERENCE</span>
                <span class="value">L-${new Date().getFullYear()}</span>
              </div>
            </div>
          `
        }),
      });
    }
  } catch (error) {
    console.error("Error in emitItemAssigned:", error);
  }
};