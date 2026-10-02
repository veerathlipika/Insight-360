import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { all, get, run } from '../db/database.ts';
import { authenticate, generateToken, requireRoles, AuthenticatedRequest } from '../middleware/auth.ts';
import { logAudit, notifyUser } from '../services/auditService.ts';
import { normalizePhone } from '../utils/phone.ts';
import {
  generateCustomerSummary,
  computeLeadAttentionScore,
  askSalesAiAssistant,
  getAiFollowupInsights,
} from '../services/aiService.ts';

const router = express.Router();

// ==========================================
// 1. AUTHENTICATION & SESSIONS
// ==========================================

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const loginValue = email.trim().toLowerCase();
    const phoneValue = normalizePhone(loginValue);
    const user = get<any>('SELECT * FROM users WHERE email = ?', [loginValue])
      || (phoneValue ? get<any>('SELECT * FROM users WHERE phone_normalized = ?', [phoneValue]) : null);
    if (!user) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    if (user.status !== 'Active') {
      res.status(403).json({ error: 'This user account is deactivated. Contact a sales manager.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const lastLoginAt = new Date().toISOString();
    run('UPDATE users SET last_login_at = ? WHERE id = ?', [lastLoginAt, user.id]);
    user.last_login_at = lastLoginAt;

    // ROLE INTEGRITY CHECK: If the user has a customer_id but the wrong role,
    // auto-correct it right now so the JWT token carries the correct role.
    // This handles existing corrupted records without needing a separate migration step.
    if (user.customer_id && user.role !== 'Customer') {
      run("UPDATE users SET role = 'Customer' WHERE id = ?", [user.id]);
      user.role = 'Customer';
      console.log(`[Login Repair] Corrected role to 'Customer' for user id=${user.id} (${user.full_name}) — had customer_id=${user.customer_id} but role was '${user.role}'`);
    }
    if (!user.customer_id && user.role === 'Customer') {
      run("UPDATE users SET role = 'Sales Executive' WHERE id = ?", [user.id]);
      user.role = 'Sales Executive';
      console.log(`[Login Repair] Corrected orphan Customer role to 'Sales Executive' for user id=${user.id} (${user.full_name})`);
    }

    const token = generateToken(user);
    logAudit(user.id, user.full_name, 'LOGIN', 'User', user.id, `User logged in from ${req.ip || 'web'}`);

    const { password_hash, phone_normalized, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred during authentication.' });
  }
});

router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { full_name, email, password, role = 'Sales Executive', phone = '', plan = 'trial' } = req.body;

    if (!full_name || !full_name.trim()) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    if (!email || !email.trim() || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    const validRoles = ['Sales Manager', 'Sales Executive', 'Customer'];
    const requestedRole = validRoles.includes(role) ? role : 'Sales Executive';
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Enter a valid phone number with 7 to 15 digits.' });
      return;
    }
    if (plan === 'paid') {
      res.status(400).json({ error: 'Complete Insight360 Plus checkout before creating a paid workspace. Customer accounts are always free.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const customerRecord = get<any>('SELECT id, phone FROM customers WHERE lower(email) = ?', [cleanEmail]);

    // SECURITY FIX: If the email belongs to a customer record, always force role to 'Customer'.
    // This prevents a customer from accidentally (or intentionally) registering as a Sales Executive
    // by simply not changing the role dropdown on the registration form.
    const assignedRole = customerRecord ? 'Customer' : requestedRole;

    if (assignedRole === 'Customer' && !customerRecord) {
      res.status(400).json({ error: 'This email is not registered on a customer profile. Ask your sales manager to add the customer first.' });
      return;
    }
    if (assignedRole === 'Customer' && normalizePhone(customerRecord.phone || '') !== normalizedPhone) {
      res.status(400).json({ error: 'The phone number must match the number saved on this customer profile.' });
      return;
    }
    const existing = get<any>('SELECT id, role, customer_id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      const message = customerRecord && existing.role === 'Customer' && existing.customer_id === customerRecord.id
        ? 'This customer already has a portal account. Please sign in instead.'
        : customerRecord
        ? 'This email is already registered to a customer. Ask your sales manager to link the existing login to the customer profile.'
        : 'An account with this email address already exists. Please sign in instead.';
      res.status(400).json({ error: message });
      return;
    }

    const duplicatePhone = all<any>('SELECT phone, phone_normalized FROM users').some((account) =>
      account.phone_normalized === normalizedPhone || normalizePhone(account.phone || '') === normalizedPhone
    );
    if (duplicatePhone) {
      res.status(400).json({ error: 'An account with this phone number already exists. Sign in with your phone or use a different number.' });
      return;
    }

    let customerId: number | null = null;
    if (assignedRole === 'Customer') {
      customerId = customerRecord.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const subscriptionPlan = 'trial';

    const result = run(
      `INSERT INTO users (email, password_hash, full_name, role, status, phone, phone_normalized, customer_id, subscription_plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?)`,
      [cleanEmail, passwordHash, full_name.trim(), assignedRole, phone.trim(), normalizedPhone, customerId, subscriptionPlan, now, now]
    );

    const newUser = get<any>('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
    const token = generateToken(newUser);

    logAudit(newUser.id, newUser.full_name, 'REGISTER', 'User', newUser.id, `User registered account with role ${assignedRole}`);
    notifyUser(newUser.id, 'Welcome to Insight360', assignedRole === 'Customer' ? 'Your customer profile is ready to view.' : 'Your account is ready to use the Insight360 sales workspace.', 'success', assignedRole === 'Customer' ? `/customers/${customerId}` : '/dashboard');

    const { password_hash, phone_normalized, ...safeUser } = newUser;
    res.status(201).json({
      token,
      user: safeUser,
      message: 'Account successfully registered and signed in.'
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'An error occurred during account registration.' });
  }
});

router.put('/auth/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { full_name, phone, current_password, new_password } = req.body;
    const currentUser = get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!currentUser) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    let passwordHash = currentUser.password_hash;
    if (new_password) {
      if (new_password.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        return;
      }
      if (current_password) {
        const isMatch = await bcrypt.compare(current_password, currentUser.password_hash);
        if (!isMatch) {
          res.status(400).json({ error: 'Current password does not match.' });
          return;
        }
      }
      passwordHash = await bcrypt.hash(new_password, 10);
    }

    const updatedName = full_name ? full_name.trim() : currentUser.full_name;
    const updatedPhone = phone !== undefined ? phone.trim() : currentUser.phone;
    let normalizedPhone = currentUser.phone_normalized;
    if (phone !== undefined) {
      normalizedPhone = normalizePhone(updatedPhone);
      if (!normalizedPhone) {
        res.status(400).json({ error: 'Enter a valid phone number with 7 to 15 digits.' });
        return;
      }
      const duplicatePhone = all<any>('SELECT id, phone, phone_normalized FROM users WHERE id != ?', [userId]).some((account) =>
        account.phone_normalized === normalizedPhone || normalizePhone(account.phone || '') === normalizedPhone
      );
      if (duplicatePhone) {
        res.status(400).json({ error: 'Another account already uses this phone number.' });
        return;
      }
    }
    const now = new Date().toISOString();

    run(
      `UPDATE users SET full_name = ?, phone = ?, phone_normalized = ?, password_hash = ?, updated_at = ? WHERE id = ?`,
      [updatedName, updatedPhone, normalizedPhone, passwordHash, now, userId]
    );

    const updatedUser = get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    logAudit(userId, updatedName, 'UPDATED', 'User', userId, 'Updated account profile');

    const { password_hash: _, phone_normalized: __, ...safeUser } = updatedUser;
    res.json({ user: safeUser, message: 'Profile updated successfully.' });
  } catch (err: any) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    logAudit(req.user.id, req.user.full_name, 'LOGOUT', 'User', req.user.id, 'User logged out');
  }
  res.json({ message: 'Logged out successfully.' });
});


// ==========================================
// 2. CUSTOMER SUBMISSIONS / REQUESTS
// ==========================================

function normalizeManagerEmail(value: any): string {
  return String(value || '').trim().toLowerCase();
}

function makeRequestCode(): string {
  return `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeShareToken(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

function sanitizeRequestPayload(body: any) {
  return {
    customer_name: String(body.customer_name || '').trim(),
    company_name: String(body.company_name || '').trim(),
    customer_email: String(body.customer_email || '').trim().toLowerCase(),
    customer_phone: String(body.customer_phone || '').trim(),
    location: String(body.location || '').trim(),
    industry: String(body.industry || '').trim(),
    customer_type: String(body.customer_type || '').trim(),
    lead_source: String(body.lead_source || '').trim(),
    assigned_sales_executive: String(body.assigned_sales_executive || '').trim(),
    deal_value: Number.parseFloat(body.deal_value || 0) || 0,
    sales_stage: String(body.sales_stage || '').trim(),
    payment_status: String(body.payment_status || '').trim(),
    notes: String(body.notes || '').trim(),
    manager_email: normalizeManagerEmail(body.manager_email),
  };
}

router.get('/customer-requests/public/:token', (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim().toUpperCase();
    const link = get<any>(
      `SELECT l.*, u.full_name as manager_name
       FROM customer_request_links l
       JOIN users u ON u.id = l.manager_user_id
       WHERE l.token = ? AND l.active = 1`,
      [token]
    );
    if (!link) {
      res.status(404).json({ error: 'This customer submission link is invalid or inactive.' });
      return;
    }
    const executives = all<any>(
      `SELECT id, full_name, email FROM users
       WHERE role = 'Sales Executive' AND status = 'Active'
       ORDER BY full_name ASC`
    );
    res.json({
      manager: { email: link.manager_email, name: link.manager_name },
      executives,
      token,
    });
  } catch (err: any) {
    console.error('Public customer request form error:', err);
    res.status(500).json({ error: 'Unable to load this customer submission form.' });
  }
});

router.post('/customer-requests/public/:token', (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '').trim().toUpperCase();
    const link = get<any>(
      `SELECT * FROM customer_request_links WHERE token = ? AND active = 1`,
      [token]
    );
    if (!link) {
      res.status(404).json({ error: 'This customer submission link is invalid or inactive.' });
      return;
    }

    const data = sanitizeRequestPayload({ ...req.body, manager_email: link.manager_email });
    if (!data.customer_name || !data.company_name) {
      res.status(400).json({ error: 'Customer Name and Company Name are required.' });
      return;
    }

    const now = new Date().toISOString();
    const requestCode = makeRequestCode();
    const result = run(
      `INSERT INTO customer_requests
       (request_code, customer_name, company_name, customer_email, customer_phone, location, industry,
        customer_type, lead_source, assigned_sales_executive, deal_value, sales_stage, payment_status,
        notes, manager_email, manager_user_id, share_token, status, submitted_via, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Shareable Link', ?, ?)`,
      [
        requestCode, data.customer_name, data.company_name, data.customer_email, data.customer_phone,
        data.location, data.industry, data.customer_type, data.lead_source, data.assigned_sales_executive,
        data.deal_value, data.sales_stage, data.payment_status, data.notes, link.manager_email,
        link.manager_user_id, token, now, now
      ]
    );

    res.status(201).json({
      message: 'Customer request submitted successfully. It is now pending manager review.',
      request_code: requestCode,
      id: result.lastInsertRowid,
      status: 'Pending',
    });
  } catch (err: any) {
    console.error('Public customer request submission error:', err);
    res.status(500).json({ error: 'Failed to submit customer request.' });
  }
});

router.post('/customer-requests', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = sanitizeRequestPayload(req.body);
    if (!data.customer_name || !data.company_name || !data.manager_email) {
      res.status(400).json({ error: 'Customer Name, Company Name, and Manager Email are required.' });
      return;
    }

    const manager = get<any>(
      `SELECT id, email, full_name FROM users
       WHERE lower(email) = ? AND role = 'Sales Manager' AND status = 'Active'`,
      [data.manager_email]
    );
    if (!manager) {
      res.status(400).json({ error: 'Manager Email must belong to an active Sales Manager.' });
      return;
    }

    const now = new Date().toISOString();
    const requestCode = makeRequestCode();
    const result = run(
      `INSERT INTO customer_requests
       (request_code, customer_name, company_name, customer_email, customer_phone, location, industry,
        customer_type, lead_source, assigned_sales_executive, deal_value, sales_stage, payment_status,
        notes, manager_email, manager_user_id, status, submitted_via, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Internal', ?, ?)`,
      [
        requestCode, data.customer_name, data.company_name, data.customer_email, data.customer_phone,
        data.location, data.industry, data.customer_type, data.lead_source, data.assigned_sales_executive,
        data.deal_value, data.sales_stage, data.payment_status, data.notes, manager.email, manager.id,
        now, now
      ]
    );

    res.status(201).json({
      message: 'Customer request submitted successfully. It was not added to Customers.',
      request_code: requestCode,
      id: result.lastInsertRowid,
      status: 'Pending',
    });
  } catch (err: any) {
    console.error('Create customer request error:', err);
    res.status(500).json({ error: 'Failed to create customer request.' });
  }
});

router.get('/customer-requests', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const managerEmail = normalizeManagerEmail(req.user?.email);
    const requests = all<any>(
      `SELECT id, request_code, customer_name, company_name, customer_email, customer_phone,
              location, industry, customer_type, lead_source, assigned_sales_executive, deal_value,
              sales_stage, payment_status, notes, manager_email, created_at, status, submitted_via
       FROM customer_requests
       WHERE lower(manager_email) = ?
       ORDER BY created_at DESC`,
      [managerEmail]
    );
    res.json({ requests, total: requests.length });
  } catch (err: any) {
    console.error('Fetch customer requests error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer requests.' });
  }
});

router.post('/customer-requests/share-link', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const manager = get<any>(
      `SELECT id, email, full_name FROM users WHERE id = ? AND role = 'Sales Manager' AND status = 'Active'`,
      [req.user?.id]
    );
    if (!manager) {
      res.status(403).json({ error: 'Only active Sales Managers can create customer submission links.' });
      return;
    }

    const token = makeShareToken();
    const now = new Date().toISOString();
    run(
      `INSERT INTO customer_request_links (token, manager_user_id, manager_email, active, created_at)
       VALUES (?, ?, ?, 1, ?)`,
      [token, manager.id, manager.email.toLowerCase(), now]
    );

    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const origin = `${forwardedProto || req.protocol}://${req.get('host')}`;
    res.status(201).json({
      token,
      url: `${origin}/customer-form/${token}`,
      manager_email: manager.email.toLowerCase(),
    });
  } catch (err: any) {
    console.error('Create customer request share link error:', err);
    res.status(500).json({ error: 'Failed to create shareable form link.' });
  }
});

router.post('/customer-requests/import-check', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const managerId = req.user?.id;
    const checked = rows.map((row: any, index: number) => {
      const name = String(row.name || row.customer_name || '').trim();
      const company = String(row.company || row.company_name || '').trim();
      const email = String(row.email || row.customer_email || '').trim().toLowerCase();
      const duplicateByEmail = email
        ? get<any>('SELECT id, name, company FROM customers WHERE lower(email) = ?', [email])
        : null;
      const duplicateByNameCompany = name && company
        ? get<any>(
            `SELECT id, name, company FROM customers WHERE lower(name) = ? AND lower(company) = ?`,
            [name.toLowerCase(), company.toLowerCase()]
          )
        : null;
      return {
        index,
        row,
        valid: Boolean(name && company),
        duplicate: duplicateByEmail || duplicateByNameCompany || null,
        duplicate_reason: duplicateByEmail ? 'Email already exists' : duplicateByNameCompany ? 'Company + customer name already exists' : null,
      };
    });
    res.json({ rows: checked, manager_id: managerId });
  } catch (err: any) {
    console.error('Customer import check error:', err);
    res.status(500).json({ error: 'Failed to check imported customers.' });
  }
});

router.post('/customer-requests/import', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      res.status(400).json({ error: 'No customer rows were supplied.' });
      return;
    }

    const imported: any[] = [];
    const skipped: any[] = [];
    const now = new Date().toISOString();

    for (const row of rows) {
      const name = String(row.name || row.customer_name || '').trim();
      const company = String(row.company || row.company_name || '').trim();
      const email = String(row.email || row.customer_email || '').trim().toLowerCase();
      const phone = String(row.phone || '').trim();
      const industry = String(row.industry || '').trim();
      const address = String(row.location || row.address || '').trim();
      const notes = String(row.notes || '').trim();
      const dealValue = Number.parseFloat(row.deal_value || row['Deal Value'] || 0) || 0;

      if (!name || !company) {
        skipped.push({ name, company, reason: 'Customer Name and Company are required.' });
        continue;
      }

      const duplicateByEmail = email
        ? get<any>('SELECT id, name, company FROM customers WHERE lower(email) = ?', [email])
        : null;
      const duplicateByNameCompany = get<any>(
        `SELECT id, name, company FROM customers WHERE lower(name) = ? AND lower(company) = ?`,
        [name.toLowerCase(), company.toLowerCase()]
      );

      if ((duplicateByEmail || duplicateByNameCompany) && !row.allow_duplicate) {
        skipped.push({
          name,
          company,
          reason: duplicateByEmail ? 'Email already exists' : 'Company + customer name already exists',
          existing_customer_id: (duplicateByEmail || duplicateByNameCompany).id,
        });
        continue;
      }

      const customerCode = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
      const result = run(
        `INSERT INTO customers
         (customer_code, name, company, email, phone, address, industry, status, assigned_user_id, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
        [
          customerCode, name, company, email, phone, address, industry,
          req.user?.id || null, notes, now, now
        ]
      );

      imported.push({
        id: result.lastInsertRowid,
        customer_code: customerCode,
        name,
        company,
        email,
        phone,
        industry,
        deal_value: dealValue,
      });
    }

    res.status(201).json({
      message: `${imported.length} customer(s) imported successfully.`,
      imported,
      skipped,
    });
  } catch (err: any) {
    console.error('Customer import error:', err);
    res.status(500).json({ error: 'Failed to import customers.' });
  }
});

// ==========================================
// 2. CUSTOMERS
// ==========================================

router.get('/customers', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, sort, page = '1', limit = '50' } = req.query;
    let sql = `
      SELECT c.*, u.full_name as assigned_name,
        (SELECT count(*) FROM orders WHERE customer_id = c.id) as total_orders,
        (SELECT COALESCE(sum(total), 0) FROM orders WHERE customer_id = c.id AND status = 'Completed') as total_revenue,
        (SELECT max(date) FROM communications WHERE customer_id = c.id) as last_interaction
      FROM customers c
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.customer_code LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'all') {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (sort === 'name') {
      sql += ` ORDER BY c.name ASC`;
    } else if (sort === 'revenue') {
      sql += ` ORDER BY total_revenue DESC`;
    } else if (sort === 'company') {
      sql += ` ORDER BY c.company ASC`;
    } else {
      sql += ` ORDER BY c.created_at DESC`;
    }

    const customers = all(sql, params);
    res.json({ customers, total: customers.length });
  } catch (err: any) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Failed to retrieve customers.' });
  }
});

router.get('/customers/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const customer = get<any>(
      `SELECT c.*, u.full_name as assigned_name, u.email as assigned_email
       FROM customers c
       LEFT JOIN users u ON c.assigned_user_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    // Related relational data for Customer 360° Profile
    const leads = all(`SELECT * FROM leads WHERE customer_id = ? ORDER BY created_at DESC`, [id]);
    const opportunities = all(
      `SELECT o.*, u.full_name as assigned_name 
       FROM opportunities o 
       LEFT JOIN users u ON o.assigned_user_id = u.id 
       WHERE o.customer_id = ? 
       ORDER BY o.created_at DESC`,
      [id]
    );
    const followups = all(
      `SELECT f.*, u.full_name as assigned_name 
       FROM followups f 
       LEFT JOIN users u ON f.assigned_user_id = u.id 
       WHERE f.customer_id = ? 
       ORDER BY f.date ASC`,
      [id]
    );
    const quotations = all(`SELECT * FROM quotations WHERE customer_id = ? ORDER BY created_at DESC`, [id]);
    const orders = all(
      `SELECT o.*, 
        (SELECT count(*) FROM order_items WHERE order_id = o.id) as items_count 
       FROM orders o 
       WHERE o.customer_id = ? 
       ORDER BY o.order_date DESC`,
      [id]
    );
    const communications = all(
      `SELECT c.*, u.full_name as user_name 
       FROM communications c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.customer_id = ? 
       ORDER BY c.date DESC`,
      [id]
    );
    const feedback = all(`SELECT * FROM feedback WHERE customer_id = ? ORDER BY date DESC`, [id]);
    const supportTickets = all(
      `SELECT s.*, u.full_name as assigned_name 
       FROM support_tickets s 
       LEFT JOIN users u ON s.assigned_user_id = u.id 
       WHERE s.customer_id = ? 
       ORDER BY s.created_at DESC`,
      [id]
    );

    const completedOrders = orders.filter((o: any) => o.status === 'Completed');
    const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    const lastPurchase = completedOrders[0]?.order_date || null;

    // Customer 360 AI Intelligence & Health Engine
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueFups = followups.filter((f: any) => f.status === 'Overdue' || (f.status === 'Pending' && f.date < todayStr));
    const openTickets = supportTickets.filter((t: any) => t.status === 'Open' || t.status === 'In Progress');
    const lastInteractionDate = communications[0]?.date || customer.created_at;
    const daysSinceInteraction = Math.max(0, Math.floor((Date.now() - new Date(lastInteractionDate).getTime()) / 86400000));

    let healthScore = 80;
    const churnFactors: string[] = [];
    const importantAlerts: Array<{ type: 'danger' | 'warning' | 'info' | 'success'; message: string }> = [];

    if (overdueFups.length > 0) {
      healthScore -= overdueFups.length * 15;
      churnFactors.push(`${overdueFups.length} overdue follow-up task(s)`);
      importantAlerts.push({ type: 'danger', message: `${overdueFups.length} scheduled follow-up(s) are overdue. Immediate sales touchpoint needed.` });
    }

    if (openTickets.length > 0) {
      healthScore -= openTickets.length * 12;
      churnFactors.push(`${openTickets.length} open support ticket(s) awaiting resolution`);
      importantAlerts.push({ type: 'warning', message: `Customer has ${openTickets.length} unresolved support ticket(s).` });
    }

    let averageRating = 0;
    let sentiment: 'Positive' | 'Neutral' | 'Negative' = 'Neutral';
    if (feedback.length > 0) {
      const sumRating = feedback.reduce((sum: number, fb: any) => sum + fb.rating, 0);
      averageRating = sumRating / feedback.length;
      if (averageRating >= 4.0) {
        sentiment = 'Positive';
        healthScore += 10;
      } else if (averageRating < 3.0) {
        sentiment = 'Negative';
        healthScore -= 20;
        churnFactors.push(`Unsatisfied customer feedback score (${averageRating.toFixed(1)}/5 stars)`);
        importantAlerts.push({ type: 'danger', message: `Customer sentiment is negative based on recent feedback.` });
      }
    }

    if (daysSinceInteraction > 30) {
      healthScore -= 15;
      churnFactors.push(`No sales outreach in the past ${daysSinceInteraction} days`);
      importantAlerts.push({ type: 'warning', message: `No client contact for ${daysSinceInteraction} days.` });
    }

    if (customer.status === 'Churned') {
      healthScore = Math.min(healthScore, 25);
      churnFactors.push('Customer account status is Churned');
      importantAlerts.push({ type: 'danger', message: 'Account is flagged as Churned. Re-engagement proposal required.' });
    } else if (customer.status === 'VIP') {
      healthScore = Math.min(100, healthScore + 10);
      importantAlerts.push({ type: 'info', message: 'VIP Key Enterprise Account - priority support & executive oversight.' });
    }

    healthScore = Math.max(15, Math.min(100, Math.round(healthScore)));

    let churnRisk: 'Low' | 'Medium' | 'High' = 'Low';
    if (healthScore < 50 || customer.status === 'Churned') {
      churnRisk = 'High';
    } else if (healthScore < 75) {
      churnRisk = 'Medium';
    }

    // CLV: Historical sales + probability-weighted active pipeline
    const pipelineWeight = opportunities.filter((o: any) => o.stage !== 'Converted').reduce((sum: number, o: any) => sum + (o.value * (o.probability || 50) / 100), 0);
    const estimatedCLV = Math.round(totalRevenue + pipelineWeight);

    // Segmentation
    let segment: 'High Value' | 'Growing' | 'Active' | 'At Risk' | 'New' | 'Inactive' = 'Active';
    if (totalRevenue >= 40000 || customer.status === 'VIP') {
      segment = 'High Value';
    } else if (churnRisk === 'High') {
      segment = 'At Risk';
    } else if (opportunities.some((o: any) => o.stage === 'Proposal' || o.stage === 'Negotiation')) {
      segment = 'Growing';
    } else if (orders.length === 0 && daysSinceInteraction < 14) {
      segment = 'New';
    } else if (daysSinceInteraction > 45) {
      segment = 'Inactive';
    }

    // Next Best Action
    let nextBestAction = 'Schedule executive check-in to explore annual renewal or expansion.';
    if (overdueFups.length > 0) {
      nextBestAction = `Resolve overdue follow-up (${overdueFups[0].type}) regarding "${overdueFups[0].notes}".`;
    } else if (openTickets.length > 0) {
      nextBestAction = `Expedite support resolution for ticket ${openTickets[0].ticket_number}: "${openTickets[0].subject}".`;
    } else if (opportunities.some((o: any) => o.stage === 'Negotiation')) {
      nextBestAction = 'Send finalized commercial agreement to legal decision makers.';
    } else if (opportunities.some((o: any) => o.stage === 'Proposal')) {
      nextBestAction = 'Follow up on proposal review and schedule demonstration walkthrough.';
    } else if (daysSinceInteraction > 21) {
      nextBestAction = 'Reach out with quarterly product enhancement briefing to re-engage.';
    }

    if (req.user?.role === 'Customer') {
      res.json({
        customer: {
          id: customer.id,
          customer_code: customer.customer_code,
          name: customer.name,
          company: customer.company,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          industry: customer.industry,
          status: customer.status,
          created_at: customer.created_at,
        },
        salesInfo: {
          totalOrders: orders.length,
          completedOrders: completedOrders.length,
          totalRevenue,
          averageOrderValue,
          lastPurchase,
        },
        intelligence: {
          sentiment,
          averageRating: Number(averageRating.toFixed(1)),
        },
        orders: orders.map(({ id: orderId, order_number, order_date, total, status: orderStatus }: any) => ({
          id: orderId,
          order_number,
          order_date,
          total,
          status: orderStatus,
        })),
        quotations: quotations.map(({ id: quotationId, quotation_number, valid_until, total, status: quotationStatus }: any) => ({
          id: quotationId,
          quotation_number,
          valid_until,
          total,
          status: quotationStatus,
        })),
      });
      return;
    }

    res.json({
      customer,
      salesInfo: {
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        totalRevenue,
        averageOrderValue,
        lastPurchase,
        activeOpportunitiesCount: opportunities.filter((o: any) => o.stage !== 'Converted').length,
      },
      intelligence: {
        healthScore,
        churnRisk,
        churnFactors,
        estimatedCLV,
        sentiment,
        averageRating: Number(averageRating.toFixed(1)),
        segment,
        importantAlerts,
        nextBestAction,
        daysSinceInteraction,
      },
      leads,
      opportunities,
      followups,
      quotations,
      orders,
      communications,
      feedback,
      supportTickets,
    });
  } catch (err: any) {
    console.error('Fetch customer 360 error:', err);
    res.status(500).json({ error: 'Failed to retrieve customer 360 profile.' });
  }
});

router.post('/customers', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, company, email, phone, address, industry, status = 'Active', assigned_user_id, notes } = req.body;

    if (!name || !company || !email || !phone) {
      res.status(400).json({ error: 'Customer Name, Company, Email, and Phone are required.' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const normalizedPhone = normalizePhone(String(phone));
    if (!cleanEmail.includes('@') || !normalizedPhone) {
      res.status(400).json({ error: 'Enter a valid customer email and a phone number with 7 to 15 digits.' });
      return;
    }
    if (get<any>('SELECT id FROM customers WHERE lower(email) = ?', [cleanEmail])) {
      res.status(409).json({ error: 'This email is already registered on a customer profile.' });
      return;
    }
    if (all<any>('SELECT id, phone FROM customers').some((customer) => normalizePhone(customer.phone || '') === normalizedPhone)) {
      res.status(409).json({ error: 'This phone number is already registered to another customer.' });
      return;
    }
    const existingUser = get<any>('SELECT role FROM users WHERE lower(email) = ?', [cleanEmail]);
    if (existingUser && existingUser.role !== 'Customer') {
      res.status(409).json({ error: 'This email is already registered to a staff account. Use a different customer email or ask a manager to link that account.' });
      return;
    }

    const codeNum = Math.floor(1000 + Math.random() * 9000);
    const customer_code = `CUST-${codeNum}`;
    const now = new Date().toISOString();

    const result = run(
      `INSERT INTO customers (customer_code, name, company, email, phone, address, industry, status, assigned_user_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_code, name.trim(), company.trim(), cleanEmail, String(phone).trim(), address || '', industry || '', status, assigned_user_id || null, notes || '', now, now]
    );

    const newCustomer = get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Customer', result.lastInsertRowid, `Created customer ${name} (${company})`);

    res.status(201).json(newCustomer);
  } catch (err: any) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer.' });
  }
});

router.put('/customers/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, company, email, phone, address, industry, status, assigned_user_id, notes } = req.body;

    const existing = get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const cleanEmail = String(email || existing.email).trim().toLowerCase();
    const updatedPhone = phone !== undefined ? String(phone).trim() : existing.phone;
    const normalizedPhone = normalizePhone(updatedPhone || '');
    if (!cleanEmail.includes('@') || !normalizedPhone) {
      res.status(400).json({ error: 'Enter a valid customer email and phone number.' });
      return;
    }
    if (get<any>('SELECT id FROM customers WHERE lower(email) = ? AND id != ?', [cleanEmail, id])) {
      res.status(409).json({ error: 'This email is already registered on another customer profile.' });
      return;
    }
    if (all<any>('SELECT id, phone FROM customers WHERE id != ?', [id]).some((customer) => normalizePhone(customer.phone || '') === normalizedPhone)) {
      res.status(409).json({ error: 'This phone number is already registered to another customer.' });
      return;
    }
    const existingUser = get<any>('SELECT id, role FROM users WHERE lower(email) = ?', [cleanEmail]);
    if (existingUser && existingUser.role !== 'Customer') {
      res.status(409).json({ error: 'This email is registered to a staff account. Ask a manager to link the account to this customer.' });
      return;
    }

    const now = new Date().toISOString();
    run(
      `UPDATE customers 
       SET name = ?, company = ?, email = ?, phone = ?, address = ?, industry = ?, status = ?, assigned_user_id = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [name, company, cleanEmail, updatedPhone, address || '', industry || '', status, assigned_user_id || null, notes || '', now, id]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'UPDATED', 'Customer', id, `Updated customer ${name} (${company})`);
    const updated = get('SELECT * FROM customers WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer.' });
  }
});

router.delete('/customers/:id', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = get<any>('SELECT * FROM customers WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    run('DELETE FROM customers WHERE id = ?', [id]);
    logAudit(req.user?.id || null, req.user?.full_name || null, 'DELETED', 'Customer', id, `Deleted customer ${existing.name} (${existing.company})`);
    res.json({ message: 'Customer successfully deleted.' });
  } catch (err: any) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Failed to delete customer.' });
  }
});

// ==========================================
// 3. LEADS & QUALIFICATION
// ==========================================

router.get('/leads', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, priority, source } = req.query;
    let sql = `
      SELECT l.*, u.full_name as assigned_name, c.name as customer_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_user_id = u.id
      LEFT JOIN customers c ON l.customer_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ? OR l.lead_code LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'all') {
      sql += ` AND l.status = ?`;
      params.push(status);
    }

    if (priority && priority !== 'all') {
      sql += ` AND l.priority = ?`;
      params.push(priority);
    }

    if (source && source !== 'all') {
      sql += ` AND l.source = ?`;
      params.push(source);
    }

    sql += ` ORDER BY l.created_at DESC`;
    const leads = all(sql, params);
    res.json({ leads, total: leads.length });
  } catch (err: any) {
    console.error('Fetch leads error:', err);
    res.status(500).json({ error: 'Failed to retrieve leads.' });
  }
});

router.post('/leads', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, company, email, phone, source, requirement, estimated_value = 0, priority = 'Medium', assigned_user_id } = req.body;

    if (!name || !company || !email || !requirement) {
      res.status(400).json({ error: 'Name, Company, Email, and Requirement are required.' });
      return;
    }

    const codeNum = Math.floor(2000 + Math.random() * 8000);
    const lead_code = `LEAD-${codeNum}`;
    const now = new Date().toISOString();

    const tempLead = {
      estimated_value: parseFloat(estimated_value) || 0,
      priority,
      status: 'New',
      next_followup_at: null,
      last_contacted_at: null,
    };
    const { score } = computeLeadAttentionScore(tempLead);

    const result = run(
      `INSERT INTO leads (lead_code, name, company, email, phone, source, requirement, estimated_value, priority, assigned_user_id, status, attention_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?)`,
      [lead_code, name, company, email, phone || '', source || 'Website', requirement, parseFloat(estimated_value) || 0, priority, assigned_user_id || null, score, now, now]
    );

    const newLead = get('SELECT * FROM leads WHERE id = ?', [result.lastInsertRowid]);
    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Lead', result.lastInsertRowid, `Created lead ${name} (${company}) valued at $${estimated_value}`);

    if (assigned_user_id) {
      notifyUser(assigned_user_id, 'New Lead Assigned', `Lead ${name} (${company}) has been assigned to you.`, 'lead', '/leads');
    }

    res.status(201).json(newLead);
  } catch (err: any) {
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'Failed to create lead.' });
  }
});

router.put('/leads/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, company, email, phone, source, requirement, estimated_value, priority, assigned_user_id, status, next_followup_at } = req.body;

    const existing = get<any>('SELECT * FROM leads WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const updatedLeadData = {
      ...existing,
      estimated_value: estimated_value !== undefined ? parseFloat(estimated_value) : existing.estimated_value,
      priority: priority || existing.priority,
      status: status || existing.status,
      next_followup_at: next_followup_at !== undefined ? next_followup_at : existing.next_followup_at,
    };
    const { score } = computeLeadAttentionScore(updatedLeadData);
    const now = new Date().toISOString();

    run(
      `UPDATE leads 
       SET name = ?, company = ?, email = ?, phone = ?, source = ?, requirement = ?, estimated_value = ?, priority = ?, assigned_user_id = ?, status = ?, next_followup_at = ?, attention_score = ?, updated_at = ?
       WHERE id = ?`,
      [
        name || existing.name,
        company || existing.company,
        email || existing.email,
        phone !== undefined ? phone : existing.phone,
        source || existing.source,
        requirement || existing.requirement,
        parseFloat(estimated_value) || 0,
        priority || existing.priority,
        assigned_user_id !== undefined ? assigned_user_id : existing.assigned_user_id,
        status || existing.status,
        next_followup_at || null,
        score,
        now,
        id,
      ]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'UPDATED', 'Lead', id, `Updated lead ${existing.lead_code} - ${company}`);
    const updated = get('SELECT * FROM leads WHERE id = ?', [id]);
    res.json(updated);
  } catch (err: any) {
    console.error('Update lead error:', err);
    res.status(500).json({ error: 'Failed to update lead.' });
  }
});

// WORKFLOW 1 & 2: Qualify and Convert Lead
router.post('/leads/:id/qualify', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lead = get<any>('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const now = new Date().toISOString();
    run(`UPDATE leads SET status = 'Qualified', updated_at = ? WHERE id = ?`, [now, id]);
    logAudit(req.user?.id || null, req.user?.full_name || null, 'STATUS_CHANGED', 'Lead', id, `Qualified lead ${lead.name} (${lead.company})`);

    res.json({ message: 'Lead successfully marked as Qualified.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to qualify lead.' });
  }
});

router.post('/leads/:id/convert', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lead = get<any>('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const now = new Date().toISOString();
    let customerId = lead.customer_id;

    // 1. If not yet linked to customer, create customer record
    if (!customerId) {
      const codeNum = Math.floor(1000 + Math.random() * 9000);
      const custRes = run(
        `INSERT INTO customers (customer_code, name, company, email, phone, industry, status, assigned_user_id, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'Enterprise', 'Active', ?, ?, ?, ?)`,
        [`CUST-${codeNum}`, lead.name, lead.company, lead.email, lead.phone || '', lead.assigned_user_id, `Converted from lead ${lead.lead_code}`, now, now]
      );
      customerId = custRes.lastInsertRowid;
      logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Customer', customerId, `Auto-created customer from lead conversion (${lead.company})`);
    }

    // 2. Create Opportunity
    const oppNum = Math.floor(3000 + Math.random() * 7000);
    const oppRes = run(
      `INSERT INTO opportunities (opp_code, title, customer_id, lead_id, value, stage, probability, priority, assigned_user_id, expected_close_date, notes, stage_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'New', 25, ?, ?, date('now', '+30 days'), ?, ?, ?, ?)`,
      [
        `OPP-${oppNum}`,
        `${lead.company} - ${lead.requirement.slice(0, 35)}...`,
        customerId,
        lead.id,
        lead.estimated_value || 0,
        lead.priority || 'Medium',
        lead.assigned_user_id || req.user?.id,
        `Generated from lead qualification: ${lead.requirement}`,
        now,
        now,
        now,
      ]
    );

    const opportunityId = oppRes.lastInsertRowid;

    // 3. Update lead as Converted
    run(
      `UPDATE leads 
       SET status = 'Converted', customer_id = ?, opportunity_id = ?, updated_at = ? 
       WHERE id = ?`,
      [customerId, opportunityId, now, id]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CONVERTED', 'Lead', id, `Converted lead ${lead.name} to Opportunity OPP-${oppNum} and Customer #${customerId}`);

    // Notify assigned sales user
    if (lead.assigned_user_id) {
      notifyUser(lead.assigned_user_id, 'Lead Converted to Opportunity', `Lead ${lead.company} was converted. Opportunity OPP-${oppNum} is now in your pipeline.`, 'opportunity', '/pipeline');
    }

    res.json({
      message: 'Lead successfully converted to Customer and Opportunity!',
      customerId,
      opportunityId,
    });
  } catch (err: any) {
    console.error('Lead conversion error:', err);
    res.status(500).json({ error: 'Failed to convert lead.' });
  }
});

router.delete('/leads/:id', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = get<any>('SELECT * FROM leads WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    run('DELETE FROM leads WHERE id = ?', [id]);
    logAudit(req.user?.id || null, req.user?.full_name || null, 'DELETED', 'Lead', id, `Deleted lead ${existing.lead_code} (${existing.company})`);
    res.json({ message: 'Lead deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete lead.' });
  }
});

// ==========================================
// 4. SALES PIPELINE & OPPORTUNITIES
// ==========================================

router.get('/opportunities', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const opportunities = all(`
      SELECT o.*, c.name as customer_name, c.company as customer_company, c.email as customer_email, u.full_name as assigned_name,
        (SELECT count(*) FROM followups WHERE opportunity_id = o.id AND status = 'Pending') as pending_followups_count,
        (SELECT min(date) FROM followups WHERE opportunity_id = o.id AND status = 'Pending') as next_followup_date
      FROM opportunities o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.assigned_user_id = u.id
      ORDER BY o.value DESC
    `);
    res.json({ opportunities });
  } catch (err: any) {
    console.error('Fetch opportunities error:', err);
    res.status(500).json({ error: 'Failed to fetch opportunities.' });
  }
});

router.post('/opportunities', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, customer_id, lead_id, value, stage = 'New', probability = 20, priority = 'Medium', assigned_user_id, expected_close_date, notes } = req.body;

    if (!title || !customer_id) {
      res.status(400).json({ error: 'Title and Customer are required.' });
      return;
    }

    const codeNum = Math.floor(3000 + Math.random() * 7000);
    const opp_code = `OPP-${codeNum}`;
    const now = new Date().toISOString();

    const result = run(
      `INSERT INTO opportunities (opp_code, title, customer_id, lead_id, value, stage, probability, priority, assigned_user_id, expected_close_date, notes, stage_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opp_code,
        title,
        customer_id,
        lead_id || null,
        parseFloat(value) || 0,
        stage,
        parseInt(probability, 10) || 20,
        priority,
        assigned_user_id || req.user?.id,
        expected_close_date || null,
        notes || '',
        now,
        now,
        now,
      ]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Opportunity', result.lastInsertRowid, `Created Opportunity ${opp_code} - ${title} ($${value})`);
    const newOpp = get('SELECT * FROM opportunities WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(newOpp);
  } catch (err: any) {
    console.error('Create opportunity error:', err);
    res.status(500).json({ error: 'Failed to create opportunity.' });
  }
});

// WORKFLOW 1: Move Opportunity Stage in Pipeline
router.put('/opportunities/:id/stage', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { stage } = req.body;

    const validStages = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Converted'];
    if (!validStages.includes(stage)) {
      res.status(400).json({ error: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
      return;
    }

    const opp = get<any>('SELECT o.*, c.company FROM opportunities o JOIN customers c ON o.customer_id = c.id WHERE o.id = ?', [id]);
    if (!opp) {
      res.status(404).json({ error: 'Opportunity not found.' });
      return;
    }

    const oldStage = opp.stage;
    const now = new Date().toISOString();

    let newProb = opp.probability;
    if (stage === 'New') newProb = 20;
    else if (stage === 'Contacted') newProb = 40;
    else if (stage === 'Proposal') newProb = 60;
    else if (stage === 'Negotiation') newProb = 80;
    else if (stage === 'Converted') newProb = 100;

    run(
      `UPDATE opportunities 
       SET stage = ?, probability = ?, stage_changed_at = ?, updated_at = ? 
       WHERE id = ?`,
      [stage, newProb, now, now, id]
    );

    // Save interaction log in communications
    run(
      `INSERT INTO communications (customer_id, opportunity_id, user_id, type, subject, content, date, created_at)
       VALUES (?, ?, ?, 'Note', ?, ?, ?, ?)`,
      [opp.customer_id, id, req.user?.id, `Opportunity Stage Changed: ${oldStage} → ${stage}`, `Moved opportunity "${opp.title}" to ${stage}. Probability updated to ${newProb}%.`, now, now]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'STAGE_CHANGED', 'Opportunity', id, `Moved opportunity "${opp.title}" from ${oldStage} to ${stage}`);

    if (opp.assigned_user_id) {
      notifyUser(opp.assigned_user_id, 'Pipeline Stage Update', `Opportunity "${opp.title}" was moved to ${stage}.`, 'opportunity', '/pipeline');
    }

    res.json({ message: `Opportunity successfully moved to ${stage}.`, stage, probability: newProb });
  } catch (err: any) {
    console.error('Update stage error:', err);
    res.status(500).json({ error: 'Failed to update opportunity stage.' });
  }
});

// ==========================================
// 5. FOLLOW-UP AUTOMATION
// ==========================================

router.get('/followups', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, priority, date } = req.query;

    let sql = `
      SELECT f.*, c.name as customer_name, c.company as customer_company, c.email as customer_email, c.phone as customer_phone,
             u.full_name as assigned_name, o.title as opp_title, o.value as opp_value
      FROM followups f
      LEFT JOIN customers c ON f.customer_id = c.id
      LEFT JOIN users u ON f.assigned_user_id = u.id
      LEFT JOIN opportunities o ON f.opportunity_id = o.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      sql += ` AND f.status = ?`;
      params.push(status);
    }
    if (type && type !== 'all') {
      sql += ` AND f.type = ?`;
      params.push(type);
    }
    if (priority && priority !== 'all') {
      sql += ` AND f.priority = ?`;
      params.push(priority);
    }
    if (date) {
      sql += ` AND f.date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY f.date ASC, f.time ASC`;
    const followups = all<any>(sql, params);

    const todayStr = new Date().toISOString().split('T')[0];

    // Auto-identify overdue followups on retrieval
    for (const f of followups) {
      if (f.status === 'Pending' && f.date < todayStr) {
        f.status = 'Overdue';
        run(`UPDATE followups SET status = 'Overdue' WHERE id = ?`, [f.id]);
      }
    }

    const today = followups.filter(f => f.date === todayStr && f.status !== 'Completed');
    const overdue = followups.filter(f => f.status === 'Overdue' || (f.date < todayStr && f.status === 'Pending'));
    const upcoming = followups.filter(f => f.date > todayStr && f.status === 'Pending');
    const completed = followups.filter(f => f.status === 'Completed');

    res.json({
      all: followups,
      today,
      overdue,
      upcoming,
      completed,
      stats: {
        total: followups.length,
        todayCount: today.length,
        overdueCount: overdue.length,
        upcomingCount: upcoming.length,
        completedCount: completed.length,
      },
    });
  } catch (err: any) {
    console.error('Fetch followups error:', err);
    res.status(500).json({ error: 'Failed to retrieve follow-ups.' });
  }
});

router.post('/followups', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, lead_id, opportunity_id, date, time, type = 'Call', priority = 'Medium', notes, assigned_user_id } = req.body;

    if (!date || !time || !notes) {
      res.status(400).json({ error: 'Date, Time, and Notes are required to schedule a follow-up.' });
      return;
    }

    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];
    const initialStatus = date < todayStr ? 'Overdue' : 'Pending';

    const result = run(
      `INSERT INTO followups (customer_id, lead_id, opportunity_id, date, time, type, status, priority, notes, assigned_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id || null,
        lead_id || null,
        opportunity_id || null,
        date,
        time,
        type,
        initialStatus,
        priority,
        notes,
        assigned_user_id || req.user?.id,
        now,
        now,
      ]
    );

    // If linked to lead, update lead's next_followup_at
    if (lead_id) {
      run(`UPDATE leads SET next_followup_at = ? WHERE id = ?`, [date, lead_id]);
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Followup', result.lastInsertRowid, `Scheduled ${type} follow-up on ${date} at ${time}`);

    if (assigned_user_id) {
      notifyUser(assigned_user_id, 'Follow-up Scheduled', `New ${type} follow-up scheduled for ${date} at ${time}.`, 'followup', '/followups');
    }

    const newFup = get('SELECT * FROM followups WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(newFup);
  } catch (err: any) {
    console.error('Create followup error:', err);
    res.status(500).json({ error: 'Failed to schedule follow-up.' });
  }
});

router.post('/followups/:id/complete', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { outcomeNotes } = req.body;

    const fup = get<any>('SELECT * FROM followups WHERE id = ?', [id]);
    if (!fup) {
      res.status(404).json({ error: 'Follow-up not found.' });
      return;
    }

    const now = new Date().toISOString();
    run(`UPDATE followups SET status = 'Completed', completed_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);

    // WORKFLOW 4: Automatically log communication in customer timeline
    if (fup.customer_id) {
      const subject = `Completed Follow-up: ${fup.type}`;
      const content = outcomeNotes ? `${fup.notes}\n\nOutcome / Notes: ${outcomeNotes}` : fup.notes;
      run(
        `INSERT INTO communications (customer_id, lead_id, opportunity_id, user_id, type, subject, content, date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fup.customer_id, fup.lead_id, fup.opportunity_id, req.user?.id, fup.type, subject, content, now, now]
      );
    }

    // If lead linked, update last_contacted_at
    if (fup.lead_id) {
      run(`UPDATE leads SET last_contacted_at = ? WHERE id = ?`, [now, fup.lead_id]);
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'STATUS_CHANGED', 'Followup', id, `Marked follow-up #${id} as Completed`);
    res.json({ message: 'Follow-up marked as completed.' });
  } catch (err: any) {
    console.error('Complete followup error:', err);
    res.status(500).json({ error: 'Failed to mark follow-up completed.' });
  }
});

router.delete('/followups/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    run('DELETE FROM followups WHERE id = ?', [id]);
    res.json({ message: 'Follow-up deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete follow-up.' });
  }
});

// ==========================================
// 6. QUOTATIONS
// ==========================================

router.get('/quotations', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const quotations = all(`
      SELECT q.*, c.name as customer_name, c.company as customer_company, c.email as customer_email,
        (SELECT count(*) FROM quotation_items WHERE quotation_id = q.id) as items_count
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      ORDER BY q.created_at DESC
    `);
    res.json({ quotations });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch quotations.' });
  }
});

router.get('/quotations/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const quotation = get<any>(
      `SELECT q.*, c.name as customer_name, c.company as customer_company, c.email as customer_email, c.phone as customer_phone, c.address as customer_address
       FROM quotations q
       JOIN customers c ON q.customer_id = c.id
       WHERE q.id = ?`,
      [id]
    );

    if (!quotation) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }

    const items = all(`SELECT * FROM quotation_items WHERE quotation_id = ?`, [id]);
    res.json({ quotation, items });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch quotation details.' });
  }
});

router.post('/quotations', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, opportunity_id, valid_until, items = [], terms, discount = 0, tax = 0, status = 'Draft', notes } = req.body;

    if (!customer_id || !valid_until || !items || items.length === 0) {
      res.status(400).json({ error: 'Customer, Valid Until Date, and at least one line item are required.' });
      return;
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) * parseFloat(item.unit_price) || 0), 0);
    const discVal = parseFloat(discount) || 0;
    const taxVal = parseFloat(tax) || 0;
    const total = subtotal - discVal + taxVal;

    const codeNum = Math.floor(4000 + Math.random() * 6000);
    const quotation_number = `QUO-${codeNum}`;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    const qRes = run(
      `INSERT INTO quotations (quotation_number, customer_id, opportunity_id, date, valid_until, subtotal, discount, tax, total, terms, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotation_number,
        customer_id,
        opportunity_id || null,
        todayStr,
        valid_until,
        subtotal,
        discVal,
        taxVal,
        total,
        terms || 'Standard payment terms: 30 days net.',
        status,
        notes || '',
        now,
        now,
      ]
    );

    const quotationId = qRes.lastInsertRowid;

    for (const item of items) {
      const itemTot = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
      run(
        `INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [quotationId, item.product_id || null, item.description, parseInt(item.quantity, 10) || 1, parseFloat(item.unit_price) || 0, itemTot]
      );
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Quotation', quotationId, `Created quotation ${quotation_number} ($${total})`);
    res.status(201).json({ id: quotationId, quotation_number, total });
  } catch (err: any) {
    console.error('Create quotation error:', err);
    res.status(500).json({ error: 'Failed to create quotation.' });
  }
});

router.put('/quotations/:id/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    const valid = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
    if (!valid.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
      return;
    }

    const now = new Date().toISOString();
    run(`UPDATE quotations SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);

    logAudit(req.user?.id || null, req.user?.full_name || null, 'STATUS_CHANGED', 'Quotation', id, `Updated Quotation #${id} status to ${status}`);
    res.json({ message: `Quotation status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update quotation status.' });
  }
});

// WORKFLOW 5: Quotation accepted -> Convert to Order
router.post('/quotations/:id/convert-to-order', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const quote = get<any>('SELECT * FROM quotations WHERE id = ?', [id]);
    if (!quote) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }

    const items = all<any>('SELECT * FROM quotation_items WHERE quotation_id = ?', [id]);
    const orderNum = Math.floor(5000 + Math.random() * 5000);
    const order_number = `ORD-${orderNum}`;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    const ordRes = run(
      `INSERT INTO orders (order_number, customer_id, opportunity_id, quotation_id, order_date, subtotal, discount, tax, total, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?)`,
      [
        order_number,
        quote.customer_id,
        quote.opportunity_id || null,
        quote.id,
        todayStr,
        quote.subtotal,
        quote.discount,
        quote.tax,
        quote.total,
        `Created from accepted quotation ${quote.quotation_number}`,
        now,
        now,
      ]
    );

    const orderId = ordRes.lastInsertRowid;

    for (const item of items) {
      run(
        `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.description, item.quantity, item.unit_price, item.total]
      );
    }

    // Mark quotation accepted if not already
    run(`UPDATE quotations SET status = 'Accepted', updated_at = ? WHERE id = ?`, [now, id]);

    // If opportunity linked, mark opportunity as Converted
    if (quote.opportunity_id) {
      run(
        `UPDATE opportunities SET stage = 'Converted', probability = 100, stage_changed_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, quote.opportunity_id]
      );
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CONVERTED', 'Quotation', id, `Converted quotation ${quote.quotation_number} into Order ${order_number} ($${quote.total})`);

    res.json({
      message: `Quotation successfully converted to Order ${order_number}!`,
      orderId,
      order_number,
    });
  } catch (err: any) {
    console.error('Quotation to order conversion error:', err);
    res.status(500).json({ error: 'Failed to convert quotation to order.' });
  }
});

// ==========================================
// 7. ORDERS
// ==========================================

router.get('/orders', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = all(`
      SELECT o.*, c.name as customer_name, c.company as customer_company, c.email as customer_email,
        (SELECT count(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.order_date DESC
    `);
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

router.get('/orders/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const order = get<any>(
      `SELECT o.*, c.name as customer_name, c.company as customer_company, c.email as customer_email, c.phone as customer_phone, c.address as customer_address
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`,
      [id]
    );

    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const items = all(`SELECT * FROM order_items WHERE order_id = ?`, [id]);
    res.json({ order, items });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch order details.' });
  }
});

router.post('/orders', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, opportunity_id, quotation_id, items = [], discount = 0, tax = 0, status = 'Pending', notes } = req.body;

    if (!customer_id || !items || items.length === 0) {
      res.status(400).json({ error: 'Customer and at least one item are required.' });
      return;
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.quantity) * parseFloat(item.unit_price) || 0), 0);
    const discVal = parseFloat(discount) || 0;
    const taxVal = parseFloat(tax) || 0;
    const total = subtotal - discVal + taxVal;

    const orderNum = Math.floor(5000 + Math.random() * 5000);
    const order_number = `ORD-${orderNum}`;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    const ordRes = run(
      `INSERT INTO orders (order_number, customer_id, opportunity_id, quotation_id, order_date, subtotal, discount, tax, total, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_number,
        customer_id,
        opportunity_id || null,
        quotation_id || null,
        todayStr,
        subtotal,
        discVal,
        taxVal,
        total,
        status,
        notes || '',
        now,
        now,
      ]
    );

    const orderId = ordRes.lastInsertRowid;

    for (const item of items) {
      const itemTot = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
      run(
        `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id || null, item.description, parseInt(item.quantity, 10) || 1, parseFloat(item.unit_price) || 0, itemTot]
      );
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Order', orderId, `Created Order ${order_number} ($${total})`);
    res.status(201).json({ id: orderId, order_number, total });
  } catch (err: any) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

router.put('/orders/:id/status', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    const valid = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'];
    if (!valid.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${valid.join(', ')}` });
      return;
    }

    const now = new Date().toISOString();
    run(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);

    logAudit(req.user?.id || null, req.user?.full_name || null, 'STATUS_CHANGED', 'Order', id, `Updated Order #${id} status to ${status}`);
    res.json({ message: `Order status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// ==========================================
// 8. COMMUNICATIONS & TIMELINE
// ==========================================

router.get('/communications', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id } = req.query;
    let sql = `
      SELECT c.*, u.full_name as user_name, cust.company as customer_company 
      FROM communications c
      LEFT JOIN users u ON c.user_id = u.id
      JOIN customers cust ON c.customer_id = cust.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (customer_id) {
      sql += ` AND c.customer_id = ?`;
      params.push(customer_id);
    }
    sql += ` ORDER BY c.date DESC LIMIT 100`;

    const communications = all(sql, params);
    res.json({ communications });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch communications.' });
  }
});

router.post('/communications', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, lead_id, opportunity_id, type = 'Call', subject, content, date } = req.body;

    if (!customer_id || !subject || !content) {
      res.status(400).json({ error: 'Customer, Subject, and Content are required.' });
      return;
    }

    const now = new Date().toISOString();
    const interactionDate = date || now;

    const result = run(
      `INSERT INTO communications (customer_id, lead_id, opportunity_id, user_id, type, subject, content, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, lead_id || null, opportunity_id || null, req.user?.id, type, subject, content, interactionDate, now]
    );

    // Update customer updated_at
    run(`UPDATE customers SET updated_at = ? WHERE id = ?`, [now, customer_id]);

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Communication', result.lastInsertRowid, `Logged ${type} with customer #${customer_id}: ${subject}`);

    res.status(201).json({ message: 'Interaction logged successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to log communication.' });
  }
});

// ==========================================
// 9. FEEDBACK & SUPPORT
// ==========================================

router.get('/feedback', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const feedback = all(`
      SELECT fb.*, c.name as customer_name, c.company as customer_company
      FROM feedback fb
      JOIN customers c ON fb.customer_id = c.id
      ORDER BY fb.date DESC
    `);
    const avgRating = all('SELECT avg(rating) as avg_r FROM feedback')[0]?.avg_r || 0;
    res.json({ feedback, averageRating: parseFloat(avgRating.toFixed(1)) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve customer feedback.' });
  }
});

router.post('/feedback', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, rating, comments, category = 'General' } = req.body;
    if (!customer_id || !rating || !comments) {
      res.status(400).json({ error: 'Customer, Rating, and Comments are required.' });
      return;
    }

    const now = new Date().toISOString();
    const result = run(
      `INSERT INTO feedback (customer_id, rating, comments, category, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customer_id, parseInt(rating, 10), comments, category, now, now]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'Feedback', result.lastInsertRowid, `Logged ${rating}-star feedback for customer #${customer_id}`);
    res.status(201).json({ message: 'Feedback recorded successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save feedback.' });
  }
});

router.get('/support', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = all(`
      SELECT t.*, c.name as customer_name, c.company as customer_company, u.full_name as assigned_name
      FROM support_tickets t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.assigned_user_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.json({ tickets });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch support tickets.' });
  }
});

router.post('/support', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, subject, description, priority = 'Medium', assigned_user_id } = req.body;
    if (!customer_id || !subject || !description) {
      res.status(400).json({ error: 'Customer, Subject, and Description are required.' });
      return;
    }

    const codeNum = Math.floor(6000 + Math.random() * 4000);
    const ticket_number = `TIK-${codeNum}`;
    const now = new Date().toISOString();

    const result = run(
      `INSERT INTO support_tickets (ticket_number, customer_id, subject, description, priority, assigned_user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?)`,
      [ticket_number, customer_id, subject, description, priority, assigned_user_id || null, now, now]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'SupportTicket', result.lastInsertRowid, `Opened ticket ${ticket_number}: ${subject}`);

    if (assigned_user_id) {
      notifyUser(assigned_user_id, 'New Support Ticket Assigned', `Support ticket ${ticket_number} assigned to you.`, 'support', '/support');
    }

    res.status(201).json({ id: result.lastInsertRowid, ticket_number });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create support ticket.' });
  }
});

router.put('/support/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, resolution, priority, assigned_user_id } = req.body;

    const existing = get<any>('SELECT * FROM support_tickets WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    const now = new Date().toISOString();
    const resolved_at = (status === 'Resolved' || status === 'Closed') ? (existing.resolved_at || now) : null;

    run(
      `UPDATE support_tickets 
       SET status = ?, resolution = ?, priority = ?, assigned_user_id = ?, resolved_at = ?, updated_at = ?
       WHERE id = ?`,
      [status || existing.status, resolution !== undefined ? resolution : existing.resolution, priority || existing.priority, assigned_user_id !== undefined ? assigned_user_id : existing.assigned_user_id, resolved_at, now, id]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'UPDATED', 'SupportTicket', id, `Updated ticket ${existing.ticket_number} status to ${status}`);
    res.json({ message: 'Support ticket updated.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update ticket.' });
  }
});

// ==========================================
// 10. PRODUCTS & SERVICES
// ==========================================

router.get('/products', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const products = all('SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC');
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

// ==========================================
// 11. AI SALES ASSISTANT & INSIGHTS
// ==========================================

router.post('/ai/query', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query text is required.' });
      return;
    }

    const result = await askSalesAiAssistant(query, req.user);
    res.json(result);
  } catch (err: any) {
    console.error('AI assistant error:', err);
    res.status(500).json({ error: 'Failed to process AI query.' });
  }
});

router.get('/ai/customer-summary/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const summary = await generateCustomerSummary(id);
    res.json(summary);
  } catch (err: any) {
    console.error('Generate summary error:', err);
    res.status(500).json({ error: 'Failed to generate customer AI summary.' });
  }
});

router.get('/ai/followup-insights', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const insights = getAiFollowupInsights();
    res.json(insights);
  } catch (err: any) {
    console.error('Followup insights error:', err);
    res.status(500).json({ error: 'Failed to get follow-up insights.' });
  }
});

// ==========================================
// 12. EXECUTIVE DASHBOARD & ANALYTICS
// ==========================================

router.get('/analytics', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = 'all' } = req.query;

    // Real calculations from database
    const totalLeads = get<any>('SELECT count(*) as c FROM leads')?.c || 0;
    const convertedLeads = get<any>("SELECT count(*) as c FROM leads WHERE status = 'Converted'")?.c || 0;
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

    const totalCustomers = get<any>('SELECT count(*) as c FROM customers')?.c || 0;
    const activeOpps = get<any>("SELECT count(*) as c, sum(value) as val FROM opportunities WHERE stage != 'Converted'") || { c: 0, val: 0 };
    const wonOpps = get<any>("SELECT count(*) as c, sum(value) as val FROM opportunities WHERE stage = 'Converted'") || { c: 0, val: 0 };

    const totalSales = get<any>("SELECT COALESCE(sum(total), 0) as total FROM orders WHERE status = 'Completed'")?.total || 0;
    const completedOrdersCount = get<any>("SELECT count(*) as c FROM orders WHERE status = 'Completed'")?.c || 0;
    const averageDealSize = completedOrdersCount > 0 ? Math.round(totalSales / completedOrdersCount) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const pendingFollowups = get<any>("SELECT count(*) as c FROM followups WHERE status = 'Pending' AND date >= date('now')")?.c || 0;
    const overdueFollowups = get<any>("SELECT count(*) as c FROM followups WHERE status = 'Overdue' OR (status = 'Pending' AND date < date('now'))")?.c || 0;
    const completedFollowups = get<any>("SELECT count(*) as c FROM followups WHERE status = 'Completed'")?.c || 0;
    const totalFollowups = pendingFollowups + overdueFollowups + completedFollowups;
    const followupCompletionRate = totalFollowups > 0 ? Math.round((completedFollowups / totalFollowups) * 100) : 100;

    const openTickets = get<any>("SELECT count(*) as c FROM support_tickets WHERE status IN ('Open', 'In Progress')")?.c || 0;

    // Pipeline breakdown by stage
    const pipelineStages = [
      { stage: 'New', count: 0, value: 0 },
      { stage: 'Contacted', count: 0, value: 0 },
      { stage: 'Proposal', count: 0, value: 0 },
      { stage: 'Negotiation', count: 0, value: 0 },
      { stage: 'Converted', count: 0, value: 0 },
    ];
    const oppsByStage = all<any>('SELECT stage, count(*) as count, sum(value) as value FROM opportunities GROUP BY stage');
    oppsByStage.forEach(s => {
      const match = pipelineStages.find(p => p.stage === s.stage);
      if (match) {
        match.count = s.count;
        match.value = s.value || 0;
      }
    });

    // Lead sources breakdown
    const leadSources = all<any>('SELECT source, count(*) as count FROM leads GROUP BY source ORDER BY count DESC');

    // Sales by team member
    const salesByRep = all<any>(`
      SELECT u.id, u.full_name as name, u.role,
        (SELECT count(*) FROM leads WHERE assigned_user_id = u.id) as leads_count,
        (SELECT count(*) FROM opportunities WHERE assigned_user_id = u.id) as opps_count,
        (SELECT COALESCE(sum(value), 0) FROM opportunities WHERE assigned_user_id = u.id AND stage = 'Converted') as won_value,
        (SELECT count(*) FROM followups WHERE assigned_user_id = u.id AND status = 'Completed') as completed_followups
      FROM users u
      WHERE u.status = 'Active'
    `);

    // Product performance
    const productPerf = all<any>(`
      SELECT p.name, p.category, 
        COALESCE(sum(oi.quantity), 0) as quantity_sold,
        COALESCE(sum(oi.total), 0) as revenue,
        count(DISTINCT oi.order_id) as orders_count
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      GROUP BY p.id
      ORDER BY revenue DESC
    `);

    // Customer retention indicators
    const churnedCustomers = get<any>("SELECT count(*) as c FROM customers WHERE status = 'Churned'")?.c || 0;
    const activeCustomers = totalCustomers - churnedCustomers;
    const retentionRate = totalCustomers > 0 ? (((totalCustomers - churnedCustomers) / totalCustomers) * 100).toFixed(1) : 100;

    // At-Risk Customers List & Summary
    const atRiskList = all<any>(`
      SELECT c.id, c.customer_code, c.name, c.company, c.status, u.full_name as assigned_name,
        (SELECT count(*) FROM followups WHERE customer_id = c.id AND (status = 'Overdue' OR (status = 'Pending' AND date < date('now')))) as overdue_count,
        (SELECT count(*) FROM support_tickets WHERE customer_id = c.id AND status IN ('Open', 'In Progress')) as open_tickets_count,
        (SELECT max(date) FROM communications WHERE customer_id = c.id) as last_contact
      FROM customers c
      LEFT JOIN users u ON c.assigned_user_id = u.id
      WHERE c.status = 'Churned'
         OR (SELECT count(*) FROM followups WHERE customer_id = c.id AND (status = 'Overdue' OR (status = 'Pending' AND date < date('now')))) > 0
         OR (SELECT count(*) FROM support_tickets WHERE customer_id = c.id AND status IN ('Open', 'In Progress')) > 0
      ORDER BY overdue_count DESC, c.name ASC
      LIMIT 10
    `);
    const atRiskCustomersCount = get<any>(`
      SELECT count(*) as c
      FROM customers c
      WHERE c.status = 'Churned'
         OR (SELECT count(*) FROM followups WHERE customer_id = c.id AND (status = 'Overdue' OR (status = 'Pending' AND date < date('now')))) > 0
         OR (SELECT count(*) FROM support_tickets WHERE customer_id = c.id AND status IN ('Open', 'In Progress')) > 0
    `)?.c || 0;

    const sentimentCounts = get<any>(`
      SELECT count(*) as total,
        sum(CASE WHEN average_rating >= 4 THEN 1 ELSE 0 END) as positive,
        sum(CASE WHEN average_rating < 3 THEN 1 ELSE 0 END) as negative,
        sum(CASE WHEN average_rating >= 3 AND average_rating < 4 OR average_rating IS NULL THEN 1 ELSE 0 END) as neutral
      FROM (
        SELECT c.id, avg(f.rating) as average_rating
        FROM customers c
        LEFT JOIN feedback f ON f.customer_id = c.id
        GROUP BY c.id
      )
    `) || { total: 0, positive: 0, neutral: 0, negative: 0 };
    const sentimentTotal = sentimentCounts.total || 0;
    const customerSentiment = {
      positive: sentimentCounts.positive || 0,
      neutral: sentimentCounts.neutral || 0,
      negative: sentimentCounts.negative || 0,
      positivePercent: sentimentTotal ? Math.round((sentimentCounts.positive / sentimentTotal) * 100) : 0,
      neutralPercent: sentimentTotal ? Math.round((sentimentCounts.neutral / sentimentTotal) * 100) : 0,
      negativePercent: sentimentTotal ? Math.round((sentimentCounts.negative / sentimentTotal) * 100) : 0,
      total: sentimentTotal,
    };

    // Customer Segmentation breakdown
    const customerSegmentation = [
      { segment: 'High Value / VIP', count: get<any>("SELECT count(*) FROM customers WHERE status = 'VIP' OR id IN (SELECT customer_id FROM orders WHERE status = 'Completed' GROUP BY customer_id HAVING sum(total) >= 30000)")?.['count(*)'] || 0, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
      { segment: 'Growing Accounts', count: get<any>("SELECT count(DISTINCT customer_id) FROM opportunities WHERE stage IN ('Proposal', 'Negotiation')")?.['count(DISTINCT customer_id)'] || 0, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
      { segment: 'Active Standard', count: get<any>("SELECT count(*) FROM customers WHERE status = 'Active'")?.['count(*)'] || 0, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
      { segment: 'At-Risk Accounts', count: atRiskCustomersCount, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
      { segment: 'New Relationships', count: get<any>("SELECT count(*) FROM customers WHERE created_at >= date('now', '-30 days')")?.['count(*)'] || 0, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
    ];

    // Revenue Trends (by month for sales chart)
    const revenueTrends = all<any>(`
      SELECT strftime('%Y-%m', order_date) as month, sum(total) as revenue, count(*) as orders_count
      FROM orders
      WHERE status = 'Completed'
      GROUP BY month
      ORDER BY month ASC
    `);

    // Personal / Assigned Sales Executive Metrics for logged-in user
    const currentUserId = req.user?.id || 2;
    const myLeadsCount = get<any>('SELECT count(*) as c FROM leads WHERE assigned_user_id = ?', [currentUserId])?.c || 0;
    const myConvertedLeads = get<any>("SELECT count(*) as c FROM leads WHERE assigned_user_id = ? AND status = 'Converted'", [currentUserId])?.c || 0;
    const myConversionRate = myLeadsCount > 0 ? ((myConvertedLeads / myLeadsCount) * 100).toFixed(1) : '0';
    const myCustomersCount = get<any>('SELECT count(*) as c FROM customers WHERE assigned_user_id = ?', [currentUserId])?.c || 0;
    const myOppsData = get<any>("SELECT count(*) as count, COALESCE(sum(value), 0) as val FROM opportunities WHERE assigned_user_id = ? AND stage != 'Converted'", [currentUserId]) || { count: 0, val: 0 };
    const myWonRevenue = get<any>(`
      SELECT COALESCE(sum(o.total), 0) as total 
      FROM orders o 
      JOIN customers c ON o.customer_id = c.id 
      WHERE c.assigned_user_id = ? AND o.status = 'Completed'
    `, [currentUserId])?.total || 0;

    const myPendingFollowups = get<any>("SELECT count(*) as c FROM followups WHERE assigned_user_id = ? AND status = 'Pending' AND date >= date('now')", [currentUserId])?.c || 0;
    const myOverdueFollowups = get<any>("SELECT count(*) as c FROM followups WHERE assigned_user_id = ? AND (status = 'Overdue' OR (status = 'Pending' AND date < date('now')))", [currentUserId])?.c || 0;

    // My Assigned Risk Alerts
    const myRiskAlerts = all<any>(`
      SELECT c.id, c.name, c.company, c.status,
        (SELECT count(*) FROM followups WHERE customer_id = c.id AND (status = 'Overdue' OR (status = 'Pending' AND date < date('now')))) as overdue_fups,
        (SELECT count(*) FROM support_tickets WHERE customer_id = c.id AND status IN ('Open', 'In Progress')) as open_tickets
      FROM customers c
      WHERE c.assigned_user_id = ?
        AND (c.status = 'Churned' 
             OR (SELECT count(*) FROM followups WHERE customer_id = c.id AND (status = 'Overdue' OR (status = 'Pending' AND date < date('now')))) > 0
             OR (SELECT count(*) FROM support_tickets WHERE customer_id = c.id AND status IN ('Open', 'In Progress')) > 0)
      LIMIT 5
    `, [currentUserId]);

    // My Recent Customer Activity
    const myRecentActivity = all<any>(`
      SELECT comm.id, comm.customer_id, c.company, comm.type, comm.subject, comm.date
      FROM communications comm
      JOIN customers c ON comm.customer_id = c.id
      WHERE comm.user_id = ? OR c.assigned_user_id = ?
      ORDER BY comm.date DESC
      LIMIT 6
    `, [currentUserId, currentUserId]);

    // My Recommended Next Actions
    const myNextActions = [
      ...(myOverdueFollowups > 0 ? [{ id: 'act-1', priority: 'Urgent', action: `Clear ${myOverdueFollowups} overdue follow-up touchpoint(s) scheduled for your assigned accounts.`, link: 'followups' }] : []),
      { id: 'act-2', priority: 'High', action: 'Review active negotiation deals and verify contract terms with client champions.', link: 'pipeline' },
      { id: 'act-3', priority: 'Medium', action: 'Conduct 30-day touchpoint with newly qualified inbound leads.', link: 'leads' },
      { id: 'act-4', priority: 'Medium', action: 'Check Customer 360 profiles before upcoming calls to inspect ticket history and sentiment.', link: 'customers' }
    ];

    res.json({
      kpi: {
        totalLeads,
        activeOpportunities: activeOpps.c,
        pipelineValue: activeOpps.val || 0,
        convertedLeads,
        conversionRate,
        pendingFollowups,
        overdueFollowups,
        totalCustomers,
        totalSales,
        averageDealSize,
        openTickets,
        followupCompletionRate,
        retentionRate,
        atRiskCustomersCount,
      },
      pipelineStages,
      leadSources,
      salesByRep,
      productPerf,
      retention: {
        activeCustomers,
        churnedCustomers,
        retentionRate,
      },
      customerSentiment,
      atRiskCustomers: atRiskList,
      customerSegmentation,
      revenueTrends,
      executiveMetrics: {
        myCustomersCount,
        myLeadsCount,
        myActiveOppsCount: myOppsData.count,
        myPipelineValue: myOppsData.val,
        myRevenue: myWonRevenue,
        myConversionRate,
        myPendingFollowups,
        myOverdueFollowups,
        myRiskAlerts,
        myRecentActivity,
        myNextActions,
      },
    });
  } catch (err: any) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to calculate analytics.' });
  }
});

// ==========================================
// 13. GLOBAL SEARCH
// ==========================================

router.get('/search', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) {
      res.json({ customers: [], leads: [], opportunities: [], quotations: [], orders: [], tickets: [] });
      return;
    }

    const term = `%${q}%`;

    const customers = all(
      `SELECT id, customer_code as code, name, company, email, status FROM customers WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR customer_code LIKE ? LIMIT 6`,
      [term, term, term, term]
    );

    const leads = all(
      `SELECT id, lead_code as code, name, company, requirement, estimated_value, status FROM leads WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR lead_code LIKE ? LIMIT 6`,
      [term, term, term, term]
    );

    const opportunities = all(
      `SELECT o.id, o.opp_code as code, o.title, o.value, o.stage, c.company FROM opportunities o JOIN customers c ON o.customer_id = c.id WHERE o.title LIKE ? OR o.opp_code LIKE ? OR c.company LIKE ? LIMIT 6`,
      [term, term, term]
    );

    const quotations = all(
      `SELECT q.id, q.quotation_number as code, q.total, q.status, c.company FROM quotations q JOIN customers c ON q.customer_id = c.id WHERE q.quotation_number LIKE ? OR c.company LIKE ? LIMIT 6`,
      [term, term]
    );

    const orders = all(
      `SELECT ord.id, ord.order_number as code, ord.total, ord.status, c.company FROM orders ord JOIN customers c ON ord.customer_id = c.id WHERE ord.order_number LIKE ? OR c.company LIKE ? LIMIT 6`,
      [term, term]
    );

    const tickets = all(
      `SELECT t.id, t.ticket_number as code, t.subject, t.priority, t.status, c.company FROM support_tickets t JOIN customers c ON t.customer_id = c.id WHERE t.ticket_number LIKE ? OR t.subject LIKE ? OR c.company LIKE ? LIMIT 6`,
      [term, term, term]
    );

    res.json({
      customers,
      leads,
      opportunities,
      quotations,
      orders,
      tickets,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed.' });
  }
});

// ==========================================
// 14. NOTIFICATIONS
// ==========================================

router.get('/notifications', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = all(
      `SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 30`,
      [req.user?.id]
    );
    const unreadCount = notifications.filter((n: any) => n.is_read === 0).length;
    res.json({ notifications, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

router.post('/notifications/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

router.post('/notifications/read-all', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    run('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL', [req.user?.id]);
    res.json({ message: 'All notifications marked as read.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark all as read.' });
  }
});

// ==========================================
// 15. USERS & ROLES MANAGEMENT
// ==========================================

router.get('/users', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = all(`
      SELECT id, email, full_name, role, status, phone, avatar, created_at,
        (SELECT count(*) FROM leads WHERE assigned_user_id = users.id) as assigned_leads,
        (SELECT count(*) FROM customers WHERE assigned_user_id = users.id) as assigned_customers,
        (SELECT count(*) FROM opportunities WHERE assigned_user_id = users.id) as assigned_opps
      FROM users 
      ORDER BY full_name ASC
    `);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

router.post('/users', authenticate, requireRoles(['Sales Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, full_name, role = 'Sales Executive', phone } = req.body;
    if (!email || !password || !full_name || !phone) {
      res.status(400).json({ error: 'Email, Password, Full Name, and Phone are required.' });
      return;
    }
    const normalizedPhone = normalizePhone(String(phone));
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Enter a valid phone number with 7 to 15 digits.' });
      return;
    }
    if (!['Sales Manager', 'Sales Executive'].includes(role)) {
      res.status(400).json({ error: 'Only Sales Manager and Sales Executive accounts can be created here.' });
      return;
    }

    const existing = get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      res.status(400).json({ error: 'A user with this email address already exists.' });
      return;
    }
    const duplicatePhone = all<any>('SELECT phone, phone_normalized FROM users').some((account) =>
      account.phone_normalized === normalizedPhone || normalizePhone(account.phone || '') === normalizedPhone
    );
    if (duplicatePhone) {
      res.status(400).json({ error: 'Another account already uses this phone number.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const result = run(
      `INSERT INTO users (email, password_hash, full_name, role, status, phone, phone_normalized, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
      [email.trim().toLowerCase(), passwordHash, full_name, role, phone.trim(), normalizedPhone, now, now]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'CREATED', 'User', result.lastInsertRowid, `Created new user ${full_name} (${role})`);
    res.status(201).json({ id: result.lastInsertRowid, email, full_name, role });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

router.put('/users/:id', authenticate, requireRoles(['Sales Manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { email, full_name, role, status, phone, password } = req.body;

    const existing = get<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const now = new Date().toISOString();
    let passHash = existing.password_hash;
    const updatedEmail = String(email || existing.email).trim().toLowerCase();
    const updatedRole = role || existing.role;
    const updatedPhone = phone !== undefined ? String(phone) : existing.phone;
    const normalizedPhone = normalizePhone(updatedPhone || '');
    if (!normalizedPhone) {
      res.status(400).json({ error: 'Enter a valid phone number with 7 to 15 digits.' });
      return;
    }
    const duplicatePhone = all<any>('SELECT id, phone, phone_normalized FROM users WHERE id != ?', [id]).some((account) =>
      account.phone_normalized === normalizedPhone || normalizePhone(account.phone || '') === normalizedPhone
    );
    if (duplicatePhone) {
      res.status(400).json({ error: 'Another account already uses this phone number.' });
      return;
    }

    const customerRecord = get<any>('SELECT id, phone FROM customers WHERE lower(email) = ?', [updatedEmail]);
    let customerId: number | null = null;
    if (updatedRole === 'Customer') {
      if (!customerRecord || normalizePhone(customerRecord.phone || '') !== normalizedPhone) {
        res.status(400).json({ error: 'To link a Customer account, email and phone must match a registered customer profile.' });
        return;
      }
      customerId = customerRecord.id;
    } else if (customerRecord) {
      res.status(400).json({ error: 'This email is registered as a customer and cannot be assigned to a staff role.' });
      return;
    }
    if (password && password.trim().length > 0) {
      passHash = await bcrypt.hash(password, 10);
    }

    run(
      `UPDATE users 
        SET email = ?, full_name = ?, role = ?, status = ?, phone = ?, phone_normalized = ?, customer_id = ?, password_hash = ?, updated_at = ?
       WHERE id = ?`,
          [updatedEmail, full_name || existing.full_name, updatedRole, status || existing.status, updatedPhone, normalizedPhone, customerId, passHash, now, id]
    );

    logAudit(req.user?.id || null, req.user?.full_name || null, 'UPDATED', 'User', id, `Updated user profile for ${full_name || existing.full_name}`);
    res.json({ message: 'User updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// ==========================================
// 16. AUDIT LOGS
// ==========================================

router.get('/audit-logs', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = all(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

export default router;
