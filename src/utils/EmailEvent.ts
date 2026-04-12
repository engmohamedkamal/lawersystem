import { EventEmitter } from "events";
import { sendEmail } from "./SendEmail";
import { generateToken } from "./token";


/* =========================
   Event Names
========================= */

export const EmailEvents = {
  SEND_CONFIRM_EMAIL: "sendEmail",
  FORGET_PASSWORD: "forgetPassword",
  PASSWORD_RESET_SUCCESS: "passwordResetSuccess",
  SUSPICIOUS_LOGIN: "suspiciousLogin",
  SUBSCRIPTION_EXPIRING_SOON: "subscriptionExpiringSoon",
  SUBSCRIPTION_EXPIRED: "subscriptionExpired",
} as const;

type EmailEventName = (typeof EmailEvents)[keyof typeof EmailEvents];

/* =========================
   Payload Types
========================= */

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

type EmailEventPayloadMap = {
  [EmailEvents.SEND_CONFIRM_EMAIL]: SendConfirmEmailPayload;
  [EmailEvents.FORGET_PASSWORD]: ForgetPasswordPayload;
  [EmailEvents.PASSWORD_RESET_SUCCESS]: PasswordResetSuccessPayload;
  [EmailEvents.SUSPICIOUS_LOGIN]: SuspiciousLoginPayload;
  [EmailEvents.SUBSCRIPTION_EXPIRING_SOON]: SubscriptionExpiringSoonPayload;
  [EmailEvents.SUBSCRIPTION_EXPIRED]: SubscriptionExpiredPayload;
};

/* =========================
   Typed EventEmitter
========================= */

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof EmailEventPayloadMap>(
    eventName: K,
    payload: EmailEventPayloadMap[K]
  ): boolean {
    return super.emit(eventName, payload);
  }

  on<K extends keyof EmailEventPayloadMap>(
    eventName: K,
    listener: (payload: EmailEventPayloadMap[K]) => void | Promise<void>
  ): this {
    return super.on(eventName, listener);
  }
}

export const eventEmitter = new TypedEventEmitter();

/* =========================
   Shared Email Helper
========================= */

const safeSendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  try {
    const isSent = await sendEmail({ to, subject, html });

    if (!isSent) {
      console.error(`Failed to send email to ${to}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error while sending email to ${to}:`, error);
    return false;
  }
};

/* =========================
   Event Listeners
========================= */

// eventEmitter.on(EmailEvents.SEND_CONFIRM_EMAIL, async ({ email }) => {
//   try {
//     const token = await generateToken({
//       payload: { email },
//       signature: process.env.SEND_EMAIL as string,
//       options: { expiresIn: "3m" },
//     });

//     const link = `http://localhost:3000/users/confirmEmail/${token}`;

//     await safeSendEmail({
//       to: email,
//       subject: "Confirm Email",
//       html: `
//         <div style="font-family: Arial, sans-serif; line-height: 1.8;">
//           <h2>Confirm Your Email</h2>
//           <p>Please click the button below to confirm your email address:</p>
//           <a href="${link}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">
//             Confirm Email
//           </a>
//           <p>This link will expire in 3 minutes.</p>
//         </div>
//       `,
//     });
//   } catch (error) {
//     console.error("Error in SEND_CONFIRM_EMAIL event:", error);
//   }
// });

// eventEmitter.on(EmailEvents.FORGET_PASSWORD, async ({ email, otp }) => {
//   try {
//     await safeSendEmail({
//       to: email,
//       subject: "Forget Password",
//       html: `
//         <div style="font-family: Arial, sans-serif; line-height: 1.8;">
//           <h2>Password Reset OTP</h2>
//           <p>Your OTP code is:</p>
//           <h1>${otp}</h1>
//           <p>This code is valid for a limited time.</p>
//         </div>
//       `,
//     });
//   } catch (error) {
//     console.error("Error in FORGET_PASSWORD event:", error);
//   }
// });

// eventEmitter.on(EmailEvents.PASSWORD_RESET_SUCCESS, async ({ email }) => {
//   try {
//     await safeSendEmail({
//       to: email,
//       subject: "Password Reset Success",
//       html: `
//         <div style="font-family: Arial, sans-serif; line-height: 1.8;">
//           <h2>Password Reset Successful</h2>
//           <p>Your password has been changed successfully.</p>
//           <p>If this was not you, please reset your password immediately.</p>
//         </div>
//       `,
//     });
//   } catch (error) {
//     console.error("Error in PASSWORD_RESET_SUCCESS event:", error);
//   }
// });

// eventEmitter.on(EmailEvents.SUSPICIOUS_LOGIN, async ({ email }) => {
//   try {
//     await safeSendEmail({
//       to: email,
//       subject: "🚨 Failed Login Attempts",
//       html: `
//         <div style="font-family: Arial, sans-serif; line-height: 1.8;">
//           <h2>Security Alert</h2>
//           <p>There have been 5 failed attempts to log in to your account.</p>
//           <p>If this was not you, please change your password immediately.</p>
//         </div>
//       `,
//     });
//   } catch (error) {
//     console.error("Error in SUSPICIOUS_LOGIN event:", error);
//   }
// });

eventEmitter.on(
  EmailEvents.SUBSCRIPTION_EXPIRING_SOON,
  async ({ email, officeName, endDate, daysLeft }) => {
    try {
      await safeSendEmail({
        to: email,
        subject: "تنبيه بقرب انتهاء الاشتراك",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.8;">
            <h2>مرحبًا ${officeName}</h2>
            <p>نود تذكيركم أن اشتراككم سينتهي خلال <strong>${daysLeft}</strong> يوم.</p>
            <p><strong>تاريخ الانتهاء:</strong> ${new Date(endDate).toLocaleDateString("ar-EG")}</p>
            <p>يرجى التجديد قبل انتهاء الاشتراك لتجنب توقف الخدمة.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Error in SUBSCRIPTION_EXPIRING_SOON event:", error);
    }
  }
);

eventEmitter.on(
  EmailEvents.SUBSCRIPTION_EXPIRED,
  async ({ email, officeName }) => {
    try {
      await safeSendEmail({
        to: email,
        subject: "تنبيه بانتهاء الاشتراك",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.8;">
            <h2>مرحبًا ${officeName}</h2>
            <p>نود إبلاغكم بأن اشتراككم قد انتهى اليوم.</p>
            <p>يرجى تجديد الاشتراك في أقرب وقت لإعادة تفعيل الخدمة.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Error in SUBSCRIPTION_EXPIRED event:", error);
    }
  }
);

/* =========================
   Typed Emit Helpers
========================= */

export const emitSendConfirmEmail = (payload: SendConfirmEmailPayload) => {
  eventEmitter.emit(EmailEvents.SEND_CONFIRM_EMAIL, payload);
};

export const emitForgetPassword = (payload: ForgetPasswordPayload) => {
  eventEmitter.emit(EmailEvents.FORGET_PASSWORD, payload);
};

export const emitPasswordResetSuccess = (
  payload: PasswordResetSuccessPayload
) => {
  eventEmitter.emit(EmailEvents.PASSWORD_RESET_SUCCESS, payload);
};

export const emitSuspiciousLogin = (payload: SuspiciousLoginPayload) => {
  eventEmitter.emit(EmailEvents.SUSPICIOUS_LOGIN, payload);
};

export const emitSubscriptionExpiringSoon = (
  payload: SubscriptionExpiringSoonPayload
) => {
  eventEmitter.emit(EmailEvents.SUBSCRIPTION_EXPIRING_SOON, payload);
};

export const emitSubscriptionExpired = (
  payload: SubscriptionExpiredPayload
) => {
  eventEmitter.emit(EmailEvents.SUBSCRIPTION_EXPIRED, payload);
};