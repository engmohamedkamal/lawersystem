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
        <p>مرحباً <strong>${officeName}</strong>،</p>
        <p>نتمنى أن تكونوا بأفضل حال.</p>
        <p>نود تذكيركم بأن اشتراككم في نظام Lexore سينتهي قريباً.</p>
        
        <div class="highlight-box">
          متبقي <strong>${daysLeft}</strong> يوم على نهاية الاشتراك.<br>
          تاريخ الانتهاء: ${new Date(endDate).toLocaleDateString("ar-EG")}
        </div>
        
        <p>لضمان عدم توقف الخدمة، يرجى المبادرة بتجديد الاشتراك الخاص بكم.</p>
      `,
      actionBtn: {
        text: "تجديد الاشتراك الآن",
        url: "https://app.helperlawyer.online/Login"
      }
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
          badge: "NEW ASSIGNMENT",
          bodyHtml: `
            <p>مرحباً <strong>${user.UserName}</strong>،</p>
            <p>لقد تم تكليفك بمهمة / قضية جديدة على نظام Lexore تتطلب انتباهك.</p>
            
            <div class="highlight-box">
              ${body}
            </div>
            
            <p>يرجى تسجيل الدخول إلى النظام لمراجعة التفاصيل كاملة واتخاذ الإجراءات اللازمة.</p>
          `,
          actionBtn: {
            text: "عرض التفاصيل",
            url: "https://app.helperlawyer.online/Login"
          }
        }),
      });
    }
  } catch (error) {
    console.error("Error in emitItemAssigned:", error);
  }
};