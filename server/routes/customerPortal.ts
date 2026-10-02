import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { all, get, run } from '../db/database.ts';
import { AuthenticatedRequest, authenticate, requireRoles } from '../middleware/auth.ts';
import { logAudit, notifyUser } from '../services/auditService.ts';
import { normalizePhone } from '../utils/phone.ts';
import { sendManagerDueReminders, getOverdueInvoiceReminders, sendSpecificOverdueReminder } from '../services/customerReminderService.ts';
import { hasCustomerEmailDelivery } from '../services/emailService.ts';

const router = express.Router();
const receiptDirectory = process.env.INSIGHT360_RECEIPT_DIR
  ? path.resolve(process.env.INSIGHT360_RECEIPT_DIR)
  : path.resolve(process.cwd(), 'data', 'payment-receipts');
const allowedReceipts: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const maximumReceiptSize = 3 * 1024 * 1024;

function requireCustomer(req: AuthenticatedRequest, res: Response, next: express.NextFunction): void {
  if (req.user?.role !== 'Customer' || !req.user.customer_id) {
    res.status(403).json({ error: 'A linked customer account is required.' });
    return;
  }
  next();
}

function currentCustomerId(req: AuthenticatedRequest): number {
  return Number(req.user?.customer_id);
}

function getCustomerInvoices(customerId: number): any[] {
  return all<any>(`
    SELECT i.*,
      COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'Verified'), 0) as paid_amount
    FROM invoices i
    WHERE i.customer_id = ?
    ORDER BY i.due_date DESC
  `, [customerId]).map((invoice) => ({
    ...invoice,
    outstanding_amount: Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)),
  }));
}

function customerDashboard(customerId: number, userId: number): any {
  const customer = get<any>(
    'SELECT id, customer_code, name, email, phone, company, address, industry, created_at FROM customers WHERE id = ?',
    [customerId]
  );
  if (!customer) return null;

  const invoices = getCustomerInvoices(customerId);
  const payments = all<any>(`
    SELECT p.id, p.invoice_id, i.invoice_number, p.amount, p.payment_method, p.transaction_id,
      p.payment_date, p.status, p.submitted_at, p.verified_at, p.rejection_reason,
      r.id as receipt_id, r.file_name as receipt_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    LEFT JOIN payment_receipts r ON r.payment_id = p.id
    WHERE p.customer_id = ?
    ORDER BY p.submitted_at DESC
  `, [customerId]);
  const supportTickets = all<any>(`
    SELECT id, ticket_number, subject, description, status, created_at, updated_at
    FROM support_tickets WHERE customer_id = ? ORDER BY updated_at DESC
  `, [customerId]);
  const orders = all<any>(`
    SELECT o.id, o.order_number, o.order_date, o.total, o.status,
      (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
      i.id as invoice_id, i.invoice_number, i.due_date,
      CASE WHEN i.id IS NULL THEN 0 ELSE MAX(0, i.amount - COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'Verified'), 0)) END as outstanding_amount
    FROM orders o
    LEFT JOIN invoices i ON i.order_id = o.id
    WHERE o.customer_id = ?
    ORDER BY o.order_date DESC
  `, [customerId]);
  const orderRequests = all<any>(`
    SELECT r.id, r.request_number, r.subtotal, r.tax, r.total, r.customer_notes,
      r.sales_terms, r.status, r.resolution_note, r.created_at, r.updated_at,
      r.order_id, o.order_number, i.id as invoice_id, i.invoice_number,
      (SELECT count(*) FROM customer_order_request_items ri WHERE ri.request_id = r.id) as item_count
    FROM customer_order_requests r
    LEFT JOIN orders o ON o.id = r.order_id
    LEFT JOIN invoices i ON i.order_id = o.id
    WHERE r.customer_id = ?
    ORDER BY r.created_at DESC
  `, [customerId]);
  const notifications = all<any>(`
    SELECT id, title, message, type, is_read, created_at
    FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `, [userId]);
  const usage = all<any>(`
    SELECT id, active_days, sessions, features_used, usage_date
    FROM product_usage WHERE customer_id = ? ORDER BY usage_date DESC LIMIT 12
  `, [customerId]).map((row) => {
    let features: string[] = [];
    try {
      features = JSON.parse(row.features_used || '[]');
    } catch {
      features = [];
    }
    return { ...row, features_used: features };
  });

  const verifiedPayments = payments.filter((payment) => payment.status === 'Verified');
  const totalPaid = verifiedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstandingAmount = invoices.reduce((sum, invoice) => sum + invoice.outstanding_amount, 0);
  const openTickets = supportTickets.filter((ticket) => ['Open', 'In Progress'].includes(ticket.status));
  const resolvedTickets = supportTickets.filter((ticket) => ['Resolved', 'Closed'].includes(ticket.status));
  const lastPayment = verifiedPayments[0] || null;
  const averageFeedback = Number(get<any>('SELECT avg(rating) as score FROM feedback WHERE customer_id = ?', [customerId])?.score || 0);
  const latestUsage = usage[0];
  const relationshipScore = Math.min(
    100,
    Math.round(Math.min(Number(latestUsage?.active_days || 0), 30) + Math.min(Number(latestUsage?.sessions || 0), 30) + averageFeedback * 8)
  );

  const activities = [
    ...all<any>(`SELECT activity_type as type, description, created_at FROM customer_activity WHERE customer_id = ?`, [customerId]),
    ...all<any>(`SELECT 'Invoice' as type, 'Invoice ' || invoice_number || ' generated.' as description, created_at FROM invoices WHERE customer_id = ?`, [customerId]),
    ...all<any>(`SELECT 'Payment' as type, 'Payment ' || status || ' for Invoice ' || (SELECT invoice_number FROM invoices WHERE id = invoice_id) || '.' as description, submitted_at as created_at FROM payments WHERE customer_id = ?`, [customerId]),
    ...all<any>(`SELECT 'Support' as type, 'Support ticket ' || ticket_number || ' updated.' as description, updated_at as created_at FROM support_tickets WHERE customer_id = ?`, [customerId]),
    ...all<any>(`SELECT type as type, subject as description, date as created_at FROM communications WHERE customer_id = ?`, [customerId]),
  ].sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))).slice(0, 30);

  const accountUser = get<any>('SELECT last_login_at FROM users WHERE id = ?', [userId]);
  return {
    profile: {
      customerCode: customer.customer_code,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      address: customer.address,
      industry: customer.industry,
      customerSince: customer.created_at,
      lastLogin: accountUser?.last_login_at || null,
    },
    metrics: {
      outstandingAmount,
      totalPaid,
      invoiceCount: invoices.length,
      openTickets: openTickets.length,
      resolvedTickets: resolvedTickets.length,
      lastPayment: lastPayment ? { amount: lastPayment.amount, date: lastPayment.payment_date } : null,
      relationshipScore,
    },
    invoices,
    orders,
    orderRequests,
    payments,
    supportTickets,
    notifications,
    activities,
    usage,
  };
}

function getReceipt(paymentId: number, customerId?: number): any {
  const params: number[] = [paymentId];
  let sql = `SELECT r.* FROM payment_receipts r JOIN payments p ON p.id = r.payment_id WHERE p.id = ?`;
  if (customerId !== undefined) {
    sql += ' AND p.customer_id = ?';
    params.push(customerId);
  }
  return get<any>(sql, params);
}

function sendReceipt(receipt: any, res: Response): void {
  if (!receipt) {
    res.status(404).json({ error: 'Receipt not found.' });
    return;
  }
  const safeName = path.basename(receipt.file_name).replace(/["\r\n]/g, '_');
  const filePath = path.resolve(receiptDirectory, path.basename(receipt.file_path));
  if (!filePath.startsWith(`${receiptDirectory}${path.sep}`) || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Receipt file is unavailable.' });
    return;
  }
  res.type(receipt.file_type);
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.sendFile(filePath);
}

router.get('/customer/dashboard', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const dashboard = customerDashboard(currentCustomerId(req), Number(req.user?.id));
  if (!dashboard) {
    res.status(404).json({ error: 'Customer profile not found.' });
    return;
  }
  res.json(dashboard);
});

router.put('/customer/profile', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = currentCustomerId(req);
    const userId = Number(req.user?.id);
    const existing = get<any>('SELECT * FROM customers WHERE id = ?', [customerId]);
    const account = get<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing || !account) {
      res.status(404).json({ error: 'Customer profile not found.' });
      return;
    }

    const name = String(req.body.name ?? existing.name).trim();
    const email = String(req.body.email ?? existing.email).trim().toLowerCase();
    const phone = String(req.body.phone ?? existing.phone).trim();
    const address = String(req.body.address ?? existing.address ?? '').trim();
    const normalizedPhone = normalizePhone(phone);
    if (!name || !email.includes('@') || !normalizedPhone) {
      res.status(400).json({ error: 'Enter a valid name, email, and phone number.' });
      return;
    }
    const duplicateEmail = get<any>('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    const duplicatePhone = all<any>('SELECT id, phone, phone_normalized FROM users WHERE id != ?', [userId]).some((user) =>
      user.phone_normalized === normalizedPhone || normalizePhone(user.phone || '') === normalizedPhone
    );
    if (duplicateEmail || duplicatePhone) {
      res.status(400).json({ error: duplicateEmail ? 'Another account already uses this email.' : 'Another account already uses this phone number.' });
      return;
    }

    const now = new Date().toISOString();
    run('UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?', [name, email, phone, address, now, customerId]);
    run('UPDATE users SET full_name = ?, email = ?, phone = ?, phone_normalized = ?, updated_at = ? WHERE id = ?', [name, email, phone, normalizedPhone, now, userId]);
    run('INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, ?, ?, ?)', [customerId, 'Profile', 'Customer profile details updated.', now]);
    res.json({ profile: customerDashboard(customerId, userId)?.profile });
  } catch (err) {
    res.status(500).json({ error: 'Could not update the customer profile.' });
  }
});

router.put('/customer/password', authenticate, requireCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = Number(req.user?.id);
    const { currentPassword, newPassword } = req.body;
    const account = get<any>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!account || !currentPassword || !newPassword || String(newPassword).length < 8) {
      res.status(400).json({ error: 'Enter your current password and a new password with at least 8 characters.' });
      return;
    }
    if (!await bcrypt.compare(currentPassword, account.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, new Date().toISOString(), userId]);
    res.json({ message: 'Password updated.' });
  } catch {
    res.status(500).json({ error: 'Could not update the password.' });
  }
});

router.get('/customer/products', authenticate, requireCustomer, (_req: AuthenticatedRequest, res: Response) => {
  try {
    const products = all<any>('SELECT id, name, sku, category, unit_price, description FROM products WHERE is_active = 1 ORDER BY category, name');
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Could not load products catalog.' });
  }
});

router.post('/customer/order-requests', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = currentCustomerId(req);
    const { items, notes = '' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Please select at least one item to order.' });
      return;
    }

    const customer = get<any>('SELECT id, name, company, assigned_user_id FROM customers WHERE id = ?', [customerId]);
    if (!customer) {
      res.status(404).json({ error: 'Customer record not found.' });
      return;
    }

    let subtotal = 0;
    const validatedItems: Array<{ product_id: number; description: string; quantity: number; unit_price: number; total: number }> = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
        res.status(400).json({ error: 'Quantity must be a whole number between 1 and 500.' });
        return;
      }
      const product = get<any>('SELECT id, name, unit_price FROM products WHERE id = ? AND is_active = 1', [productId]);
      if (!product) {
        res.status(400).json({ error: `Selected product ID ${productId} is unavailable.` });
        return;
      }
      const unitPrice = Number(product.unit_price) || 0;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      validatedItems.push({
        product_id: product.id,
        description: product.name,
        quantity: qty,
        unit_price: unitPrice,
        total: lineTotal,
      });
    }

    const discount = 0;
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const requestNumber = `REQ-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 90 + 10)}`;
    const now = new Date().toISOString();
    const requestResult = run(
      `INSERT INTO customer_order_requests (request_number, customer_id, assigned_user_id, subtotal, discount, tax, total, customer_notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Approval', ?, ?)`,
      [requestNumber, customerId, customer.assigned_user_id || null, subtotal, discount, tax, total, String(notes || '').trim().slice(0, 500), now, now]
    );

    for (const item of validatedItems) {
      run(
        `INSERT INTO customer_order_request_items (request_id, product_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [requestResult.lastInsertRowid, item.product_id, item.description, item.quantity, item.unit_price, item.total]
      );
    }

    run(
      `INSERT INTO customer_activity (customer_id, activity_type, description, created_at)
       VALUES (?, 'Order', ?, ?)`,
      [customerId, `Order request ${requestNumber} submitted for ${validatedItems.length} item(s), awaiting sales approval.`, now]
    );

    notifyUser(
      Number(req.user?.id),
      'Order Request Submitted',
      `Request ${requestNumber} for ${total} is waiting for your sales representative to review the terms.`,
      'order',
      '/customer/orders'
    );

    const assignedRep = customer.assigned_user_id
      ? get<any>('SELECT id FROM users WHERE id = ? AND status = \'Active\'', [customer.assigned_user_id])
      : null;
    const reviewers = assignedRep
      ? [assignedRep]
      : all<any>("SELECT id FROM users WHERE role = 'Sales Manager' AND status = 'Active'");
    for (const reviewer of reviewers) {
      notifyUser(
        reviewer.id,
        'Customer Order Request',
        `${customer.name} (${customer.company}) requested ${validatedItems.length} item(s), estimated at ${total}. Review the terms before confirming.`,
        'order',
        '/order-requests'
      );
    }

    logAudit(req.user?.id || null, req.user?.full_name || null, 'ORDER_REQUESTED', 'CustomerOrderRequest', requestResult.lastInsertRowid, `Customer requested ${requestNumber} for total ${total}`);

    res.status(201).json({
      message: 'Order request sent to your sales representative for approval.',
      request: {
        id: requestResult.lastInsertRowid,
        request_number: requestNumber,
        total,
        item_count: validatedItems.length,
        status: 'Pending Approval',
      },
    });
  } catch (err: any) {
    console.error('Customer order request error:', err);
    res.status(500).json({ error: 'Could not submit your order request.' });
  }
});

router.get('/sales/order-requests', authenticate, requireRoles(['Sales Manager', 'Sales Executive']), (req: AuthenticatedRequest, res: Response) => {
  const isManager = req.user?.role === 'Sales Manager';
  const requests = all<any>(`
    SELECT r.id, r.request_number, r.customer_id, r.assigned_user_id, r.subtotal, r.tax, r.total,
      r.customer_notes, r.sales_terms, r.status, r.resolution_note, r.order_id,
      r.created_at, r.updated_at, c.customer_code, c.name as customer_name,
      c.company as customer_company, c.email as customer_email,
      (SELECT count(*) FROM customer_order_request_items i WHERE i.request_id = r.id) as item_count
    FROM customer_order_requests r
    JOIN customers c ON c.id = r.customer_id
    WHERE (? = 1 OR r.assigned_user_id = ?)
    ORDER BY CASE r.status WHEN 'Pending Approval' THEN 0 ELSE 1 END, r.created_at DESC
  `, [isManager ? 1 : 0, req.user?.id]);
  res.json({ requests });
});

router.get('/sales/order-requests/:id', authenticate, requireRoles(['Sales Manager', 'Sales Executive']), (req: AuthenticatedRequest, res: Response) => {
  const requestId = Number(req.params.id);
  const isManager = req.user?.role === 'Sales Manager';
  const orderRequest = get<any>(`
    SELECT r.*, c.customer_code, c.name as customer_name, c.company as customer_company,
      c.email as customer_email, c.phone as customer_phone
    FROM customer_order_requests r
    JOIN customers c ON c.id = r.customer_id
    WHERE r.id = ? AND (? = 1 OR r.assigned_user_id = ?)
  `, [requestId, isManager ? 1 : 0, req.user?.id]);
  if (!orderRequest) {
    res.status(404).json({ error: 'Order request not found in your assigned queue.' });
    return;
  }
  const items = all<any>(`SELECT id, product_id, description, quantity, unit_price, total FROM customer_order_request_items WHERE request_id = ? ORDER BY id`, [requestId]);
  res.json({ request: orderRequest, items });
});

router.put('/sales/order-requests/:id/approve', authenticate, requireRoles(['Sales Manager', 'Sales Executive']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestId = Number(req.params.id);
    const isManager = req.user?.role === 'Sales Manager';
    const orderRequest = get<any>(`
      SELECT r.*, c.name as customer_name, c.company as customer_company
      FROM customer_order_requests r JOIN customers c ON c.id = r.customer_id
      WHERE r.id = ? AND (? = 1 OR r.assigned_user_id = ?)
    `, [requestId, isManager ? 1 : 0, req.user?.id]);
    if (!orderRequest) {
      res.status(404).json({ error: 'Order request not found in your assigned queue.' });
      return;
    }
    if (orderRequest.status !== 'Pending Approval' || orderRequest.order_id) {
      res.status(409).json({ error: 'This order request has already been reviewed.' });
      return;
    }

    const items = all<any>(`SELECT product_id, description, quantity, unit_price, total FROM customer_order_request_items WHERE request_id = ? ORDER BY id`, [requestId]);
    if (!items.length) {
      res.status(400).json({ error: 'This order request has no items to approve.' });
      return;
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    let orderNumber = `ORD-${Date.now().toString().slice(-8)}`;
    while (get('SELECT id FROM orders WHERE order_number = ?', [orderNumber])) {
      orderNumber = `ORD-${Math.floor(10000000 + Math.random() * 89999999)}`;
    }
    const orderNote = [
      `Approved from ${orderRequest.request_number}.`,
      orderRequest.customer_notes ? `Customer request: ${orderRequest.customer_notes}` : '',
      String(req.body.salesTerms || '').trim() ? `Approved terms: ${String(req.body.salesTerms).trim().slice(0, 1000)}` : '',
    ].filter(Boolean).join('\n');
    const orderResult = run(
      `INSERT INTO orders (order_number, customer_id, order_date, subtotal, discount, tax, total, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?)`,
      [orderNumber, orderRequest.customer_id, today, orderRequest.subtotal, orderRequest.discount || 0, orderRequest.tax, orderRequest.total, orderNote, now, now]
    );
    for (const item of items) {
      run(
        `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderResult.lastInsertRowid, item.product_id, item.description, item.quantity, item.unit_price, item.total]
      );
    }

    const invoiceNumber = `INV-${orderNumber}`;
    const invoiceResult = run(
      `INSERT INTO invoices (customer_id, order_id, invoice_number, amount, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'Unpaid', ?)`,
      [orderRequest.customer_id, orderResult.lastInsertRowid, invoiceNumber, orderRequest.total, dueDate, now]
    );
    const salesTerms = String(req.body.salesTerms || '').trim().slice(0, 1000);
    const resolutionNote = String(req.body.resolutionNote || salesTerms || 'Order terms approved.').trim().slice(0, 1000);
    run(
      `UPDATE customer_order_requests SET status = 'Approved', sales_terms = ?, resolution_note = ?, order_id = ?, updated_at = ?, resolved_at = ? WHERE id = ? AND status = 'Pending Approval'`,
      [salesTerms, resolutionNote, orderResult.lastInsertRowid, now, now, requestId]
    );
    run(
      `INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, 'Order', ?, ?)`,
      [orderRequest.customer_id, `Order request ${orderRequest.request_number} approved as ${orderNumber}; invoice ${invoiceNumber} is ready.`, now]
    );
    for (const customerUser of all<any>('SELECT id FROM users WHERE customer_id = ?', [orderRequest.customer_id])) {
      notifyUser(customerUser.id, 'Order Request Approved', `Your request ${orderRequest.request_number} is approved as ${orderNumber}. Invoice ${invoiceNumber} is ready to review and pay.`, 'order', '/customer/orders');
    }
    logAudit(req.user?.id || null, req.user?.full_name || null, 'ORDER_REQUEST_APPROVED', 'CustomerOrderRequest', requestId, `Approved ${orderRequest.request_number} as ${orderNumber}; invoice ${invoiceNumber}`);

    res.json({
      message: 'Order request approved. Order and invoice created.',
      request: { id: requestId, status: 'Approved', order_id: orderResult.lastInsertRowid },
      order: { id: orderResult.lastInsertRowid, order_number: orderNumber, total: orderRequest.total },
      invoice: { id: invoiceResult.lastInsertRowid, invoice_number: invoiceNumber, due_date: dueDate },
    });
  } catch (err: any) {
    console.error('Approve customer order request failed:', err);
    res.status(500).json({ error: 'Could not approve the order request.' });
  }
});

router.put('/sales/order-requests/:id/reject', authenticate, requireRoles(['Sales Manager', 'Sales Executive']), (req: AuthenticatedRequest, res: Response) => {
  const requestId = Number(req.params.id);
  const isManager = req.user?.role === 'Sales Manager';
  const orderRequest = get<any>(`
    SELECT id, customer_id, request_number, status FROM customer_order_requests
    WHERE id = ? AND (? = 1 OR assigned_user_id = ?)
  `, [requestId, isManager ? 1 : 0, req.user?.id]);
  if (!orderRequest) {
    res.status(404).json({ error: 'Order request not found in your assigned queue.' });
    return;
  }
  if (orderRequest.status !== 'Pending Approval') {
    res.status(409).json({ error: 'This order request has already been reviewed.' });
    return;
  }
  const reason = String(req.body.reason || '').trim();
  if (!reason) {
    res.status(400).json({ error: 'Provide a reason for rejecting this request.' });
    return;
  }
  const now = new Date().toISOString();
  run(`UPDATE customer_order_requests SET status = 'Rejected', resolution_note = ?, updated_at = ?, resolved_at = ? WHERE id = ? AND status = 'Pending Approval'`, [reason.slice(0, 1000), now, now, requestId]);
  run(`INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, 'Order', ?, ?)`, [orderRequest.customer_id, `Order request ${orderRequest.request_number} was not approved.`, now]);
  for (const customerUser of all<any>('SELECT id FROM users WHERE customer_id = ?', [orderRequest.customer_id])) {
    notifyUser(customerUser.id, 'Order Request Update', `Your request ${orderRequest.request_number} was not approved. ${reason}`, 'order', '/customer/orders');
  }
  logAudit(req.user?.id || null, req.user?.full_name || null, 'ORDER_REQUEST_REJECTED', 'CustomerOrderRequest', requestId, `Rejected ${orderRequest.request_number}: ${reason}`);
  res.json({ message: 'Order request rejected.', status: 'Rejected' });
});

router.get('/customer/invoices', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  res.json({ invoices: getCustomerInvoices(currentCustomerId(req)) });
});

router.get('/customer/invoices/:id', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const invoice = getCustomerInvoices(currentCustomerId(req)).find((item) => item.id === Number(req.params.id));
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }
  res.json({ invoice });
});

router.get('/customer/payments', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const dashboard = customerDashboard(currentCustomerId(req), Number(req.user?.id));
  res.json({ payments: dashboard?.payments || [] });
});

router.post('/customer/payments', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  let uploadedPath = '';
  try {
    const customerId = currentCustomerId(req);
    const invoiceId = Number(req.body.invoiceId);
    const amount = Number(req.body.amount);
    const transactionId = String(req.body.transactionId || '').trim();
    const paymentDate = String(req.body.paymentDate || '').trim();
    const paymentMethod = req.body.paymentMethod === 'QR Code' ? 'QR Code' : 'UPI';
    const receipt = req.body.receipt;
    const invoice = get<any>('SELECT * FROM invoices WHERE id = ? AND customer_id = ?', [invoiceId, customerId]);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const paidAmount = get<any>("SELECT COALESCE(sum(amount), 0) as total FROM payments WHERE invoice_id = ? AND status = 'Verified'", [invoiceId])?.total || 0;
    const remainingAmount = Math.max(0, Number(invoice.amount) - Number(paidAmount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > remainingAmount) {
      res.status(400).json({ error: `Payment amount must be greater than zero and no more than ${remainingAmount.toFixed(2)}.` });
      return;
    }
    if (!transactionId || transactionId.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) || Number.isNaN(Date.parse(paymentDate))) {
      res.status(400).json({ error: 'A transaction ID and valid payment date are required.' });
      return;
    }
    if (paymentDate > new Date().toISOString().slice(0, 10)) {
      res.status(400).json({ error: 'Payment date cannot be in the future.' });
      return;
    }
    if (!receipt?.fileName || !allowedReceipts[receipt.mimeType] || !receipt.base64) {
      res.status(400).json({ error: 'Upload a PDF, JPG, JPEG, or PNG payment receipt.' });
      return;
    }
    if (get<any>("SELECT id FROM payments WHERE invoice_id = ? AND status IN ('Verification Pending', 'Under Review')", [invoiceId])) {
      res.status(409).json({ error: 'A payment for this invoice is already awaiting verification.' });
      return;
    }

    const fileBuffer = Buffer.from(String(receipt.base64).split(',').pop() || '', 'base64');
    if (!fileBuffer.length || fileBuffer.length > maximumReceiptSize) {
      res.status(400).json({ error: 'Receipt must be no larger than 3 MB.' });
      return;
    }

    fs.mkdirSync(receiptDirectory, { recursive: true });
    const extension = allowedReceipts[receipt.mimeType];
    const storedFileName = `${randomUUID()}${extension}`;
    uploadedPath = path.join(receiptDirectory, storedFileName);
    fs.writeFileSync(uploadedPath, fileBuffer, { flag: 'wx' });

    const now = new Date().toISOString();
    const paymentResult = run(
      `INSERT INTO payments (customer_id, invoice_id, amount, payment_method, transaction_id, payment_date, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Verification Pending', ?)`,
      [customerId, invoiceId, amount, paymentMethod, transactionId, paymentDate, now]
    );
    run(
      `INSERT INTO payment_receipts (payment_id, file_name, file_path, file_type, file_size, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [paymentResult.lastInsertRowid, path.basename(String(receipt.fileName)).slice(0, 120), storedFileName, receipt.mimeType, fileBuffer.length, now]
    );
    run('INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, ?, ?, ?)', [customerId, 'Payment', `Payment submitted for ${invoice.invoice_number}; verification pending.`, now]);

    const managers = all<any>("SELECT id FROM users WHERE role = 'Sales Manager' AND status = 'Active'");
    for (const manager of managers) {
      notifyUser(manager.id, 'Payment Verification Required', `A customer submitted a payment for ${invoice.invoice_number}.`, 'payment', '/payment-verification');
    }
    res.status(201).json({
      payment: {
        id: paymentResult.lastInsertRowid,
        invoice_number: invoice.invoice_number,
        amount,
        status: 'Verification Pending',
        transaction_id: transactionId,
        submitted_at: now,
      },
    });
  } catch (err: any) {
    if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    if (String(err?.message || '').includes('UNIQUE')) {
      res.status(409).json({ error: 'That transaction ID has already been submitted.' });
      return;
    }
    res.status(500).json({ error: 'Could not submit the payment for verification.' });
  }
});

router.get('/customer/payments/:id/receipt', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  sendReceipt(getReceipt(Number(req.params.id), currentCustomerId(req)), res);
});

router.get('/customer/usage', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const dashboard = customerDashboard(currentCustomerId(req), Number(req.user?.id));
  res.json({ usage: dashboard?.usage || [] });
});

router.get('/customer/timeline', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const dashboard = customerDashboard(currentCustomerId(req), Number(req.user?.id));
  res.json({ activities: dashboard?.activities || [] });
});

router.get('/customer/support', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const customerId = currentCustomerId(req);
  const tickets = all<any>(`SELECT id, ticket_number, subject, description, status, created_at, updated_at FROM support_tickets WHERE customer_id = ? ORDER BY updated_at DESC`, [customerId]);
  res.json({ tickets });
});

router.post('/customer/support', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const subject = String(req.body.subject || '').trim();
  const description = String(req.body.description || '').trim();
  if (!subject || !description) {
    res.status(400).json({ error: 'Subject and description are required.' });
    return;
  }
  const customerId = currentCustomerId(req);
  const manager = get<any>("SELECT id FROM users WHERE role = 'Sales Manager' AND status = 'Active' ORDER BY id LIMIT 1");
  const ticketNumber = `CUST-${Date.now().toString().slice(-8)}`;
  const now = new Date().toISOString();
  const result = run(
    `INSERT INTO support_tickets (ticket_number, customer_id, subject, description, priority, assigned_user_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Medium', ?, 'Open', ?, ?)`,
    [ticketNumber, customerId, subject, description, manager?.id || null, now, now]
  );
  run('INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, ?, ?, ?)', [customerId, 'Support', `Support request ${ticketNumber} created.`, now]);
  if (manager) notifyUser(manager.id, 'Customer Support Request', `${ticketNumber}: ${subject}`, 'support', '/support');
  res.status(201).json({ id: result.lastInsertRowid, ticket_number: ticketNumber });
});

router.get('/customer/notifications', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const notifications = all<any>(`SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC`, [req.user?.id]);
  res.json({ notifications });
});

router.put('/customer/notifications/:id/read', authenticate, requireCustomer, (req: AuthenticatedRequest, res: Response) => {
  const result = run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user?.id]);
  if (!result.changes) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }
  res.json({ message: 'Notification marked as read.' });
});

router.get('/manager/payments', authenticate, requireRoles(['Sales Manager']), (_req: AuthenticatedRequest, res: Response) => {
  const payments = all<any>(`
    SELECT p.id, p.amount, p.payment_method, p.transaction_id, p.payment_date, p.status,
      p.submitted_at, p.verified_at, p.rejection_reason, i.invoice_number,
      c.customer_code, c.name as customer_name, c.company, r.id as receipt_id, r.file_name as receipt_name
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN customers c ON c.id = p.customer_id
    LEFT JOIN payment_receipts r ON r.payment_id = p.id
    ORDER BY CASE p.status WHEN 'Verification Pending' THEN 0 WHEN 'Under Review' THEN 1 ELSE 2 END, p.submitted_at DESC
  `);
  res.json({ payments });
});

router.post('/manager/customers/:id/due-reminder', authenticate, requireRoles(['Sales Manager']), async (req: AuthenticatedRequest, res: Response) => {
  const customerId = Number(req.params.id);
  const customer = get<any>('SELECT id FROM customers WHERE id = ?', [customerId]);
  if (!customer) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  const result = await sendManagerDueReminders(customerId, req.user?.full_name || 'Sales Manager');
  if (!result.invoices) {
    res.status(400).json({ error: 'This customer has no unpaid invoices ready for a reminder.' });
    return;
  }
  res.json({ ...result, emailDeliveryConfigured: hasCustomerEmailDelivery() });
});

router.get('/manager/payments/:id', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  const payment = get<any>(`
    SELECT p.*, i.invoice_number, i.amount as invoice_amount, c.customer_code,
      c.name as customer_name, c.company, c.email, c.phone,
      r.id as receipt_id, r.file_name as receipt_name, r.file_type as receipt_type
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    JOIN customers c ON c.id = p.customer_id
    LEFT JOIN payment_receipts r ON r.payment_id = p.id
    WHERE p.id = ?
  `, [Number(req.params.id)]);
  if (!payment) {
    res.status(404).json({ error: 'Payment not found.' });
    return;
  }
  res.json({ payment });
});

router.get('/manager/payments/:id/receipt', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  sendReceipt(getReceipt(Number(req.params.id)), res);
});

router.put('/manager/payments/:id/approve', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  const payment = get<any>(`SELECT p.*, i.invoice_number, i.amount as invoice_amount FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN payment_receipts r ON r.payment_id = p.id WHERE p.id = ?`, [Number(req.params.id)]);
  if (!payment || !['Verification Pending', 'Under Review'].includes(payment.status)) {
    res.status(404).json({ error: 'A payment awaiting verification was not found.' });
    return;
  }
  const now = new Date().toISOString();
  run("UPDATE payments SET status = 'Verified', verified_by = ?, verified_at = ?, rejection_reason = NULL WHERE id = ?", [req.user?.id, now, payment.id]);
  const verifiedAmount = get<any>("SELECT COALESCE(sum(amount), 0) as total FROM payments WHERE invoice_id = ? AND status = 'Verified'", [payment.invoice_id])?.total || 0;
  run('UPDATE invoices SET status = ? WHERE id = ?', [Number(verifiedAmount) >= Number(payment.invoice_amount) ? 'Paid' : 'Partially Paid', payment.invoice_id]);
  run('INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, ?, ?, ?)', [payment.customer_id, 'Payment', `Payment for ${payment.invoice_number} verified.`, now]);
  for (const customerUser of all<any>('SELECT id FROM users WHERE customer_id = ?', [payment.customer_id])) {
    notifyUser(customerUser.id, 'Payment Verified', `Your payment of ${payment.amount} for Invoice ${payment.invoice_number} has been verified. Transaction ID: ${payment.transaction_id}.`, 'payment', '/customer/payments');
  }
  logAudit(req.user?.id || null, req.user?.full_name || null, 'PAYMENT_VERIFIED', 'Payment', payment.id, `Verified payment for ${payment.invoice_number}`);
  res.json({ message: 'Payment verified.', status: 'Verified' });
});

router.put('/manager/payments/:id/reject', authenticate, requireRoles(['Sales Manager']), (req: AuthenticatedRequest, res: Response) => {
  const payment = get<any>(`SELECT p.*, i.invoice_number FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.id = ?`, [Number(req.params.id)]);
  const reason = String(req.body.reason || '').trim();
  if (!payment || !['Verification Pending', 'Under Review'].includes(payment.status)) {
    res.status(404).json({ error: 'A payment awaiting verification was not found.' });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: 'A rejection reason is required.' });
    return;
  }
  const now = new Date().toISOString();
  run("UPDATE payments SET status = 'Rejected', verified_by = ?, verified_at = ?, rejection_reason = ? WHERE id = ?", [req.user?.id, now, reason.slice(0, 500), payment.id]);
  const verifiedAmount = get<any>("SELECT COALESCE(sum(amount), 0) as total FROM payments WHERE invoice_id = ? AND status = 'Verified'", [payment.invoice_id])?.total || 0;
  const invoiceTotal = get<any>('SELECT amount FROM invoices WHERE id = ?', [payment.invoice_id])?.amount || 0;
  run('UPDATE invoices SET status = ? WHERE id = ?', [Number(verifiedAmount) >= Number(invoiceTotal) ? 'Paid' : Number(verifiedAmount) > 0 ? 'Partially Paid' : 'Unpaid', payment.invoice_id]);
  run('INSERT INTO customer_activity (customer_id, activity_type, description, created_at) VALUES (?, ?, ?, ?)', [payment.customer_id, 'Payment', `Payment for ${payment.invoice_number} was rejected.`, now]);
  for (const customerUser of all<any>('SELECT id FROM users WHERE customer_id = ?', [payment.customer_id])) {
    notifyUser(customerUser.id, 'Payment Verification Failed', `Payment for Invoice ${payment.invoice_number} was rejected: ${reason}`, 'payment', '/customer/payments');
  }
  logAudit(req.user?.id || null, req.user?.full_name || null, 'PAYMENT_REJECTED', 'Payment', payment.id, `Rejected payment for ${payment.invoice_number}: ${reason}`);
  res.json({ message: 'Payment rejected.', status: 'Rejected' });
});

router.get('/manager/overdue-reminders', authenticate, requireRoles(['Sales Manager', 'Sales Executive']), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const reminders = getOverdueInvoiceReminders();
    res.json({ reminders, count: reminders.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Could not load overdue reminders.' });
  }
});

router.post('/manager/send-overdue-reminder', authenticate, requireRoles(['Sales Manager', 'Sales Executive']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, invoice_id, customSubject, customMessage } = req.body;
    if (!customer_id || !invoice_id) {
      res.status(400).json({ error: 'Customer ID and Invoice ID are required.' });
      return;
    }
    const senderName = req.user?.full_name || 'Sales Representative';
    const result = await sendSpecificOverdueReminder(Number(customer_id), Number(invoice_id), senderName, customSubject, customMessage);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not send overdue reminder.' });
  }
});

export default router;
