import { env } from "@/lib/env";
import { SITE } from "@/config/constants";

/**
 * Email abstraction.
 * - Default adapter logs the email to the server console (development fallback).
 * - SMTP adapter activates automatically when SMTP_HOST is configured (uses nodemailer).
 * Call sites never depend on a concrete provider.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendViaSmtp(message: EmailMessage): Promise<void> {
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  await transport.sendMail({
    from: env.smtpFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.smtpHost) {
    try {
      await sendViaSmtp(message);
      return;
    } catch (err) {
      console.error("[email] SMTP send failed, falling back to console log", err);
    }
  }
  console.log(
    `[email:dev] To: ${message.to} | Subject: ${message.subject}\n${message.text}`
  );
}

export function verificationEmail(to: string, name: string, url: string): Promise<void> {
  return sendEmail({
    to,
    subject: `Verify your ${SITE.name} account`,
    text: `Hi ${name},\n\nWelcome to ${SITE.name}! Verify your email address:\n${url}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name},</p><p>Welcome to <strong>${SITE.name}</strong>! Verify your email address:</p><p><a href="${url}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export function passwordResetEmail(to: string, name: string, url: string): Promise<void> {
  return sendEmail({
    to,
    subject: `Reset your ${SITE.name} password`,
    text: `Hi ${name},\n\nReset your password:\n${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `<p>Hi ${name},</p><p>Reset your password:</p><p><a href="${url}">Reset password</a></p><p>This link expires in 1 hour.</p>`,
  });
}
