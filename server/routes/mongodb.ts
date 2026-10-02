import express, { Request, Response } from 'express';
import { mongoDb } from '../db/mongodb.ts';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.ts';
import { logAudit } from '../services/auditService.ts';

const router = express.Router();

// Apply authentication to all MongoDB endpoints
router.use(authenticate);

// 1. Get MongoDB Database & Storage Statistics
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = mongoDb.getDatabaseStats();
    const collections = mongoDb.getCollectionsStats();
    const config = mongoDb.getConfig();
    res.json({
      stats,
      collections,
      config,
    });
  } catch (err: any) {
    console.error('MongoDB stats error:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve MongoDB statistics' });
  }
});

// 2. Get Config
router.get('/config', (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = mongoDb.getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Config (Connection URI, settings)
router.post('/config', (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = mongoDb.saveConfig(req.body);
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'UPDATE_CONFIG', 'MongoDB', 0, `Updated MongoDB connection URI / settings`);
    }
    res.json({ success: true, config: updated, message: 'MongoDB configuration updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. List Collections
router.get('/collections', (req: AuthenticatedRequest, res: Response) => {
  try {
    const collections = mongoDb.getCollectionsStats();
    res.json(collections);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create Collection
router.post('/collections', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    mongoDb.createCollection(name);
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'CREATE_COLLECTION', 'MongoDB', 0, `Created collection: ${name}`);
    }
    res.json({ success: true, message: `Collection ${name} created successfully` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Drop Collection
router.delete('/collections/:name', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.params;
    mongoDb.dropCollection(name);
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'DROP_COLLECTION', 'MongoDB', 0, `Dropped collection: ${name}`);
    }
    res.json({ success: true, message: `Collection ${name} dropped successfully` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Execute Structured MongoDB Query
router.post('/query', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection, filter = {}, sort, skip = 0, limit = 50, projection } = req.body;
    if (!collection) {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }

    const startTime = performance.now();
    const result = mongoDb.find(collection, filter, {
      sort,
      skip: Number(skip),
      limit: Number(limit),
      projection,
    });
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    res.json({
      collection,
      documents: result.documents,
      count: result.documents.length,
      totalMatched: result.totalCount,
      executionTimeMs,
      filter,
      options: { sort, skip, limit, projection },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Execute MongoDB Shell Command (e.g. db.customers.find({ status: "Active" }))
router.post('/console', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      res.status(400).json({ error: 'Command string is required' });
      return;
    }

    const output = mongoDb.executeMongoCommand(command);
    res.json(output);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Sync from Relational SQLite to MongoDB
router.post('/sync', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = mongoDb.syncFromSqlite();
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'SYNC_DATABASE', 'MongoDB', 0, 'Synchronized relational SQLite data into MongoDB collections');
    }
    res.json({
      success: true,
      message: 'Successfully synchronized relational database tables into MongoDB collections',
      syncedCollections: result.syncedCollections,
      timestamp: result.timestamp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// 10. Insert Document
router.post('/collections/:name/documents', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.params;
    const doc = req.body;
    if (!doc || typeof doc !== 'object') {
      res.status(400).json({ error: 'Valid JSON document object is required' });
      return;
    }

    const inserted = mongoDb.insertOne(name, doc);
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'INSERT_DOCUMENT', 'MongoDB', 0, `Inserted document in ${name}: ${inserted._id}`);
    }
    res.status(201).json({ success: true, document: inserted });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Get Single Document by _id
router.get('/collections/:name/documents/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, id } = req.params;
    const doc = mongoDb.findOne(name, { _id: id });
    if (!doc) {
      res.status(404).json({ error: `Document with _id ${id} not found in ${name}` });
      return;
    }
    res.json(doc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Update Document by _id
router.put('/collections/:name/documents/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, id } = req.params;
    const update = req.body;
    const result = mongoDb.updateOne(name, { _id: id }, update);
    if (result.matchedCount === 0) {
      res.status(404).json({ error: `Document with _id ${id} not found in ${name}` });
      return;
    }
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'UPDATE_DOCUMENT', 'MongoDB', 0, `Updated document in ${name}: ${id}`);
    }
    res.json({ success: true, message: 'Document updated successfully', result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 13. Delete Document by _id
router.delete('/collections/:name/documents/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, id } = req.params;
    const result = mongoDb.deleteOne(name, { _id: id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: `Document with _id ${id} not found in ${name}` });
      return;
    }
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'DELETE_DOCUMENT', 'MongoDB', 0, `Deleted document in ${name}: ${id}`);
    }
    res.json({ success: true, message: 'Document deleted successfully', result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 14. Import JSON Documents
router.post('/import', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { collection, documents } = req.body;
    if (!collection || !Array.isArray(documents)) {
      res.status(400).json({ error: 'Collection name and array of documents are required' });
      return;
    }

    const inserted = mongoDb.insertMany(collection, documents);
    if (req.user) {
      logAudit(req.user.id, req.user.full_name, 'IMPORT_DOCUMENTS', 'MongoDB', 0, `Imported ${inserted.length} docs into ${collection}`);
    }
    res.json({ success: true, count: inserted.length, message: `Successfully imported ${inserted.length} documents into ${collection}` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 15. Export Collection JSON
router.get('/export/:name', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.params;
    const { documents } = mongoDb.find(name, {}, { limit: 10000 });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_mongodb_export.json"`);
    res.send(JSON.stringify(documents, null, 2));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
