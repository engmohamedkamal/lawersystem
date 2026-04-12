import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface SendEmailOptions {
  html?: string;
  subject?: string;
  to?: string;
}

export const sendEmail = async ({ html, subject, to }: SendEmailOptions): Promise<boolean> => {
  try {
    const info = await transporter.sendMail({
      from: `"Customer Service" <${process.env.EMAIL_USER}>`,
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