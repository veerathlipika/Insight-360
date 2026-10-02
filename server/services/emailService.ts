import nodemailer from 'nodemailer';

let transporter: any = null;
let configuredKey = '';

function getTransporter(): any {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;

  const key = `${host}:${port}:${user}:${password}`;
  if (transporter && configuredKey === key) return transporter;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass: password },
  });
  configuredKey = key;
  return transporter;
}

export function hasCustomerEmailDelivery(): boolean {
  return Boolean(getTransporter() && (process.env.INSIGHT360_EMAIL_FROM || process.env.SMTP_USER));
}

export async function sendCustomerEmail(to: string, subject: string, text: string): Promise<boolean> {
  const mailer = getTransporter();
  const from = process.env.INSIGHT360_EMAIL_FROM || process.env.SMTP_USER;
  if (!mailer || !from || !to) return false;

  try {
    await mailer.sendMail({ from, to, subject, text });
    return true;
  } catch (error) {
    console.error('Customer reminder email failed:', error);
    return false;
  }
}
