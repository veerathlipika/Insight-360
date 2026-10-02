import { all, exec, run } from './database.ts';
import { normalizePhone } from '../utils/phone.ts';

export function initializeSchema(): void {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'Sales Manager', 'Sales Executive'
      status TEXT DEFAULT 'Active', -- 'Active', 'Inactive'
      avatar TEXT,
      phone TEXT,
      phone_normalized TEXT,
      customer_id INTEGER,
      subscription_plan TEXT DEFAULT 'trial',
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      industry TEXT,
      status TEXT DEFAULT 'Active', -- 'Active', 'Lead', 'Churned', 'VIP'
      assigned_user_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      unit_price REAL NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      source TEXT NOT NULL,
      requirement TEXT NOT NULL,
      estimated_value REAL DEFAULT 0,
      priority TEXT DEFAULT 'Medium',
      assigned_user_id INTEGER,
      status TEXT DEFAULT 'New', -- 'New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'
      customer_id INTEGER,
      opportunity_id INTEGER,
      last_contacted_at TEXT,
      next_followup_at TEXT,
      attention_score INTEGER DEFAULT 50,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opp_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      lead_id INTEGER,
      value REAL DEFAULT 0,
      stage TEXT DEFAULT 'New', -- 'New', 'Contacted', 'Proposal', 'Negotiation', 'Converted'
      probability INTEGER DEFAULT 20,
      priority TEXT DEFAULT 'Medium',
      assigned_user_id INTEGER,
      expected_close_date TEXT,
      notes TEXT,
      stage_changed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      lead_id INTEGER,
      opportunity_id INTEGER,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL, -- 'Call', 'Email', 'Meeting', 'Note', 'Other'
      status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed', 'Overdue', 'Cancelled'
      priority TEXT DEFAULT 'Medium',
      notes TEXT,
      assigned_user_id INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      opportunity_id INTEGER,
      date TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      terms TEXT,
      status TEXT DEFAULT 'Draft', -- 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      opportunity_id INTEGER,
      quotation_id INTEGER,
      order_date TEXT NOT NULL,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customer_order_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      assigned_user_id INTEGER,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      customer_notes TEXT,
      sales_terms TEXT,
      status TEXT DEFAULT 'Pending Approval',
      resolution_note TEXT,
      order_id INTEGER UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customer_order_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      product_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (request_id) REFERENCES customer_order_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customer_order_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      assigned_user_id INTEGER,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      customer_notes TEXT,
      sales_terms TEXT,
      status TEXT DEFAULT 'Pending Approval',
      resolution_note TEXT,
      order_id INTEGER UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS customer_order_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      product_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (request_id) REFERENCES customer_order_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      lead_id INTEGER,
      opportunity_id INTEGER,
      user_id INTEGER,
      type TEXT NOT NULL, -- 'Call', 'Email', 'Meeting', 'Message', 'Note'
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comments TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium',
      assigned_user_id INTEGER,
      status TEXT DEFAULT 'Open', -- 'Open', 'In Progress', 'Resolved', 'Closed'
      resolution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      order_id INTEGER UNIQUE,
      invoice_number TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'Unpaid',
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_id TEXT NOT NULL UNIQUE,
      payment_date TEXT NOT NULL,
      status TEXT DEFAULT 'Verification Pending',
      submitted_at TEXT NOT NULL,
      verified_by INTEGER,
      verified_at TEXT,
      rejection_reason TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payment_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      active_days INTEGER DEFAULT 0,
      sessions INTEGER DEFAULT 0,
      features_used TEXT NOT NULL DEFAULT '[]',
      usage_date TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_email_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      email_subject TEXT NOT NULL,
      created_at TEXT NOT NULL,
      email_sent_at TEXT,
      UNIQUE (customer_id, reminder_type, period_key),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Indexes for high performance
    CREATE INDEX IF NOT EXISTS idx_customers_assigned ON customers(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_opportunities_customer ON opportunities(customer_id);
    CREATE INDEX IF NOT EXISTS idx_followups_date ON followups(date);
    CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status);
    CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_requests_assigned ON customer_order_requests(assigned_user_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_order_requests_customer ON customer_order_requests(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_customer_order_requests_assigned ON customer_order_requests(assigned_user_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_customer_order_requests_customer ON customer_order_requests(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_communications_customer ON communications(customer_id);
    CREATE INDEX IF NOT EXISTS idx_support_customer ON support_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id, submitted_at);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, submitted_at);
    CREATE INDEX IF NOT EXISTS idx_usage_customer ON product_usage(customer_id, usage_date);
    CREATE INDEX IF NOT EXISTS idx_activity_customer ON customer_activity(customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_customer_reminders_pending_email ON customer_email_reminders(email_sent_at, created_at);
    CREATE TABLE IF NOT EXISTS customer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_code TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT,
      location TEXT,
      industry TEXT,
      customer_type TEXT,
      lead_source TEXT,
      assigned_sales_executive TEXT,
      deal_value REAL DEFAULT 0,
      sales_stage TEXT,
      payment_status TEXT,
      notes TEXT,
      manager_email TEXT NOT NULL,
      manager_user_id INTEGER,
      share_token TEXT,
      status TEXT DEFAULT 'Pending',
      submitted_via TEXT DEFAULT 'Internal',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS customer_request_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      manager_user_id INTEGER NOT NULL,
      manager_email TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_customer_requests_manager ON customer_requests(manager_user_id, manager_email, created_at);
    CREATE INDEX IF NOT EXISTS idx_customer_requests_status ON customer_requests(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_customer_requests_share_token ON customer_requests(share_token);
    CREATE INDEX IF NOT EXISTS idx_customer_request_links_manager ON customer_request_links(manager_user_id, active);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `;

  exec(schemaSql);

  const userColumns = all<{ name: string }>('PRAGMA table_info(users)').map((column) => column.name);
  if (!userColumns.includes('phone_normalized')) {
    exec('ALTER TABLE users ADD COLUMN phone_normalized TEXT');
  }
  if (!userColumns.includes('customer_id')) {
    exec('ALTER TABLE users ADD COLUMN customer_id INTEGER');
  }
  if (!userColumns.includes('subscription_plan')) {
    exec("ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'trial'");
  }
  if (!userColumns.includes('last_login_at')) {
    exec('ALTER TABLE users ADD COLUMN last_login_at TEXT');
  }

  const existingPhones = new Set<string>();
  for (const account of all<{ id: number; phone: string }>('SELECT id, phone FROM users ORDER BY id')) {
    const normalizedPhone = normalizePhone(account.phone || '');
    if (!normalizedPhone || existingPhones.has(normalizedPhone)) {
      run('UPDATE users SET phone_normalized = NULL WHERE id = ?', [account.id]);
      continue;
    }
    existingPhones.add(normalizedPhone);
    run('UPDATE users SET phone_normalized = ? WHERE id = ?', [normalizedPhone, account.id]);
  }

  exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_normalized ON users(phone_normalized) WHERE phone_normalized IS NOT NULL');

  // ── DATA REPAIR MIGRATION ──────────────────────────────────────────────────
  // Fix 1: Any user with a customer_id must have role = 'Customer'.
  //         This corrects accounts that were registered with the wrong role
  //         (e.g., a customer who left the dropdown on 'Sales Executive').
  const wrongRoleCustomers = all<{ id: number; full_name: string }>(
    "SELECT id, full_name FROM users WHERE customer_id IS NOT NULL AND role != 'Customer'"
  );
  if (wrongRoleCustomers.length > 0) {
    console.log(`[Schema Repair] Fixing ${wrongRoleCustomers.length} user(s) with customer_id but wrong role → forcing role='Customer'`);
    for (const u of wrongRoleCustomers) {
      run("UPDATE users SET role = 'Customer' WHERE id = ?", [u.id]);
      console.log(`  ✔ Fixed user id=${u.id} (${u.full_name})`);
    }
  }

  // Fix 2: Any user with role = 'Customer' but no customer_id is an orphan —
  //         downgrade to 'Sales Executive' so they land on the correct dashboard.
  const orphanCustomers = all<{ id: number; full_name: string }>(
    "SELECT id, full_name FROM users WHERE role = 'Customer' AND customer_id IS NULL"
  );
  if (orphanCustomers.length > 0) {
    console.log(`[Schema Repair] Fixing ${orphanCustomers.length} orphan Customer-role user(s) with no customer_id → forcing role='Sales Executive'`);
    for (const u of orphanCustomers) {
      run("UPDATE users SET role = 'Sales Executive' WHERE id = ?", [u.id]);
      console.log(`  ✔ Fixed user id=${u.id} (${u.full_name})`);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────
}
