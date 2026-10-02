import { getDb, all, run, saveDb } from './server/db/database';
import { initializeSchema } from './server/db/schema';

async function main() {
  await getDb();
  await initializeSchema();

  const existingProducts = all<any>('SELECT * FROM products');
  console.log('Existing products count:', existingProducts.length);
  console.log('Existing products:', existingProducts);

  if (existingProducts.length === 0) {
    console.log('Seeding products...');
    const products = [
      { name: 'Enterprise CRM Cloud Platform', sku: 'PROD-CRM-ENT', category: 'Software License', unit_price: 12000, description: 'Annual subscription for up to 100 sales users with advanced workflows.' },
      { name: 'Standard Sales Ops Suite', sku: 'PROD-CRM-STD', category: 'Software License', unit_price: 4800, description: 'Annual license for mid-market teams with pipeline and contact automation.' },
      { name: 'Rapid Onboarding & Migration Service', sku: 'SERV-ONBOARD', category: 'Professional Services', unit_price: 3500, description: 'Complete turnkey migration from legacy CRM with staff coaching.' },
      { name: 'Dedicated 24/7 SLA Support Package', sku: 'SERV-SUPP-247', category: 'Support & Maintenance', unit_price: 6000, description: 'Round-the-clock priority technical support and dedicated TAM.' },
      { name: 'Custom ERP & BI Data Pipeline Connector', sku: 'SERV-INT-ERP', category: 'Engineering Integration', unit_price: 7500, description: 'Custom bidirectional API connector for SAP, Oracle, or NetSuite.' },
      { name: 'Sales Performance & AI Forecasting Add-on', sku: 'PROD-AI-FORECAST', category: 'Add-on Module', unit_price: 2400, description: 'Machine-learning pipeline forecasting and deal risk analytics.' }
    ];

    const now = new Date().toISOString();
    for (const p of products) {
      run(
        `INSERT INTO products (name, sku, category, unit_price, description, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [p.name, p.sku, p.category, p.unit_price, p.description, now]
      );
    }
    saveDb();
    console.log('Products seeded successfully.');
  }
}

main().catch(console.error);
