import { all, get, run } from '../db/database.ts';
import { notifyUser } from './auditService.ts';
import { hasCustomerEmailDelivery, sendCustomerEmail } from './emailService.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 12 * 60 * 60 * 1000;
let sweepRunning = false;

interface CustomerRecipient {
  customer_id: number;
  user_id: number;
  email: string;
  customer_name: string;
  company: string;
  manager_name: string | null;
  last_login_at: string | null;
}

function reminderRecipients(): CustomerRecipient[] {
  return all<CustomerRecipient>(`
    SELECT c.id as customer_id, u.id as user_id, u.email, c.name as customer_name,
      c.company, u.last_login_at,
      (SELECT full_name FROM users WHERE role = 'Sales Manager' AND status = 'Active' ORDER BY id LIMIT 1) as manager_name
    FROM customers c
    JOIN users u ON u.customer_id = c.id
    WHERE u.role = 'Customer' AND u.status = 'Active'
  `);
}

function lastCustomerActivity(customerId: number, recipient: CustomerRecipient): string {
  const dates = [
    recipient.last_login_at,
    get<any>('SELECT created_at FROM customers WHERE id = ?', [customerId])?.created_at,
    get<any>('SELECT max(created_at) as at FROM customer_activity WHERE customer_id = ?', [customerId])?.at,
    get<any>('SELECT max(date) as at FROM communications WHERE customer_id = ?', [customerId])?.at,
    get<any>('SELECT max(updated_at) as at FROM support_tickets WHERE customer_id = ?', [customerId])?.at,
    get<any>('SELECT max(submitted_at) as at FROM payments WHERE customer_id = ?', [customerId])?.at,
  ].filter((date): date is string => Boolean(date));
  return dates.sort((left, right) => right.localeCompare(left))[0] || new Date(0).toISOString();
}

function invoicesDueSoon(customerId: number): any[] {
  return all<any>(`
    SELECT i.id, i.invoice_number, i.amount, i.due_date,
      COALESCE(sum(CASE WHEN p.status = 'Verified' THEN p.amount ELSE 0 END), 0) as paid_amount,
      COALESCE(sum(CASE WHEN p.status IN ('Verification Pending', 'Under Review') THEN 1 ELSE 0 END), 0) as pending_payments
    FROM invoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    WHERE i.customer_id = ? AND i.status != 'Paid'
    GROUP BY i.id
    ORDER BY i.due_date ASC
  `, [customerId]).map((invoice) => ({
    ...invoice,
    outstanding_amount: Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)),
  })).filter((invoice) => invoice.outstanding_amount > 0 && Number(invoice.pending_payments) === 0);
}

async function recordReminder(
  recipient: CustomerRecipient,
  reminderType: string,
  periodKey: string,
  subject: string,
  message: string,
  emailText: string
): Promise<void> {
  let reminder = get<any>(
    'SELECT id, email_sent_at FROM customer_email_reminders WHERE customer_id = ? AND reminder_type = ? AND period_key = ?',
    [recipient.customer_id, reminderType, periodKey]
  );
  if (!reminder) {
    const now = new Date().toISOString();
    run(
      `INSERT INTO customer_email_reminders (customer_id, user_id, reminder_type, period_key, email_subject, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [recipient.customer_id, recipient.user_id, reminderType, periodKey, subject, now]
    );
    reminder = get<any>(
      'SELECT id, email_sent_at FROM customer_email_reminders WHERE customer_id = ? AND reminder_type = ? AND period_key = ?',
      [recipient.customer_id, reminderType, periodKey]
    );
    notifyUser(recipient.user_id, subject, message, 'customer-reminder', '/customer/notifications');
  }

  if (reminder && !reminder.email_sent_at && await sendCustomerEmail(recipient.email, subject, emailText)) {
    run('UPDATE customer_email_reminders SET email_sent_at = ? WHERE id = ?', [new Date().toISOString(), reminder.id]);
  }
}

async function sendInactiveReminders(recipients: CustomerRecipient[], now: Date): Promise<void> {
  for (const recipient of recipients) {
    const lastActivityAt = lastCustomerActivity(recipient.customer_id, recipient);
    const daysInactive = Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / DAY_MS);
    if (daysInactive < 7) continue;

    const interval = daysInactive >= 30 ? 30 : 7;
    const periodNumber = Math.floor(daysInactive / interval);
    const reminderType = interval === 30 ? 'inactive-month' : 'inactive-week';
    const periodKey = `${reminderType}-${periodNumber}`;
    const subject = daysInactive >= 30 ? 'We miss you at Insight360' : 'A quick Insight360 account check-in';
    const message = `Your last account activity was ${daysInactive} days ago. Sign in to review your profile, orders, and payments.`;
    const emailText = `Hello ${recipient.customer_name},\n\n${message}\n\nYour customer account remains free to access.\n\nInsight360${recipient.manager_name ? `\nCustomer team: ${recipient.manager_name}` : ''}`;
    await recordReminder(recipient, reminderType, periodKey, subject, message, emailText);
  }
}

async function sendDueInvoiceReminders(recipients: CustomerRecipient[], now: Date): Promise<void> {
  const today = now.toISOString().slice(0, 10);
  const cutoff = new Date(now.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const recipientsByCustomer = new Map(recipients.map((recipient) => [recipient.customer_id, recipient]));
  const customerIds = all<{ customer_id: number }>('SELECT DISTINCT customer_id FROM invoices').map((row) => row.customer_id);

  for (const customerId of customerIds) {
    const recipient = recipientsByCustomer.get(customerId);
    if (!recipient) continue;
    for (const invoice of invoicesDueSoon(customerId)) {
      if (invoice.due_date > cutoff) continue;
      const dueLabel = invoice.due_date < today ? 'overdue' : 'due soon';
      const periodKey = invoice.due_date < today
        ? `overdue-week-${Math.floor((now.getTime() - new Date(`${invoice.due_date}T00:00:00Z`).getTime()) / (7 * DAY_MS))}`
        : `due-${invoice.due_date}`;
      const subject = `Payment ${dueLabel}: ${invoice.invoice_number}`;
      const message = `${invoice.invoice_number} has an outstanding balance of ₹${Number(invoice.outstanding_amount).toLocaleString('en-IN')}. Due date: ${invoice.due_date}.`;
      const emailText = `Hello ${recipient.customer_name},\n\nThis is a payment reminder from ${recipient.manager_name || 'your Insight360 account team'}.\n\nInvoice: ${invoice.invoice_number}\nOutstanding amount: ₹${Number(invoice.outstanding_amount).toLocaleString('en-IN')}\nDue date: ${invoice.due_date}\nStatus: ${dueLabel === 'overdue' ? 'OVERDUE' : 'DUE'}\n\nSign in to Insight360 to review the invoice and submit payment proof. Payment is only marked paid after verification.\n\nInsight360`;
      await recordReminder(recipient, `invoice-${dueLabel}`, `${periodKey}-invoice-${invoice.id}`, subject, message, emailText);
    }
  }
}

export async function runCustomerReminders(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const recipients = reminderRecipients();
    const now = new Date();
    await sendInactiveReminders(recipients, now);
    await sendDueInvoiceReminders(recipients, now);
    if (recipients.length > 0 && !hasCustomerEmailDelivery()) {
      console.info('Customer reminders were added in-app; configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and INSIGHT360_EMAIL_FROM to deliver email.');
    }
  } catch (error) {
    console.error('Customer reminder sweep failed:', error);
  } finally {
    sweepRunning = false;
  }
}

export function startCustomerReminderScheduler(): void {
  void runCustomerReminders();
  const timer = setInterval(() => void runCustomerReminders(), SWEEP_INTERVAL_MS);
  timer.unref();
}

export async function sendManagerDueReminders(customerId: number, managerName: string): Promise<{ invoices: number; emailsSent: number }> {
  const recipients = reminderRecipients().filter((recipient) => recipient.customer_id === customerId);
  if (!recipients.length) return { invoices: 0, emailsSent: 0 };

  const recipient = recipients[0];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const cutoff = new Date(now.getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  const dueInvoices = invoicesDueSoon(customerId).filter((invoice) => invoice.due_date <= cutoff);
  let emailsSent = 0;
  for (const invoice of dueInvoices) {
    const subject = `Payment reminder: ${invoice.invoice_number}`;
    const message = `A payment reminder from ${managerName}: ${invoice.invoice_number} has an outstanding balance of ₹${Number(invoice.outstanding_amount).toLocaleString('en-IN')}, due ${invoice.due_date}.`;
    const emailText = `Hello ${recipient.customer_name},\n\n${message}\n\nSign in to Insight360 to review the invoice and submit payment proof. Payments are marked paid only after verification.\n\n${managerName}\nInsight360`;
    const reminderId = get<any>(
      'SELECT id, email_sent_at FROM customer_email_reminders WHERE customer_id = ? AND reminder_type = ? AND period_key = ?',
      [customerId, 'manager-due', `${today}-invoice-${invoice.id}`]
    );
    if (!reminderId) {
      const createdAt = now.toISOString();
      run(
        `INSERT INTO customer_email_reminders (customer_id, user_id, reminder_type, period_key, email_subject, created_at)
         VALUES (?, ?, 'manager-due', ?, ?, ?)`,
        [customerId, recipient.user_id, `${today}-invoice-${invoice.id}`, subject, createdAt]
      );
      notifyUser(recipient.user_id, subject, message, 'customer-reminder', '/customer/payments');
    }
    const row = get<any>(
      'SELECT id, email_sent_at FROM customer_email_reminders WHERE customer_id = ? AND reminder_type = ? AND period_key = ?',
      [customerId, 'manager-due', `${today}-invoice-${invoice.id}`]
    );
    if (row && !row.email_sent_at && await sendCustomerEmail(recipient.email, subject, emailText)) {
      run('UPDATE customer_email_reminders SET email_sent_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
      emailsSent += 1;
    }
  }
  return { invoices: dueInvoices.length, emailsSent };
}

export interface OverdueReminderItem {
  customer_id: number;
  customer_name: string;
  customer_company: string;
  customer_email: string;
  customer_phone: string;
  invoice_id: number;
  invoice_number: string;
  due_date: string;
  days_overdue: number;
  is_one_month_overdue: boolean;
  total_amount: number;
  outstanding_amount: number;
  login_link: string;
  generated_subject: string;
  generated_body: string;
}

export function getOverdueInvoiceReminders(): OverdueReminderItem[] {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const portalUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000/';

  const invoices = all<any>(`
    SELECT i.id as invoice_id, i.invoice_number, i.amount, i.due_date, i.status,
      c.id as customer_id, c.name as customer_name, c.company as customer_company,
      COALESCE(u.email, c.email) as customer_email, c.phone as customer_phone,
      COALESCE((SELECT sum(amount) FROM payments WHERE invoice_id = i.id AND status = 'Verified'), 0) as paid_amount
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN users u ON u.customer_id = c.id AND u.role = 'Customer'
    WHERE i.status != 'Paid'
    ORDER BY i.due_date ASC
  `);

  const results: OverdueReminderItem[] = [];

  for (const inv of invoices) {
    const outstanding = Math.max(0, Number(inv.amount) - Number(inv.paid_amount));
    if (outstanding <= 0) continue;

    const dueDateObj = new Date(`${inv.due_date}T00:00:00Z`);
    const diffMs = now.getTime() - dueDateObj.getTime();
    const daysOverdue = Math.max(1, Math.floor(diffMs / DAY_MS));
    const isOneMonthOverdue = daysOverdue >= 30;

    const formattedAmount = `₹${outstanding.toLocaleString('en-IN')}`;
    const generatedSubject = `[Urgent] Overdue Payment Reminder: Invoice ${inv.invoice_number} (${formattedAmount})`;
    const generatedBody = `Hello ${inv.customer_name},

This is an automated payment reminder from Insight360 regarding your overdue invoice.

Invoice Details:
• Company: ${inv.customer_company}
• Invoice Number: ${inv.invoice_number}
• Original Amount: ₹${Number(inv.amount).toLocaleString('en-IN')}
• Outstanding Due: ${formattedAmount}
• Due Date: ${inv.due_date} (${daysOverdue} days overdue)

Please click the link below to sign in to your Insight360 account portal and clear your outstanding balance:
${portalUrl}

Once signed in, navigate to the Payments section to review your invoice and pay via UPI QR code or bank transfer.

Thank you,
Insight360 Finance & Sales Operations Team`;

    results.push({
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      customer_company: inv.customer_company,
      customer_email: inv.customer_email || 'No email registered',
      customer_phone: inv.customer_phone || '',
      invoice_id: inv.invoice_id,
      invoice_number: inv.invoice_number,
      due_date: inv.due_date,
      days_overdue: daysOverdue,
      is_one_month_overdue: isOneMonthOverdue,
      total_amount: Number(inv.amount),
      outstanding_amount: outstanding,
      login_link: portalUrl,
      generated_subject: generatedSubject,
      generated_body: generatedBody,
    });
  }

  return results;
}

export async function sendSpecificOverdueReminder(
  customerId: number,
  invoiceId: number,
  senderName: string,
  customSubject?: string,
  customMessage?: string
): Promise<{ success: boolean; emailSent: boolean; message: string }> {
  const reminders = getOverdueInvoiceReminders();
  const reminder = reminders.find((r) => r.customer_id === customerId && r.invoice_id === invoiceId);

  if (!reminder) {
    throw new Error('Overdue invoice record not found.');
  }

  const subject = customSubject || reminder.generated_subject;
  const body = customMessage || reminder.generated_body;
  const now = new Date().toISOString();

  // Find customer user record for in-app notification
  // Resolve target user ID safely (fallback to assigned user or manager)
  let targetUserId = get<any>('SELECT id FROM users WHERE customer_id = ? AND role = "Customer" LIMIT 1', [customerId])?.id;
  if (!targetUserId) {
    targetUserId = get<any>('SELECT id FROM users WHERE customer_id = ? LIMIT 1', [customerId])?.id;
  }
  if (!targetUserId) {
    const customer = get<any>('SELECT assigned_user_id FROM customers WHERE id = ?', [customerId]);
    targetUserId = customer?.assigned_user_id || get<any>('SELECT id FROM users WHERE role = "Sales Manager" ORDER BY id LIMIT 1')?.id || 1;
  }

  notifyUser(
    targetUserId,
    subject,
    `Overdue payment reminder for ${reminder.invoice_number} (₹${reminder.outstanding_amount.toLocaleString('en-IN')}). ${reminder.days_overdue} days overdue.`,
    'customer-reminder',
    '/customer/payments'
  );

  // Record in customer_email_reminders
  const periodKey = `manual-overdue-${invoiceId}-${Date.now()}`;
  run(
    `INSERT INTO customer_email_reminders (customer_id, user_id, reminder_type, period_key, email_subject, created_at, email_sent_at)
     VALUES (?, ?, 'manual-overdue', ?, ?, ?, ?)`,
    [customerId, targetUserId, periodKey, subject, now, now]
  );

  // Log activity
  run(
    `INSERT INTO customer_activity (customer_id, activity_type, description, created_at)
     VALUES (?, 'Reminder', ?, ?)`,
    [customerId, `Automated overdue payment reminder sent by ${senderName} for invoice ${reminder.invoice_number} (₹${reminder.outstanding_amount.toLocaleString('en-IN')}, ${reminder.days_overdue} days overdue). Website portal link: ${reminder.login_link}`, now]
  );

  let emailSent = false;
  if (reminder.customer_email && reminder.customer_email.includes('@')) {
    emailSent = await sendCustomerEmail(reminder.customer_email, subject, body);
  }

  return {
    success: true,
    emailSent,
    message: emailSent
      ? `Automated reminder email delivered to ${reminder.customer_email}!`
      : `Reminder recorded & in-app alert sent to customer. (Note: Configure SMTP to send real external emails to ${reminder.customer_email})`
  };
}

