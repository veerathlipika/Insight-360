import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './server/routes/api.ts';
import customerPortalRoutes from './server/routes/customerPortal.ts';
import mongodbRoutes from './server/routes/mongodb.ts';
import { getDb } from './server/db/database.ts';
import { initializeSchema } from './server/db/schema.ts';
import { seedDatabase } from './server/db/seed.ts';
import { mongoDb } from './server/db/mongodb.ts';
import { startCustomerReminderScheduler } from './server/services/customerReminderService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Initialize SQL relational database and seeds
  console.log('Initializing database engine...');
  await getDb();
  initializeSchema();
  await seedDatabase();

  // Initialize MongoDB Document Storage Engine
  console.log('Initializing MongoDB document storage engine...');
  mongoDb.init();

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API endpoints
  app.use('/api/mongodb', mongodbRoutes);
  app.use('/api', customerPortalRoutes);
  app.use('/api', apiRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in development mode');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static assets from dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Insight360 server listening on http://0.0.0.0:${PORT}`);
    startCustomerReminderScheduler();
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
