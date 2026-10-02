import { getDb } from './server/db/database';
import { initializeSchema } from './server/db/schema';
import { getOverdueInvoiceReminders, sendSpecificOverdueReminder } from './server/services/customerReminderService';

async function main() {
  await getDb();
  initializeSchema();

  const reminders = getOverdueInvoiceReminders();
  if (!reminders.length) {
    console.log('No overdue reminders found.');
    return;
  }

  const first = reminders[0];
  console.log('Testing send reminder for customer ID:', first.customer_id, 'invoice ID:', first.invoice_id);
  const result = await sendSpecificOverdueReminder(first.customer_id, first.invoice_id, 'Test Manager');
  console.log('Send reminder result:', result);
}

main().catch(console.error);
