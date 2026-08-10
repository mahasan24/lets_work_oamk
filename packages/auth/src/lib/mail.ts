import { env } from "@lets_work/env/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  ...(env.SMTP_USER
    ? {
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD ?? "",
        },
      }
    : {}),
});

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail({ to, subject, text, html }: SendEmailInput) {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

export function sendPasswordResetEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}) {
  const subject = "Reset your Lets Work password";
  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your password.",
    `Reset your password: ${url}`,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "— Lets Work",
  ].join("\n");

  const html = `
    <p>Hi ${name},</p>
    <p>We received a request to reset your password.</p>
    <p><a href="${url}">Reset your password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
    <p>— Lets Work</p>
  `;

  return sendEmail({ to, subject, text, html });
}

export function sendEmailVerificationEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}) {
  const subject = "Verify your Lets Work email";
  const text = [
    `Hi ${name},`,
    "",
    "Please verify your email address to finish setting up your Lets Work account.",
    `Verify email: ${url}`,
    "",
    "If you did not create an account, you can ignore this email.",
    "",
    "— Lets Work",
  ].join("\n");

  const html = `
    <p>Hi ${name},</p>
    <p>Please verify your email address to finish setting up your Lets Work account.</p>
    <p><a href="${url}">Verify email</a></p>
    <p>If you did not create an account, you can ignore this email.</p>
    <p>— Lets Work</p>
  `;

  return sendEmail({ to, subject, text, html });
}

export function sendDeleteAccountVerificationEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}) {
  const subject = "Confirm deleting your Lets Work account";
  const text = [
    `Hi ${name},`,
    "",
    "We received a request to permanently delete your Lets Work account.",
    "This removes your profile, jobs, proposals, contracts, and payment records.",
    `Confirm deletion: ${url}`,
    "",
    "If you did not request this, you can ignore this email and your account will stay active.",
    "",
    "— Lets Work",
  ].join("\n");

  const html = `
    <p>Hi ${name},</p>
    <p>We received a request to permanently delete your Lets Work account.</p>
    <p>This removes your profile, jobs, proposals, contracts, and payment records.</p>
    <p><a href="${url}">Confirm deletion</a></p>
    <p>If you did not request this, you can ignore this email and your account will stay active.</p>
    <p>— Lets Work</p>
  `;

  return sendEmail({ to, subject, text, html });
}
