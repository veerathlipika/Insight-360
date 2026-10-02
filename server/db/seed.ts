import bcrypt from 'bcryptjs';
import { all, get, run } from './database.ts';
import { normalizePhone } from '../utils/phone.ts';

function seedCustomerPortalData(): void {
  const manager = get<any>("SELECT id FROM users WHERE role = 'Sales Manager' ORDER BY id LIMIT 1");
  const now = new Date().toISOString();

  for (const order of all<any>('SELECT id, customer_id, order_number, order_date, total, status FROM orders')) {
    let invoice = get<any>('SELECT id, invoice_number FROM invoices WHERE order_id = ?', [order.id]);
    if (!invoice) {
      const invoiceNumber = `INV-${order.order_number}`;
      const dueDate = new Date(`${order.order_date}T00:00:00Z`);
      dueDate.setUTCDate(dueDate.getUTCDate() + 30);
      const invoiceStatus = order.status === 'Completed' ? 'Paid' : 'Unpaid';
      const result = run(
        `INSERT INTO invoices (customer_id, order_id, invoice_number, amount, due_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [order.customer_id, order.id, invoiceNumber, Number(order.total) || 0, dueDate.toISOString().slice(0, 10), invoiceStatus, now]
      );
      invoice = { id: result.lastInsertRowid, invoice_number: invoiceNumber };
    }

    if (order.status === 'Completed' && !get('SELECT id FROM payments WHERE invoice_id = ?', [invoice.id])) {
      run(
        `INSERT INTO payments (customer_id, invoice_id, amount, payment_method, transaction_id, payment_date, status, submitted_at, verified_by, verified_at)
         VALUES (?, ?, ?, 'UPI', ?, ?, 'Verified', ?, ?, ?)`,
        [order.customer_id, invoice.id, Number(order.total) || 0, `DEMO-${order.order_number}`, order.order_date, now, manager?.id || null, now]
      );
    }
  }

  for (const customer of all<any>('SELECT id FROM customers')) {
    if (!get('SELECT id FROM product_usage WHERE customer_id = ?', [customer.id])) {
      run(
        `INSERT INTO product_usage (customer_id, active_days, sessions, features_used, usage_date)
         VALUES (?, ?, ?, ?, ?)`,
        [customer.id, 12, 48, JSON.stringify(['Dashboard', 'Reports', 'Analytics']), new Date().toISOString().slice(0, 7)]
      );
    }
    if (!get('SELECT id FROM customer_activity WHERE customer_id = ?', [customer.id])) {
      run(
        `INSERT INTO customer_activity (customer_id, activity_type, description, created_at)
         VALUES (?, 'Product', 'Customer workspace activity recorded.', ?)`,
        [customer.id, now]
      );
    }
  }

  // Ensure high-health customer portal users exist with known password
  const sterling = get<any>("SELECT id, email, phone FROM customers WHERE email = 'j.sterling@apexlogistics.com'");
  if (sterling && !get('SELECT id FROM users WHERE email = ?', [sterling.email])) {
    const passwordHash = bcrypt.hashSync('password123456', 10);
    run(
      `INSERT INTO users (email, password_hash, full_name, role, status, phone, phone_normalized, customer_id, subscription_plan, created_at, updated_at)
       VALUES (?, ?, 'Jonathan Sterling', 'Customer', 'Active', ?, ?, ?, 'trial', ?, ?)`,
      [sterling.email, passwordHash, sterling.phone, normalizePhone(sterling.phone), sterling.id, now, now]
    );
  }

  const chang = get<any>("SELECT id, email, phone FROM customers WHERE email = 'dchang@nexusfintech.io'");
  if (chang && !get('SELECT id FROM users WHERE email = ?', [chang.email])) {
    const passwordHash = bcrypt.hashSync('password123456', 10);
    run(
      `INSERT INTO users (email, password_hash, full_name, role, status, phone, phone_normalized, customer_id, subscription_plan, created_at, updated_at)
       VALUES (?, ?, 'David Chang', 'Customer', 'Active', ?, ?, ?, 'trial', ?, ?)`,
      [chang.email, passwordHash, chang.phone, normalizePhone(chang.phone), chang.id, now, now]
    );
  }

  // Ensure products exist in products table
  const productsCount = all<any>('SELECT count(*) as count FROM products')[0]?.count || 0;
  if (productsCount === 0) {
    const defaultProducts = [
      { name: 'Enterprise CRM Cloud Platform', sku: 'PROD-CRM-ENT', category: 'Software License', unit_price: 12000, description: 'Annual subscription for up to 100 sales users with advanced workflows.' },
      { name: 'Standard Sales Ops Suite', sku: 'PROD-CRM-STD', category: 'Software License', unit_price: 4800, description: 'Annual license for mid-market teams with pipeline and contact automation.' },
      { name: 'Rapid Onboarding & Migration Service', sku: 'SERV-ONBOARD', category: 'Professional Services', unit_price: 3500, description: 'Complete turnkey migration from legacy CRM with staff coaching.' },
      { name: 'Dedicated 24/7 SLA Support Package', sku: 'SERV-SUPP-247', category: 'Support & Maintenance', unit_price: 6000, description: 'Round-the-clock priority technical support and dedicated TAM.' },
      { name: 'Custom ERP & BI Data Pipeline Connector', sku: 'SERV-INT-ERP', category: 'Engineering Integration', unit_price: 7500, description: 'Custom bidirectional API connector for SAP, Oracle, or NetSuite.' },
      { name: 'Sales Performance & AI Forecasting Add-on', sku: 'PROD-AI-FORECAST', category: 'Add-on Module', unit_price: 2400, description: 'Machine-learning pipeline forecasting and deal risk analytics.' }
    ];
    for (const p of defaultProducts) {
      run(
        `INSERT INTO products (name, sku, category, unit_price, description, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [p.name, p.sku, p.category, p.unit_price, p.description, now]
      );
    }
  }
}

export async function seedDatabase(): Promise<void> {
  seedCustomerPortalData();
  const usersCount = all('SELECT count(*) as count FROM users')[0]?.count;
  if (usersCount && usersCount > 0) {
    // Database already seeded
    return;
  }

  console.log('Seeding CRM Database with enterprise demo data...');

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const now = new Date().toISOString();
  const pastDays = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const futureDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // 1. Users (Only Sales Manager and Sales Executive)
  const users = [
    {
      email: 'manager@example.com',
      password_hash: passwordHash,
      full_name: 'Elena Rostova (Sales Manager)',
      role: 'Sales Manager',
      status: 'Active',
      phone: '+1 (555) 100-2002',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
    },
    {
      email: 'sales@example.com',
      password_hash: passwordHash,
      full_name: 'Marcus Brody (Sales Executive)',
      role: 'Sales Executive',
      status: 'Active',
      phone: '+1 (555) 100-2003',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    },
    {
      email: 'sarah.c@example.com',
      password_hash: passwordHash,
      full_name: 'Sarah Connor (Senior Account Exec)',
      role: 'Sales Executive',
      status: 'Active',
      phone: '+1 (555) 100-2004',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
    }
  ];

  for (const u of users) {
    run(
      `INSERT INTO users (email, password_hash, full_name, role, status, phone, phone_normalized, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.email, u.password_hash, u.full_name, u.role, u.status, u.phone, normalizePhone(u.phone), u.avatar, pastDays(30), pastDays(1)]
    );
  }

  // 2. Products / Services
  const products = [
    { name: 'Enterprise CRM Cloud Platform', sku: 'PROD-CRM-ENT', category: 'Software License', unit_price: 12000, description: 'Annual subscription for up to 100 sales users with advanced workflows.' },
    { name: 'Standard Sales Ops Suite', sku: 'PROD-CRM-STD', category: 'Software License', unit_price: 4800, description: 'Annual license for mid-market teams with pipeline and contact automation.' },
    { name: 'Rapid Onboarding & Migration Service', sku: 'SERV-ONBOARD', category: 'Professional Services', unit_price: 3500, description: 'Complete turnkey migration from legacy CRM with staff coaching.' },
    { name: 'Dedicated 24/7 SLA Support Package', sku: 'SERV-SUPP-247', category: 'Support & Maintenance', unit_price: 6000, description: 'Round-the-clock priority technical support and dedicated TAM.' },
    { name: 'Custom ERP & BI Data Pipeline Connector', sku: 'SERV-INT-ERP', category: 'Engineering Integration', unit_price: 7500, description: 'Custom bidirectional API connector for SAP, Oracle, or NetSuite.' },
    { name: 'Sales Performance & AI Forecasting Add-on', sku: 'PROD-AI-FORECAST', category: 'Add-on Module', unit_price: 2400, description: 'Machine-learning pipeline forecasting and deal risk analytics.' }
  ];

  for (const p of products) {
    run(
      `INSERT INTO products (name, sku, category, unit_price, description, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [p.name, p.sku, p.category, p.unit_price, p.description, pastDays(60)]
    );
  }

  // 3. Customers (22 realistic companies)
  const customers = [
    { code: 'CUST-1001', name: 'Jonathan Sterling', company: 'Apex Global Logistics', email: 'j.sterling@apexlogistics.com', phone: '+1 (555) 234-5678', address: '450 Harbor Boulevard, Suite 1200, Seattle, WA', industry: 'Logistics & Supply Chain', status: 'VIP', assigned_user_id: 2, notes: 'Key enterprise account. Looking to expand sales seats in Q4.' },
    { code: 'CUST-1002', name: 'Dr. Evelyn Reed', company: 'BioVance Therapeutics', email: 'ereed@biovance.org', phone: '+1 (555) 345-6789', address: '12 Cambridge Science Park, Boston, MA', industry: 'Healthcare & Biotech', status: 'Active', assigned_user_id: 2, notes: 'Requires strict HIPAA compliance and audit trail records.' },
    { code: 'CUST-1003', name: 'David Chang', company: 'Nexus FinTech Labs', email: 'dchang@nexusfintech.io', phone: '+1 (555) 456-7890', address: '100 Wall Street, Floor 34, New York, NY', industry: 'Financial Services', status: 'Active', assigned_user_id: 3, notes: 'Renewed contract in August. High adoption rate.' },
    { code: 'CUST-1004', name: 'Rachel Foster', company: 'CloudWave Technologies', email: 'rfoster@cloudwave.net', phone: '+1 (555) 567-8901', address: '300 Tech Green Way, Austin, TX', industry: 'SaaS & Cloud Computing', status: 'VIP', assigned_user_id: 2, notes: 'Co-marketing partner and early adopter of AI features.' },
    { code: 'CUST-1005', name: 'Liam O’Connor', company: 'Summit Manufacturing Corp', email: 'liam@summitmfg.com', phone: '+1 (555) 678-9012', address: '88 Industrial Parkway, Cleveland, OH', industry: 'Manufacturing', status: 'Active', assigned_user_id: 3, notes: 'Evaluating ERP connector integration.' },
    { code: 'CUST-1006', name: 'Sophia Martinez', company: 'TerraVerde Sustainable Solutions', email: 'smartinez@terraverde.eco', phone: '+1 (555) 789-0123', address: '550 Mission St, San Francisco, CA', industry: 'CleanTech & Energy', status: 'Active', assigned_user_id: 2, notes: 'Fastest growing client in our portfolio.' },
    { code: 'CUST-1007', name: 'Brian Kowalski', company: 'IronClad Cyber Defense', email: 'brian@ironcladcyber.io', phone: '+1 (555) 890-1234', address: '700 K Street NW, Washington, DC', industry: 'Cybersecurity', status: 'Active', assigned_user_id: 3, notes: 'Upgraded to 24/7 dedicated support last month.' },
    { code: 'CUST-1008', name: 'Amara Okafor', company: 'Vanguard Retail Holdings', email: 'aokafor@vanguardretail.com', phone: '+1 (555) 901-2345', address: '220 Michigan Ave, Chicago, IL', industry: 'Retail & E-commerce', status: 'Active', assigned_user_id: 2, notes: 'Connecting POS systems to customer profiles.' },
    { code: 'CUST-1009', name: 'Kenji Takahashi', company: 'Zenith Robotics', email: 'k.takahashi@zenithrobotics.jp', phone: '+1 (555) 012-3456', address: '400 Silicon Drive, San Jose, CA', industry: 'Hardware & Robotics', status: 'Active', assigned_user_id: 3, notes: 'Global contract covering Tokyo and US branches.' },
    { code: 'CUST-1010', name: 'Melissa Albright', company: 'Horizon Media Group', email: 'melissa@horizonmedia.com', phone: '+1 (555) 123-4560', address: '120 Broadway, New York, NY', industry: 'Media & Entertainment', status: 'Active', assigned_user_id: 2, notes: 'Uses CRM for booking ad campaigns and sponsorship.' },
    { code: 'CUST-1011', name: 'Tariq Al-Mansoor', company: 'Crescent Energy Partners', email: 'tariq@crescentenergy.ae', phone: '+1 (555) 234-5671', address: '1000 Louisiana St, Houston, TX', industry: 'Oil, Gas & Energy', status: 'VIP', assigned_user_id: 3, notes: 'Heavy enterprise user with 80+ team members.' },
    { code: 'CUST-1012', name: 'Claire Dubois', company: 'Lumiere Luxury Goods', email: 'cdubois@lumiere.fr', phone: '+1 (555) 345-6782', address: '680 Fifth Avenue, New York, NY', industry: 'Luxury & Fashion', status: 'Active', assigned_user_id: 2, notes: 'Demands personalized VIP concierge support.' },
    { code: 'CUST-1013', name: 'Carlos Morales', company: 'Solaria Solar Dynamics', email: 'cmorales@solariadynamics.com', phone: '+1 (555) 456-7893', address: '200 Phoenix Blvd, Phoenix, AZ', industry: 'Renewable Energy', status: 'Active', assigned_user_id: 3, notes: 'Recently integrated with our pipeline automations.' },
    { code: 'CUST-1014', name: 'Hannah Wright', company: 'Blueprint Architectural Design', email: 'hwright@blueprintarch.co', phone: '+1 (555) 567-8904', address: '85 Broad St, Denver, CO', industry: 'Architecture & Engineering', status: 'Active', assigned_user_id: 2, notes: 'Very satisfied with project proposal module.' },
    { code: 'CUST-1015', name: 'Devon Patel', company: 'QuantEdge Capital', email: 'dpatel@quantedge.com', phone: '+1 (555) 678-9015', address: '50 South LaSalle, Chicago, IL', industry: 'Hedge Funds & Trading', status: 'Active', assigned_user_id: 3, notes: 'High data security audit passed.' },
    { code: 'CUST-1016', name: 'Natalia Romanova', company: 'AeroTech Propulsion', email: 'n.romanova@aerotechpro.com', phone: '+1 (555) 789-0126', address: '170 Aviation Way, Atlanta, GA', industry: 'Aerospace & Defense', status: 'VIP', assigned_user_id: 2, notes: 'Multi-year enterprise contract signed.' },
    { code: 'CUST-1017', name: 'Ethan Cole', company: 'GreenLeaf AgTech', email: 'ecole@greenleafag.com', phone: '+1 (555) 890-1237', address: '900 Prairie Way, Des Moines, IA', industry: 'Agriculture & IoT', status: 'Active', assigned_user_id: 3, notes: 'Seasonal sales cycle; peaks in Spring.' },
    { code: 'CUST-1018', name: 'Chloe Bennett', company: 'Nova Health Informatics', email: 'chloe@novahealthinfo.com', phone: '+1 (555) 901-2348', address: '77 Medical Center Drive, Nashville, TN', industry: 'Healthcare IT', status: 'Active', assigned_user_id: 2, notes: 'Expanding to 3 hospital affiliate networks.' },
    { code: 'CUST-1019', name: 'Vikram Sethi', company: 'Matrix AI Cognitive Systems', email: 'vsethi@matrixcog.ai', phone: '+1 (555) 012-3459', address: '500 Palo Alto Square, Palo Alto, CA', industry: 'Artificial Intelligence', status: 'VIP', assigned_user_id: 3, notes: 'Strategic co-development candidate.' },
    { code: 'CUST-1020', name: 'Jessica Miller', company: 'Beacon Hospitality Network', email: 'jmiller@beaconhotels.com', phone: '+1 (555) 123-4569', address: '1400 Biscayne Blvd, Miami, FL', industry: 'Hospitality & Leisure', status: 'Active', assigned_user_id: 2, notes: 'Completed onboarding 3 weeks ago.' },
    { code: 'CUST-1021', name: 'Gavin Ross', company: 'Sterling & Ross Legal Partners', email: 'gross@srlegal.com', phone: '+1 (555) 234-5670', address: '200 Park Avenue, New York, NY', industry: 'Legal Services', status: 'Active', assigned_user_id: 3, notes: 'Requires client matter confidentiality tagging.' },
    { code: 'CUST-1022', name: 'Patricia Gomez', company: 'OmniStream Media Networks', email: 'pgomez@omnistream.tv', phone: '+1 (555) 345-6781', address: '1020 Burbank Blvd, Los Angeles, CA', industry: 'Media & Streaming', status: 'Active', assigned_user_id: 2, notes: 'Transitioned from legacy Salesforce.' }
  ];

  // Insert customers (deduped if any)
  const insertedCustomers: any[] = [];
  const seenEmails = new Set();
  for (const c of customers) {
    if (seenEmails.has(c.email)) continue;
    seenEmails.add(c.email);
    const res = run(
      `INSERT INTO customers (customer_code, name, company, email, phone, address, industry, status, assigned_user_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.code, c.name, c.company, c.email, c.phone, c.address, c.industry, c.status, c.assigned_user_id, c.notes, pastDays(45), pastDays(2)]
    );
    insertedCustomers.push({ id: res.lastInsertRowid, ...c });
  }

  // 4. Leads (32 realistic leads with different sources, statuses, values)
  const leadsData = [
    { code: 'LEAD-2001', name: 'Harrison Shaw', company: 'Quantum Telecomm Inc', email: 'hshaw@quantumtelecom.com', phone: '+1 (555) 432-1098', source: 'Website', requirement: 'Replacing archaic legacy CRM with automated quotation pipeline for 45 reps.', estimated_value: 28000, priority: 'High', status: 'Qualified', assigned_user_id: 2, attention_score: 92, last_contacted: pastDays(1), next_followup: todayStr },
    { code: 'LEAD-2002', name: 'Danielle Brooks', company: 'Verve Beverage Brands', email: 'dbrooks@vervebev.com', phone: '+1 (555) 543-2109', source: 'Referral', requirement: 'Field sales tracking and wholesale distributor order management.', estimated_value: 15500, priority: 'Medium', status: 'Contacted', assigned_user_id: 2, attention_score: 78, last_contacted: pastDays(3), next_followup: tomorrowStr },
    { code: 'LEAD-2003', name: 'Trevor Vance', company: 'IronGate Logistics', email: 'tvance@irongate.io', phone: '+1 (555) 654-3210', source: 'Social Media', requirement: 'Freight pipeline visibility and driver dispatch quote workflows.', estimated_value: 36000, priority: 'Urgent', status: 'New', assigned_user_id: 3, attention_score: 88, last_contacted: null, next_followup: todayStr },
    { code: 'LEAD-2004', name: 'Samantha Wu', company: 'Astra BioLabs', email: 'swu@astralabs.co', phone: '+1 (555) 765-4321', source: 'Advertisement', requirement: 'Trial equipment tracking and medical lab supplier relationship workflows.', estimated_value: 42000, priority: 'High', status: 'Qualified', assigned_user_id: 3, attention_score: 95, last_contacted: pastDays(2), next_followup: todayStr },
    { code: 'LEAD-2005', name: 'Oliver King', company: 'Apex Urban Architecture', email: 'oking@apexurban.design', phone: '+1 (555) 876-5432', source: 'Direct', requirement: 'Commercial proposal builder with multi-tier approval permissions.', estimated_value: 18000, priority: 'Medium', status: 'Contacted', assigned_user_id: 2, attention_score: 65, last_contacted: pastDays(5), next_followup: yesterdayStr },
    { code: 'LEAD-2006', name: 'Natalie Cruz', company: 'Solaris Smart Grid', email: 'ncruz@solarissmart.com', phone: '+1 (555) 987-6543', source: 'Website', requirement: 'Renewable residential and industrial customer onboarding pipeline.', estimated_value: 24500, priority: 'High', status: 'Qualified', assigned_user_id: 2, attention_score: 82, last_contacted: pastDays(1), next_followup: tomorrowStr },
    { code: 'LEAD-2007', name: 'Marcus Sterling', company: 'Borealis Pharma', email: 'msterling@borealispharma.com', phone: '+1 (555) 098-7654', source: 'Referral', requirement: 'Compliance documentation and distributor quotation sync.', estimated_value: 52000, priority: 'Urgent', status: 'New', assigned_user_id: 3, attention_score: 96, last_contacted: null, next_followup: todayStr },
    { code: 'LEAD-2008', name: 'Valerie Adams', company: 'SwiftFleet Mobility', email: 'vadams@swiftfleet.tech', phone: '+1 (555) 189-2345', source: 'Website', requirement: 'EV fleet subscription billing and customer support ticket tracking.', estimated_value: 19000, priority: 'Medium', status: 'Contacted', assigned_user_id: 3, attention_score: 70, last_contacted: pastDays(4), next_followup: yesterdayStr },
    { code: 'LEAD-2009', name: 'Gregory Vance', company: 'Crestline Aerospace Systems', email: 'gvance@crestlineaero.com', phone: '+1 (555) 290-3456', source: 'Direct', requirement: 'Defense sub-contracting RFP tracking and quotation revisions.', estimated_value: 65000, priority: 'Urgent', status: 'Qualified', assigned_user_id: 2, attention_score: 98, last_contacted: pastDays(1), next_followup: todayStr },
    { code: 'LEAD-2010', name: 'Leila Farhat', company: 'SilkRoad Textiles Global', email: 'lfarhat@silkroadglobal.com', phone: '+1 (555) 391-4567', source: 'Social Media', requirement: 'B2B order intake and international currency price sheet automation.', estimated_value: 14000, priority: 'Low', status: 'Unqualified', assigned_user_id: 2, attention_score: 30, last_contacted: pastDays(12), next_followup: null },
    { code: 'LEAD-2011', name: 'Ethan Drake', company: 'Vanguard Security Solutions', email: 'edrake@vanguardsec.net', phone: '+1 (555) 492-5678', source: 'Website', requirement: 'Commercial perimeter security proposals and annual maintenance contracts.', estimated_value: 31000, priority: 'High', status: 'New', assigned_user_id: 3, attention_score: 85, last_contacted: null, next_followup: tomorrowStr },
    { code: 'LEAD-2012', name: 'Maya Lin', company: 'CyberShield Systems', email: 'mlin@cybershield.tech', phone: '+1 (555) 593-6789', source: 'Referral', requirement: 'SOC2 compliant customer 360 record management for fintech clients.', estimated_value: 27000, priority: 'Medium', status: 'Contacted', assigned_user_id: 2, attention_score: 74, last_contacted: pastDays(2), next_followup: todayStr },
    { code: 'LEAD-2013', name: 'Oscar Meyer', company: 'Alpine Cold Storage', email: 'omeyer@alpinecold.com', phone: '+1 (555) 694-7890', source: 'Website', requirement: 'Refrigerated logistics partner tracking and seasonal capacity alerts.', estimated_value: 16500, priority: 'Low', status: 'New', assigned_user_id: 3, attention_score: 45, last_contacted: null, next_followup: futureDays(3).split('T')[0] },
    { code: 'LEAD-2014', name: 'Zoe Kravitz', company: 'Lumina Digital Media', email: 'zkravitz@luminamedia.agency', phone: '+1 (555) 795-8901', source: 'Advertisement', requirement: 'Brand campaign CRM and influencer retainer contract tracking.', estimated_value: 22000, priority: 'Medium', status: 'Qualified', assigned_user_id: 2, attention_score: 80, last_contacted: pastDays(3), next_followup: tomorrowStr },
    { code: 'LEAD-2015', name: 'Victor Hugo', company: 'Starlight Robotics', email: 'vhugo@starlightrobotics.com', phone: '+1 (555) 896-9012', source: 'Direct', requirement: 'Factory automation quotation workflows and service warranty management.', estimated_value: 48000, priority: 'High', status: 'Contacted', assigned_user_id: 3, attention_score: 89, last_contacted: pastDays(2), next_followup: todayStr },
    { code: 'LEAD-2016', name: 'Kylie Jenner', company: 'Glow Cosmetics Direct', email: 'kylie@glowcosmetics.com', phone: '+1 (555) 997-0123', source: 'Social Media', requirement: 'Retail partner purchase orders and automated restocking alerts.', estimated_value: 34000, priority: 'High', status: 'New', assigned_user_id: 2, attention_score: 84, last_contacted: null, next_followup: tomorrowStr },
    { code: 'LEAD-2017', name: 'Lucas Scott', company: 'Treehouse Software', email: 'lscott@treehousesoft.io', phone: '+1 (555) 108-1234', source: 'Website', requirement: 'Developer tools lead qualification and developer relations ticketing.', estimated_value: 12500, priority: 'Low', status: 'Lost', assigned_user_id: 3, attention_score: 20, last_contacted: pastDays(20), next_followup: null },
    { code: 'LEAD-2018', name: 'Fiona Gallagher', company: 'Southside Real Estate Partners', email: 'fgallagher@southsidere.com', phone: '+1 (555) 219-2345', source: 'Referral', requirement: 'Commercial lease pipeline and tenant communication log.', estimated_value: 26000, priority: 'Medium', status: 'Contacted', assigned_user_id: 2, attention_score: 72, last_contacted: pastDays(4), next_followup: yesterdayStr },
    { code: 'LEAD-2019', name: 'Arthur Pendelton', company: 'Avalon Defense Systems', email: 'apendelton@avalondefense.gov', phone: '+1 (555) 320-3456', source: 'Direct', requirement: 'High security contract bids and defense supplier compliance tracking.', estimated_value: 85000, priority: 'Urgent', status: 'Qualified', assigned_user_id: 3, attention_score: 99, last_contacted: pastDays(1), next_followup: todayStr },
    { code: 'LEAD-2020', name: 'Bianca Rossi', company: 'Milano Gourmet Imports', email: 'brossi@milanogourmet.it', phone: '+1 (555) 431-4567', source: 'Website', requirement: 'Fine food specialty imports distributor pipeline.', estimated_value: 15000, priority: 'Low', status: 'New', assigned_user_id: 2, attention_score: 50, last_contacted: null, next_followup: futureDays(2).split('T')[0] },
    { code: 'LEAD-2021', name: 'Patrick Bateman', company: 'Pierce & Pierce M&A', email: 'pbateman@piercecapital.com', phone: '+1 (555) 542-5678', source: 'Referral', requirement: 'Executive deal pipeline and high-net-worth investor tracking.', estimated_value: 75000, priority: 'High', status: 'Contacted', assigned_user_id: 3, attention_score: 86, last_contacted: pastDays(2), next_followup: todayStr },
    { code: 'LEAD-2022', name: 'Serena Williams', company: 'CourtMaster Sports Gear', email: 'swilliams@courtmaster.com', phone: '+1 (555) 653-6789', source: 'Advertisement', requirement: 'Wholesale athletic equipment supply agreements.', estimated_value: 38000, priority: 'High', status: 'Qualified', assigned_user_id: 2, attention_score: 91, last_contacted: pastDays(1), next_followup: tomorrowStr },
    { code: 'LEAD-2023', name: 'Logan Roy', company: 'Waystar Global Enterprise', email: 'lroy@waystarglobal.com', phone: '+1 (555) 764-7890', source: 'Direct', requirement: 'Consolidated CRM for 14 subsidiary divisions and real-time executive reporting.', estimated_value: 120000, priority: 'Urgent', status: 'Qualified', assigned_user_id: 3, attention_score: 100, last_contacted: pastDays(1), next_followup: todayStr },
    { code: 'LEAD-2024', name: 'Shiv Roy', company: 'ATN Media Network', email: 'shiv@atnnews.com', phone: '+1 (555) 875-8901', source: 'Referral', requirement: 'Broadcast ad inventory quoting and sponsor renewal workflows.', estimated_value: 62000, priority: 'High', status: 'Contacted', assigned_user_id: 2, attention_score: 83, last_contacted: pastDays(3), next_followup: tomorrowStr },
    { code: 'LEAD-2025', name: 'Roman Roy', company: 'Waystar Studios', email: 'roman@waystarstudios.com', phone: '+1 (555) 986-9012', source: 'Direct', requirement: 'Film festival licensing and digital rights distribution CRM.', estimated_value: 45000, priority: 'Medium', status: 'New', assigned_user_id: 3, attention_score: 68, last_contacted: null, next_followup: futureDays(1).split('T')[0] },
    { code: 'LEAD-2026', name: 'Kendall Roy', company: 'Waystar Ventures', email: 'kroy@waystarventures.com', phone: '+1 (555) 097-0123', source: 'Website', requirement: 'Tech portfolio investment tracking and founder pipeline.', estimated_value: 55000, priority: 'High', status: 'Qualified', assigned_user_id: 2, attention_score: 87, last_contacted: pastDays(2), next_followup: todayStr },
    { code: 'LEAD-2027', name: 'Gerri Kellman', company: 'General Counsel Advisory', email: 'gerri@gklegal.com', phone: '+1 (555) 108-2345', source: 'Referral', requirement: 'Outside counsel billing audits and compliance workflows.', estimated_value: 29000, priority: 'Medium', status: 'Contacted', assigned_user_id: 3, attention_score: 75, last_contacted: pastDays(4), next_followup: yesterdayStr },
    { code: 'LEAD-2028', name: 'Tom Wambsgans', company: 'Parks & Cruises Operations', email: 'tom@waystarparks.com', phone: '+1 (555) 219-3456', source: 'Website', requirement: 'Customer safety incident ticketing and guest satisfaction CRM.', estimated_value: 41000, priority: 'High', status: 'Qualified', assigned_user_id: 2, attention_score: 89, last_contacted: pastDays(1), next_followup: tomorrowStr },
    { code: 'LEAD-2029', name: 'Greg Hirsch', company: 'Waystar Special Projects', email: 'greg@waystar.com', phone: '+1 (555) 320-4567', source: 'Social Media', requirement: 'Internal project task assignment and executive assistant logs.', estimated_value: 8000, priority: 'Low', status: 'Unqualified', assigned_user_id: 3, attention_score: 25, last_contacted: pastDays(15), next_followup: null },
    { code: 'LEAD-2030', name: 'Colin Powell', company: 'Security Logistics Global', email: 'cpowell@seclogistics.com', phone: '+1 (555) 431-5678', source: 'Direct', requirement: 'VIP escort and armored fleet tracking contracts.', estimated_value: 39000, priority: 'High', status: 'New', assigned_user_id: 2, attention_score: 79, last_contacted: null, next_followup: futureDays(2).split('T')[0] },
    { code: 'LEAD-2031', name: 'Frank Vernon', company: 'Vernon Asset Management', email: 'fvernon@vernonassets.com', phone: '+1 (555) 542-6789', source: 'Referral', requirement: 'Retirement fund corporate sales and fiduciary client management.', estimated_value: 47000, priority: 'High', status: 'Contacted', assigned_user_id: 3, attention_score: 81, last_contacted: pastDays(3), next_followup: todayStr },
    { code: 'LEAD-2032', name: 'Karl Muller', company: 'Muller Treasury Strategies', email: 'kmuller@mullertreasury.com', phone: '+1 (555) 653-7890', source: 'Website', requirement: 'Corporate treasury liquidity sales and banking portal workflows.', estimated_value: 58000, priority: 'Urgent', status: 'Qualified', assigned_user_id: 2, attention_score: 94, last_contacted: pastDays(1), next_followup: todayStr }
  ];

  for (const l of leadsData) {
    run(
      `INSERT INTO leads (lead_code, name, company, email, phone, source, requirement, estimated_value, priority, assigned_user_id, status, attention_score, last_contacted_at, next_followup_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [l.code, l.name, l.company, l.email, l.phone, l.source, l.requirement, l.estimated_value, l.priority, l.assigned_user_id, l.status, l.attention_score, l.last_contacted, l.next_followup, pastDays(25), pastDays(1)]
    );
  }

  // 5. Opportunities across all 5 stages
  // Stages: 'New', 'Contacted', 'Proposal', 'Negotiation', 'Converted'
  const opportunities = [
    { code: 'OPP-3001', title: 'Apex Global - 50 User Expansion & SLA', customer_id: 1, value: 34000, stage: 'Negotiation', probability: 80, priority: 'High', assigned_user_id: 2, close: futureDays(14).split('T')[0], notes: 'Legal review ongoing for custom data privacy clause.' },
    { code: 'OPP-3002', title: 'BioVance - HIPAA Automated Portal', customer_id: 2, value: 45000, stage: 'Proposal', probability: 60, priority: 'High', assigned_user_id: 2, close: futureDays(21).split('T')[0], notes: 'Formal RFP submission sent. Waiting for committee review.' },
    { code: 'OPP-3003', title: 'Nexus FinTech - High-Speed API Connector', customer_id: 3, value: 28000, stage: 'Converted', probability: 100, priority: 'High', assigned_user_id: 3, close: pastDays(5).split('T')[0], notes: 'Won! Contract signed and implementation scheduled.' },
    { code: 'OPP-3004', title: 'CloudWave - AI Predictive Insights License', customer_id: 4, value: 18000, stage: 'Proposal', probability: 55, priority: 'Medium', assigned_user_id: 2, close: futureDays(30).split('T')[0], notes: 'Demonstrated live AI forecasting demo to VP of Sales.' },
    { code: 'OPP-3005', title: 'Summit Mfg - Plant Floor CRM Integration', customer_id: 5, value: 32000, stage: 'Contacted', probability: 40, priority: 'Medium', assigned_user_id: 3, close: futureDays(45).split('T')[0], notes: 'Technical feasibility call held with IT Director.' },
    { code: 'OPP-3006', title: 'TerraVerde - CleanTech Carbon Offset Tracking', customer_id: 6, value: 22000, stage: 'Negotiation', probability: 85, priority: 'High', assigned_user_id: 2, close: futureDays(10).split('T')[0], notes: 'Finalizing 10% multi-year discount schedule.' },
    { code: 'OPP-3007', title: 'IronClad - Dedicated Cyber Support Tier', customer_id: 7, value: 16000, stage: 'Converted', probability: 100, priority: 'High', assigned_user_id: 3, close: pastDays(12).split('T')[0], notes: 'Successfully renewed and expanded support contract.' },
    { code: 'OPP-3008', title: 'Vanguard Retail - POS Omnichannel Connector', customer_id: 8, value: 39000, stage: 'New', probability: 20, priority: 'Medium', assigned_user_id: 2, close: futureDays(60).split('T')[0], notes: 'Initial scope document drafted from introductory call.' },
    { code: 'OPP-3009', title: 'Zenith Robotics - Global Multi-Region Rollout', customer_id: 9, value: 72000, stage: 'Negotiation', probability: 75, priority: 'High', assigned_user_id: 3, close: futureDays(18).split('T')[0], notes: 'Tokyo and San Jose alignment meeting scheduled.' },
    { code: 'OPP-3010', title: 'Horizon Media - Sponsorship Pipeline Suite', customer_id: 10, value: 25000, stage: 'Proposal', probability: 50, priority: 'Medium', assigned_user_id: 2, close: futureDays(25).split('T')[0], notes: 'Proposal delivered with custom tiered branding mockups.' },
    { code: 'OPP-3011', title: 'Crescent Energy - Enterprise Field Sales Suite', customer_id: 11, value: 95000, stage: 'Negotiation', probability: 90, priority: 'High', assigned_user_id: 3, close: futureDays(7).split('T')[0], notes: 'Procurement team approved budget; awaiting signature.' },
    { code: 'OPP-3012', title: 'Lumiere Luxury - VIP Concierge Tracking System', customer_id: 12, value: 29000, stage: 'Converted', probability: 100, priority: 'Medium', assigned_user_id: 2, close: pastDays(20).split('T')[0], notes: 'Client onboarded successfully.' },
    { code: 'OPP-3013', title: 'Solaria Solar - Residential Installer Quoting', customer_id: 13, value: 31000, stage: 'Contacted', probability: 35, priority: 'Medium', assigned_user_id: 3, close: futureDays(40).split('T')[0], notes: 'Product demo scheduled for next Tuesday.' },
    { code: 'OPP-3014', title: 'Blueprint Arch - Architecture Proposal Module', customer_id: 14, value: 17500, stage: 'Converted', probability: 100, priority: 'Medium', assigned_user_id: 2, close: pastDays(15).split('T')[0], notes: 'Annual subscription active.' },
    { code: 'OPP-3015', title: 'QuantEdge - Trading Room CRM Feeds', customer_id: 15, value: 48000, stage: 'New', probability: 25, priority: 'High', assigned_user_id: 3, close: futureDays(50).split('T')[0], notes: 'Needs security audit sign-off before trial.' }
  ];

  for (const o of opportunities) {
    run(
      `INSERT INTO opportunities (opp_code, title, customer_id, value, stage, probability, priority, assigned_user_id, expected_close_date, notes, stage_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.code, o.title, o.customer_id, o.value, o.stage, o.probability, o.priority, o.assigned_user_id, o.close, o.notes, pastDays(3), pastDays(20), pastDays(1)]
    );
  }

  // 6. Follow-ups (Overdue, Today, Upcoming, Completed)
  const followups = [
    // Today's Follow-ups
    { customer_id: 1, opp_id: 1, date: todayStr, time: '10:00', type: 'Call', status: 'Pending', priority: 'High', notes: 'Review contract indemnity clause with Apex General Counsel.', assigned_user_id: 2 },
    { customer_id: 6, opp_id: 6, date: todayStr, time: '11:30', type: 'Meeting', status: 'Pending', priority: 'High', notes: 'TerraVerde pricing finalization video conference with VP Sophia.', assigned_user_id: 2 },
    { customer_id: 11, opp_id: 11, date: todayStr, time: '14:00', type: 'Call', status: 'Pending', priority: 'Urgent', notes: 'Crescent Energy contract signature status update with Tariq.', assigned_user_id: 3 },
    { customer_id: 2, opp_id: 2, date: todayStr, time: '15:30', type: 'Email', status: 'Pending', priority: 'Medium', notes: 'Send updated security whitepaper and HIPAA compliance summary.', assigned_user_id: 2 },
    { customer_id: 9, opp_id: 9, date: todayStr, time: '17:00', type: 'Meeting', status: 'Pending', priority: 'High', notes: 'Sync with Kenji Takahashi on multi-currency billing requirements.', assigned_user_id: 3 },
    
    // Overdue Follow-ups
    { customer_id: 5, opp_id: 5, date: yesterdayStr, time: '14:00', type: 'Call', status: 'Overdue', priority: 'High', notes: 'Follow up on technical architecture questionnaire with Liam.', assigned_user_id: 3 },
    { customer_id: 8, opp_id: 8, date: yesterdayStr, time: '16:00', type: 'Email', status: 'Overdue', priority: 'Medium', notes: 'Check in with Amara Okafor regarding omnichannel POS requirements.', assigned_user_id: 2 },
    { customer_id: 13, opp_id: 13, date: pastDays(2).split('T')[0], time: '11:00', type: 'Call', status: 'Overdue', priority: 'Urgent', notes: 'Urgent follow-up on Solar quote approval with Carlos.', assigned_user_id: 3 },

    // Upcoming Follow-ups
    { customer_id: 4, opp_id: 4, date: tomorrowStr, time: '09:30', type: 'Meeting', status: 'Pending', priority: 'Medium', notes: 'CloudWave quarterly pipeline alignment strategy session.', assigned_user_id: 2 },
    { customer_id: 10, opp_id: 10, date: tomorrowStr, time: '13:00', type: 'Call', status: 'Pending', priority: 'Medium', notes: 'Walkthrough proposal figures with Melissa Albright.', assigned_user_id: 2 },
    { customer_id: 15, opp_id: 15, date: futureDays(2).split('T')[0], time: '10:30', type: 'Meeting', status: 'Pending', priority: 'High', notes: 'QuantEdge security architecture demonstration.', assigned_user_id: 3 },
    { customer_id: 3, opp_id: 3, date: futureDays(3).split('T')[0], time: '15:00', type: 'Call', status: 'Pending', priority: 'Low', notes: 'Post-implementation check-in with David Chang.', assigned_user_id: 3 },

    // Completed Follow-ups
    { customer_id: 1, opp_id: 1, date: pastDays(3).split('T')[0], time: '11:00', type: 'Meeting', status: 'Completed', priority: 'High', notes: 'Presented proposal deck and answered SLA questions.', assigned_user_id: 2, completed_at: pastDays(3) },
    { customer_id: 7, opp_id: 7, date: pastDays(4).split('T')[0], time: '14:30', type: 'Email', status: 'Completed', priority: 'Medium', notes: 'Sent onboarding confirmation and signed purchase agreement.', assigned_user_id: 3, completed_at: pastDays(4) }
  ];

  for (const f of followups) {
    run(
      `INSERT INTO followups (customer_id, opportunity_id, date, time, type, status, priority, notes, assigned_user_id, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [f.customer_id, f.opp_id, f.date, f.time, f.type, f.status, f.priority, f.notes, f.assigned_user_id, f.completed_at || null, pastDays(10), pastDays(1)]
    );
  }

  // 7. Quotations with items
  const quotations = [
    { num: 'QUO-4001', cust: 1, opp: 1, date: pastDays(5).split('T')[0], valid: futureDays(25).split('T')[0], sub: 34000, disc: 2000, tax: 2560, total: 34560, status: 'Sent', terms: 'Payment 30 days net. Includes 1 year priority SLA and 100 licenses.' },
    { num: 'QUO-4002', cust: 2, opp: 2, date: pastDays(8).split('T')[0], valid: futureDays(22).split('T')[0], sub: 45000, disc: 0, tax: 3600, total: 48600, status: 'Sent', terms: 'Includes dedicated HIPAA compliant server instances and onboarding.' },
    { num: 'QUO-4003', cust: 3, opp: 3, date: pastDays(18).split('T')[0], valid: pastDays(2).split('T')[0], sub: 28000, disc: 3000, tax: 2000, total: 27000, status: 'Accepted', terms: 'Signed and approved by CFO.' },
    { num: 'QUO-4004', cust: 6, opp: 6, date: pastDays(3).split('T')[0], valid: futureDays(27).split('T')[0], sub: 22000, disc: 2200, tax: 1584, total: 21384, status: 'Draft', terms: 'CleanTech early adopter discount applied.' },
    { num: 'QUO-4005', cust: 7, opp: 7, date: pastDays(25).split('T')[0], valid: pastDays(5).split('T')[0], sub: 16000, disc: 0, tax: 1280, total: 17280, status: 'Accepted', terms: 'Paid in full on receipt.' },
    { num: 'QUO-4006', cust: 11, opp: 11, date: pastDays(2).split('T')[0], valid: futureDays(28).split('T')[0], sub: 95000, disc: 5000, tax: 7200, total: 97200, status: 'Sent', terms: 'Multi-year master services agreement.' }
  ];

  for (const q of quotations) {
    const qRes = run(
      `INSERT INTO quotations (quotation_number, customer_id, opportunity_id, date, valid_until, subtotal, discount, tax, total, terms, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [q.num, q.cust, q.opp, q.date, q.valid, q.sub, q.disc, q.tax, q.total, q.terms, q.status, pastDays(10), pastDays(1)]
    );
    const qId = qRes.lastInsertRowid;
    // Add sample items
    run(
      `INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [qId, 1, 'Enterprise CRM Cloud Platform (Annual)', 2, 12000, 24000]
    );
    run(
      `INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [qId, 4, 'Dedicated 24/7 SLA Support Package', 1, 6000, 6000]
    );
    run(
      `INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [qId, 3, 'Rapid Onboarding & Migration Service', 1, 3500, 3500]
    );
  }

  // 8. Orders with items
  const orders = [
    { num: 'ORD-5001', cust: 3, opp: 3, quo: 3, date: pastDays(5).split('T')[0], sub: 28000, disc: 3000, tax: 2000, total: 27000, status: 'Completed', notes: 'Provisioned license keys and assigned implementation lead.' },
    { num: 'ORD-5002', cust: 7, opp: 7, quo: 5, date: pastDays(12).split('T')[0], sub: 16000, disc: 0, tax: 1280, total: 17280, status: 'Completed', notes: 'SLA support hotline credentials activated.' },
    { num: 'ORD-5003', cust: 12, opp: 12, quo: null, date: pastDays(20).split('T')[0], sub: 29000, disc: 1500, tax: 2200, total: 29700, status: 'Completed', notes: 'VIP Concierge module configured and trained.' },
    { num: 'ORD-5004', cust: 14, opp: 14, quo: null, date: pastDays(15).split('T')[0], sub: 17500, disc: 500, tax: 1360, total: 18360, status: 'Processing', notes: 'Architectural templates importing into workspace.' },
    { num: 'ORD-5005', cust: 1, opp: null, quo: null, date: pastDays(40).split('T')[0], sub: 24000, disc: 2000, tax: 1760, total: 23760, status: 'Completed', notes: 'Initial 50-user platform pilot deployment.' }
  ];

  for (const o of orders) {
    const oRes = run(
      `INSERT INTO orders (order_number, customer_id, opportunity_id, quotation_id, order_date, subtotal, discount, tax, total, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.num, o.cust, o.opp, o.quo, o.date, o.sub, o.disc, o.tax, o.total, o.status, o.notes, pastDays(15), pastDays(1)]
    );
    const oId = oRes.lastInsertRowid;
    run(
      `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [oId, 1, 'Enterprise CRM Cloud Platform', 1, 12000, 12000]
    );
    run(
      `INSERT INTO order_items (order_id, product_id, description, quantity, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [oId, 5, 'Custom ERP & BI Data Pipeline Connector', 1, 7500, 7500]
    );
  }

  // 9. Communications (Calls, Emails, Meetings, Notes)
  const communications = [
    { cust: 1, opp: 1, user: 2, type: 'Call', subject: 'Contract Review Call with GC', content: 'Discussed indemnity clauses and liability caps. Agreed on standard 2x annual fee cap.', date: pastDays(1) },
    { cust: 1, opp: 1, user: 2, type: 'Email', subject: 'Updated Proposal & Licensing Schedule', content: 'Sent revision 3 of proposal showing multi-year commitment discounts for Apex.', date: pastDays(3) },
    { cust: 1, opp: 1, user: 2, type: 'Meeting', subject: 'Executive Sponsorship Briefing', content: 'Met with Jonathan Sterling and VP of Ops. High enthusiasm for automated quote generation.', date: pastDays(7) },
    { cust: 2, opp: 2, user: 2, type: 'Call', subject: 'HIPAA Compliance Checklist Review', content: 'Dr. Reed verified data encryption standards and signed off on BAA terms.', date: pastDays(2) },
    { cust: 3, opp: 3, user: 3, type: 'Meeting', subject: 'Implementation Kickoff & Timeline', content: 'Set milestone targets with David Chang for deployment on the 15th.', date: pastDays(4) },
    { cust: 6, opp: 6, user: 2, type: 'Note', subject: 'Sustainability Metric Dashboard Preference', content: 'Customer wants custom ESG carbon metrics tracked in their pipeline exports.', date: pastDays(2) },
    { cust: 11, opp: 11, user: 3, type: 'Call', subject: 'Executive Alignment with Tariq', content: 'Finalized enterprise discount terms. Proceeding to formal board sign-off.', date: pastDays(1) }
  ];

  for (const c of communications) {
    run(
      `INSERT INTO communications (customer_id, opportunity_id, user_id, type, subject, content, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.cust, c.opp, c.user, c.type, c.subject, c.content, c.date, c.date]
    );
  }

  // 10. Feedback
  const feedbacks = [
    { cust: 1, rating: 5, category: 'Sales Experience', comments: 'Marcus Brody was exceptionally knowledgeable and patient through our lengthy procurement cycle.', date: pastDays(10) },
    { cust: 3, rating: 5, category: 'Product Quality', comments: 'The automated quotation workflow saved our sales team over 15 hours per week immediately!', date: pastDays(8) },
    { cust: 7, rating: 5, category: 'Customer Service', comments: 'Dedicated SLA support team resolved our SSO integration question within 20 minutes.', date: pastDays(6) },
    { cust: 12, rating: 4, category: 'Onboarding', comments: 'Smooth onboarding experience overall. Would love more pre-built luxury retail templates.', date: pastDays(14) },
    { cust: 14, rating: 5, category: 'Product Quality', comments: 'The pipeline Kanban board gives our studio partners complete visibility on deal stages.', date: pastDays(12) },
    { cust: 4, rating: 4, category: 'Sales Experience', comments: 'Great demo and transparent pricing. Appreciate the attentive communication.', date: pastDays(4) }
  ];

  for (const fb of feedbacks) {
    run(
      `INSERT INTO feedback (customer_id, rating, comments, category, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fb.cust, fb.rating, fb.comments, fb.category, fb.date, fb.date]
    );
  }

  // 11. Support Tickets
  const tickets = [
    { num: 'TIK-6001', cust: 1, subject: 'SSO SAML Certificate Renewal Assistance', desc: 'Need guidance updating our Okta SAML certificate before expiration next week.', priority: 'Medium', assigned: 2, status: 'Open' },
    { num: 'TIK-6002', cust: 5, subject: 'ERP Webhook Sync Timeout Error', desc: 'Custom endpoint returning 504 on heavy batch invoice updates.', priority: 'High', assigned: 3, status: 'In Progress' },
    { num: 'TIK-6003', cust: 3, subject: 'Role Permission Configuration for Junior Analyst', desc: 'Need read-only access to customer 360 without export permissions.', priority: 'Low', assigned: 3, status: 'Resolved', res: 'Assigned custom viewer role in user security matrix.' },
    { num: 'TIK-6004', cust: 8, subject: 'POS Quotation Item Discrepancy', desc: 'Investigating rounding variance on cents in multi-line quote calculator.', priority: 'Medium', assigned: 2, status: 'Closed', res: 'Fixed decimal precision rounding in price configuration table.' }
  ];

  for (const t of tickets) {
    run(
      `INSERT INTO support_tickets (ticket_number, customer_id, subject, description, priority, assigned_user_id, status, resolution, created_at, updated_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.num, t.cust, t.subject, t.desc, t.priority, t.assigned, t.status, t.res || null, pastDays(5), pastDays(1), t.res ? pastDays(2) : null]
    );
  }

  // 12. Notifications
  const notifications = [
    { user_id: 2, title: 'Follow-up Overdue', message: 'Follow-up with Liam O’Connor (Summit Mfg) is overdue by 1 day.', type: 'followup', link: '/followups', is_read: 0 },
    { user_id: 2, title: 'Opportunity Moved to Negotiation', message: 'Apex Global Logistics opportunity moved to Negotiation stage.', type: 'opportunity', link: '/pipeline', is_read: 0 },
    { user_id: 3, title: 'New High-Value Lead Assigned', message: 'Lead Logan Roy (Waystar Global - $120,000) assigned to your queue.', type: 'lead', link: '/leads', is_read: 0 },
    { user_id: 2, title: 'Today\'s Follow-up Scheduled', message: 'Call with Jonathan Sterling scheduled today at 10:00 AM.', type: 'followup', link: '/followups', is_read: 1 },
    { user_id: 3, title: 'Order Completed', message: 'Order ORD-5001 for Nexus FinTech Labs marked Completed ($27,000).', type: 'order', link: '/orders', is_read: 1 }
  ];

  for (const n of notifications) {
    run(
      `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [n.user_id, n.title, n.message, n.type, n.link, n.is_read, pastDays(1)]
    );
  }

  // 13. Audit logs
  const auditLogs = [
    { user_id: 1, user_name: 'Elena Rostova', action: 'CREATED', entity: 'User', entity_id: '3', details: 'Added sales staff account for Sarah Connor (Sales Executive).' },
    { user_id: 2, user_name: 'Marcus Brody', action: 'CREATED', entity: 'Customer', entity_id: '1', details: 'Added new customer account Apex Global Logistics.' },
    { user_id: 2, user_name: 'Marcus Brody', action: 'STAGE_CHANGED', entity: 'Opportunity', entity_id: '1', details: 'Moved Apex Global Opportunity from Proposal to Negotiation.' },
    { user_id: 1, user_name: 'Elena Rostova', action: 'CONVERTED', entity: 'Opportunity', entity_id: '3', details: 'Converted Opportunity OPP-3003 ($28,000) to Customer Order.' },
    { user_id: 2, user_name: 'Marcus Brody', action: 'CREATED', entity: 'Quotation', entity_id: '1', details: 'Generated official quotation QUO-4001 for Apex Global Logistics.' },
    { user_id: 2, user_name: 'Marcus Brody', action: 'STATUS_CHANGED', entity: 'Order', entity_id: '1', details: 'Updated Order ORD-5001 status to Completed.' }
  ];

  for (const a of auditLogs) {
    run(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.user_id, a.user_name, a.action, a.entity, a.entity_id, a.details, pastDays(2)]
    );
  }

  seedCustomerPortalData();
  console.log('Insight360 database successfully seeded with customer portal demo records.');
}
