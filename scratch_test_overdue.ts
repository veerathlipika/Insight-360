import { getDb } from './server/db/database';
import { initializeSchema } from './server/db/schema';
import { getOverdueInvoiceReminders } from './server/services/customerReminderService';

async function main() {
  await getDb();
  initializeSchema();

  const reminders = getOverdueInvoiceReminders();
  console.log(`Found ${reminders.length} overdue invoice reminders:`);
  console.log(JSON.stringify(reminders, null, 2));
}

main().catch(console.error);
