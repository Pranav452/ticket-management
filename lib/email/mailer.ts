import nodemailer from "nodemailer";

/**
 * Shared Gmail SMTP transporter.
 * Env vars required:
 *   GMAIL_USER         — sending Gmail address
 *   GMAIL_APP_PASSWORD — 16-char App Password (Google Account → Security)
 */
export const transporter = nodemailer.createTransport({
  host:   "smtp.gmail.com",
  port:   587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASSWORD!,
  },
});
