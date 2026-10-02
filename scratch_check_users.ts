import { getDb, all, get } from './server/db/database.ts';
import bcrypt from 'bcryptjs';

async function main() {
  await getDb();
  
  // Get all customer users
  const customerUsers = all<any>(`
    SELECT u.id, u.email, u.full_name, u.role, u.customer_id, u.phone,
      c.name as customer_name, c.company
    FROM users u
    LEFT JOIN customers c ON c.id = u.customer_id
    WHERE u.role = 'Customer'
    ORDER BY u.id
  `);
  
  console.log('=== CUSTOMER USERS ===');
  for (const user of customerUsers) {
    console.log(`  ${user.email} | ${user.full_name} | customer_id=${user.customer_id} | company=${user.company}`);
  }
  
  // Check if password123456 works for any customer
  console.log('\n=== PASSWORD CHECK (password123456) ===');
  for (const user of customerUsers) {
    const fullUser = get<any>('SELECT password_hash FROM users WHERE id = ?', [user.id]);
    if (fullUser?.password_hash) {
      const match = bcrypt.compareSync('password123456', fullUser.password_hash);
      console.log(`  ${user.email}: password123456 ${match ? 'WORKS ✓' : 'does NOT match ✗'}`);
    }
  }

  // Also check password "password" and "password123"  
  console.log('\n=== PASSWORD CHECK (password) ===');
  for (const user of customerUsers) {
    const fullUser = get<any>('SELECT password_hash FROM users WHERE id = ?', [user.id]);
    if (fullUser?.password_hash) {
      for (const pwd of ['password', 'password123', 'customer123']) {
        const match = bcrypt.compareSync(pwd, fullUser.password_hash);
        if (match) console.log(`  ${user.email}: "${pwd}" WORKS ✓`);
      }
    }
  }

  console.log('\n=== ALL USERS WITH ROLES ===');
  const allUsers = all<any>('SELECT id, email, full_name, role, customer_id FROM users ORDER BY id');
  for (const u of allUsers) {
    console.log(`  [${u.id}] ${u.email} | ${u.full_name} | role=${u.role} | customer_id=${u.customer_id || 'null'}`);
  }
  
  console.log('\n=== TOP CUSTOMERS ===');
  const topCustomers = all<any>('SELECT id, customer_code, name, company, status FROM customers ORDER BY id');
  for (const c of topCustomers) {
    console.log(`  [${c.id}] ${c.customer_code} | ${c.name} | ${c.company} | status=${c.status}`);
  }
}

main().catch(console.error);
