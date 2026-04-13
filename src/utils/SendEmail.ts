import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface SendEmailOptions {
  html?: string | undefined;
  subject?: string | undefined;
  to?: string | undefined;
  fromName?: string | undefined;
}

export const sendEmail = async ({ html, subject, to, fromName }: SendEmailOptions): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"${fromName || 'Customer Service'}" <${process.env.EMAIL_USER}>`,
      to: to || "mohamedkamalawad7407@gmail.com",
      subject: subject || "Hello ✔",
      html: html || "<b>Hello world?</b>",
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("sendEmail error:", error);
    return false;
  }
};