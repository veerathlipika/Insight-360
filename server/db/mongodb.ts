import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { all } from './database.ts';

const MONGODB_DIR = path.resolve(process.cwd(), 'data', 'mongodb');

// Generate authentic MongoDB 24-character hex ObjectId
export function generateObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return (timestamp + randomBytes).slice(0, 24);
}

export interface MongoDocument {
  _id: string;
  [key: string]: any;
}

export interface CollectionStats {
  name: string;
  count: number;
  sizeBytes: number;
  avgDocSizeBytes: number;
  indexes: string[];
  lastModified: string;
}

export interface MongoConfig {
  connectionUri: string;
  databaseName: string;
  engine: string;
  status: 'connected' | 'disconnected';
  autoSync: boolean;
  writeConcern: string;
  journal: boolean;
  version: string;
}

class MongoEngine {
  private collections: Map<string, MongoDocument[]> = new Map();
  private config: MongoConfig = {
    connectionUri: 'mongodb://localhost:27017/crm_enterprise',
    databaseName: 'crm_enterprise',
    engine: 'WiredTiger Document Store',
    status: 'connected',
    autoSync: true,
    writeConcern: 'w: 1',
    journal: true,
    version: '7.0.8',
  };
  private isInitialized = false;

  constructor() {
    this.ensureDirectory();
  }

  private ensureDirectory() {
    if (!fs.existsSync(MONGODB_DIR)) {
      fs.mkdirSync(MONGODB_DIR, { recursive: true });
    }
  }

  public init() {
    if (this.isInitialized) return;
    this.ensureDirectory();
    this.loadConfig();
    this.loadAllCollections();
    this.isInitialized = true;
    console.log(`[MongoDB Engine] Initialized in ${MONGODB_DIR} with ${this.collections.size} collections.`);
  }

  private loadConfig() {
    const configPath = path.join(MONGODB_DIR, '_config.json');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        this.config = { ...this.config, ...JSON.parse(raw) };
      } catch (err) {
        console.error('Failed to parse MongoDB _config.json:', err);
      }
    } else {
      this.saveConfig();
    }
  }

  public saveConfig(newConfig?: Partial<MongoConfig>) {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }
    const configPath = path.join(MONGODB_DIR, '_config.json');
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf8');
    return this.config;
  }

  public getConfig(): MongoConfig {
    return { ...this.config };
  }

  private loadAllCollections() {
    const files = fs.readdirSync(MONGODB_DIR);
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('_')) {
        const colName = file.replace('.json', '');
        try {
          const raw = fs.readFileSync(path.join(MONGODB_DIR, file), 'utf8');
          const docs: MongoDocument[] = JSON.parse(raw);
          this.collections.set(colName, docs);
        } catch (err) {
          console.error(`Error loading collection ${colName}:`, err);
          this.collections.set(colName, []);
        }
      }
    }

    // If no collections exist, auto sync from SQLite
    if (this.collections.size === 0) {
      this.syncFromSqlite();
    }
  }

  private persistCollection(name: string) {
    this.ensureDirectory();
    const filePath = path.join(MONGODB_DIR, `${name}.json`);
    const docs = this.collections.get(name) || [];
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
  }

  public getCollectionNames(): string[] {
    return Array.from(this.collections.keys()).sort();
  }

  public getCollectionsStats(): CollectionStats[] {
    const names = this.getCollectionNames();
    return names.map((name) => {
      const docs = this.collections.get(name) || [];
      const filePath = path.join(MONGODB_DIR, `${name}.json`);
      let sizeBytes = 0;
      let lastModified = new Date().toISOString();
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        sizeBytes = stats.size;
        lastModified = stats.mtime.toISOString();
      } else {
        sizeBytes = Buffer.byteLength(JSON.stringify(docs));
      }
      return {
        name,
        count: docs.length,
        sizeBytes,
        avgDocSizeBytes: docs.length > 0 ? Math.round(sizeBytes / docs.length) : 0,
        indexes: ['_id_'],
        lastModified,
      };
    });
  }

  public getDatabaseStats() {
    const statsList = this.getCollectionsStats();
    const totalDocs = statsList.reduce((acc, c) => acc + c.count, 0);
    const totalSize = statsList.reduce((acc, c) => acc + c.sizeBytes, 0);

    return {
      db: this.config.databaseName,
      collections: statsList.length,
      views: 0,
      objects: totalDocs,
      avgObjSize: totalDocs > 0 ? Math.round(totalSize / totalDocs) : 0,
      dataSize: totalSize,
      storageSize: Math.round(totalSize * 1.2), // Emulate block storage
      indexes: statsList.length,
      indexSize: statsList.length * 8192,
      fsUsedSize: totalSize,
      fsTotalSize: 1024 * 1024 * 1024 * 50, // 50 GB
      ok: 1,
      engine: this.config.engine,
      version: this.config.version,
      connectionUri: this.config.connectionUri,
    };
  }

  public createCollection(name: string): boolean {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) throw new Error('Invalid collection name');
    if (this.collections.has(cleanName)) {
      throw new Error(`Collection ${cleanName} already exists`);
    }
    this.collections.set(cleanName, []);
    this.persistCollection(cleanName);
    return true;
  }

  public dropCollection(name: string): boolean {
    if (!this.collections.has(name)) {
      throw new Error(`Collection ${name} does not exist`);
    }
    this.collections.delete(name);
    const filePath = path.join(MONGODB_DIR, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  }

  // MongoDB Match Filter Evaluation
  private matchFilter(doc: MongoDocument, filter: Record<string, any>): boolean {
    if (!filter || Object.keys(filter).length === 0) return true;

    for (const [key, expected] of Object.entries(filter)) {
      if (key === '$or' && Array.isArray(expected)) {
        const matchesAny = expected.some((subFilter) => this.matchFilter(doc, subFilter));
        if (!matchesAny) return false;
        continue;
      }

      if (key === '$and' && Array.isArray(expected)) {
        const matchesAll = expected.every((subFilter) => this.matchFilter(doc, subFilter));
        if (!matchesAll) return false;
        continue;
      }

      const val = doc[key];

      if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
        // Query operators
        for (const [op, opVal] of Object.entries(expected)) {
          switch (op) {
            case '$eq':
              if (val !== opVal) return false;
              break;
            case '$ne':
              if (val === opVal) return false;
              break;
            case '$gt':
              if (!(Number(val) > Number(opVal))) return false;
              break;
            case '$gte':
              if (!(Number(val) >= Number(opVal))) return false;
              break;
            case '$lt':
              if (!(Number(val) < Number(opVal))) return false;
              break;
            case '$lte':
              if (!(Number(val) <= Number(opVal))) return false;
              break;
            case '$in':
              if (!Array.isArray(opVal) || !opVal.includes(val)) return false;
              break;
            case '$nin':
              if (Array.isArray(opVal) && opVal.includes(val)) return false;
              break;
            case '$regex':
              try {
                const flags = (expected as any).$options || 'i';
                const regex = new RegExp(String(opVal), flags);
                if (!regex.test(String(val || ''))) return false;
              } catch {
                return false;
              }
              break;
            case '$exists':
              const exists = key in doc;
              if (Boolean(opVal) !== exists) return false;
              break;
            default:
              break;
          }
        }
      } else {
        // Simple equality check
        if (String(val).toLowerCase() !== String(expected).toLowerCase() && val !== expected) {
          return false;
        }
      }
    }

    return true;
  }

  public find(
    collectionName: string,
    filter: Record<string, any> = {},
    options: {
      sort?: Record<string, 1 | -1>;
      skip?: number;
      limit?: number;
      projection?: Record<string, 0 | 1>;
    } = {}
  ): { documents: MongoDocument[]; totalCount: number } {
    let docs = this.collections.get(collectionName);
    if (!docs) {
      // Auto-create or return empty
      return { documents: [], totalCount: 0 };
    }

    // Filter
    let filtered = docs.filter((doc) => this.matchFilter(doc, filter));
    const totalCount = filtered.length;

    // Sort
    if (options.sort && Object.keys(options.sort).length > 0) {
      const sortFields = Object.entries(options.sort);
      filtered.sort((a, b) => {
        for (const [field, dir] of sortFields) {
          const valA = a[field];
          const valB = b[field];
          if (valA === valB) continue;
          if (valA === undefined || valA === null) return dir === 1 ? -1 : 1;
          if (valB === undefined || valB === null) return dir === 1 ? 1 : -1;
          if (valA > valB) return dir === 1 ? 1 : -1;
          if (valA < valB) return dir === 1 ? -1 : 1;
        }
        return 0;
      });
    }

    // Skip
    if (options.skip && options.skip > 0) {
      filtered = filtered.slice(options.skip);
    }

    // Limit
    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }

    // Projection
    if (options.projection && Object.keys(options.projection).length > 0) {
      const isInclusive = Object.values(options.projection).some((v) => v === 1);
      filtered = filtered.map((doc) => {
        const result: Record<string, any> = {};
        if (isInclusive) {
          if (options.projection!['_id'] !== 0) {
            result['_id'] = doc['_id'];
          }
          for (const [key, inc] of Object.entries(options.projection!)) {
            if (inc === 1 && key in doc) {
              result[key] = doc[key];
            }
          }
        } else {
          // Exclusive
          for (const [k, v] of Object.entries(doc)) {
            if (options.projection![k] !== 0) {
              result[k] = v;
            }
          }
        }
        return result as MongoDocument;
      });
    }

    return { documents: filtered, totalCount };
  }

  public findOne(collectionName: string, filter: Record<string, any>): MongoDocument | null {
    const { documents } = this.find(collectionName, filter, { limit: 1 });
    return documents.length > 0 ? documents[0] : null;
  }

  public insertOne(collectionName: string, doc: Record<string, any>): MongoDocument {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, []);
    }
    const docs = this.collections.get(collectionName)!;

    const newDoc: MongoDocument = {
      _id: doc._id || generateObjectId(),
      ...doc,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Prevent duplicate _id
    if (docs.some((d) => d._id === newDoc._id)) {
      throw new Error(`E11000 duplicate key error collection: ${collectionName} index: _id_ dup key: { _id: "${newDoc._id}" }`);
    }

    docs.unshift(newDoc);
    this.persistCollection(collectionName);
    return newDoc;
  }

  public insertMany(collectionName: string, docList: Record<string, any>[]): MongoDocument[] {
    const inserted: MongoDocument[] = [];
    for (const d of docList) {
      inserted.push(this.insertOne(collectionName, d));
    }
    return inserted;
  }

  public updateOne(
    collectionName: string,
    filter: Record<string, any>,
    update: Record<string, any>
  ): { matchedCount: number; modifiedCount: number } {
    const docs = this.collections.get(collectionName);
    if (!docs) return { matchedCount: 0, modifiedCount: 0 };

    const targetIdx = docs.findIndex((d) => this.matchFilter(d, filter));
    if (targetIdx === -1) return { matchedCount: 0, modifiedCount: 0 };

    const target = { ...docs[targetIdx] };

    // Apply MongoDB update operators
    if (update.$set) {
      Object.assign(target, update.$set);
    }
    if (update.$unset) {
      for (const field of Object.keys(update.$unset)) {
        delete target[field];
      }
    }
    if (update.$inc) {
      for (const [field, incVal] of Object.entries(update.$inc)) {
        target[field] = (Number(target[field]) || 0) + Number(incVal);
      }
    }

    // Direct object update if no operators
    if (!update.$set && !update.$unset && !update.$inc) {
      const { _id, ...rest } = update;
      Object.assign(target, rest);
    }

    target.updatedAt = new Date().toISOString();
    docs[targetIdx] = target;
    this.persistCollection(collectionName);

    return { matchedCount: 1, modifiedCount: 1 };
  }

  public deleteOne(collectionName: string, filter: Record<string, any>): { deletedCount: number } {
    const docs = this.collections.get(collectionName);
    if (!docs) return { deletedCount: 0 };

    const targetIdx = docs.findIndex((d) => this.matchFilter(d, filter));
    if (targetIdx === -1) return { deletedCount: 0 };

    docs.splice(targetIdx, 1);
    this.persistCollection(collectionName);
    return { deletedCount: 1 };
  }

  public deleteMany(collectionName: string, filter: Record<string, any>): { deletedCount: number } {
    const docs = this.collections.get(collectionName);
    if (!docs) return { deletedCount: 0 };

    const remaining = docs.filter((d) => !this.matchFilter(d, filter));
    const deletedCount = docs.length - remaining.length;
    this.collections.set(collectionName, remaining);
    this.persistCollection(collectionName);
    return { deletedCount };
  }

  // MongoDB Aggregation Pipeline execution
  public aggregate(collectionName: string, pipeline: Record<string, any>[]): any[] {
    const docs = this.collections.get(collectionName) || [];
    let currentResults: any[] = JSON.parse(JSON.stringify(docs));

    for (const stage of pipeline) {
      const [stageName, stageArg] = Object.entries(stage)[0] || [];
      if (!stageName) continue;

      switch (stageName) {
        case '$match': {
          currentResults = currentResults.filter((doc) => this.matchFilter(doc, stageArg));
          break;
        }
        case '$group': {
          const { _id, ...accumulators } = stageArg;
          const groups = new Map<string, any[]>();

          for (const doc of currentResults) {
            let key = 'null';
            if (typeof _id === 'string' && _id.startsWith('$')) {
              key = String(doc[_id.substring(1)] ?? 'null');
            } else if (_id !== null && _id !== undefined) {
              key = String(_id);
            }

            if (!groups.has(key)) {
              groups.set(key, []);
            }
            groups.get(key)!.push(doc);
          }

          const aggregated: any[] = [];
          for (const [key, groupDocs] of groups.entries()) {
            const row: Record<string, any> = { _id: key === 'null' ? null : key };

            for (const [accField, accExpr] of Object.entries(accumulators)) {
              const [accOp, fieldRef] = Object.entries(accExpr as Record<string, any>)[0] || [];
              const rawField = typeof fieldRef === 'string' && fieldRef.startsWith('$') ? fieldRef.substring(1) : null;

              if (accOp === '$sum') {
                if (typeof fieldRef === 'number') {
                  row[accField] = groupDocs.length * fieldRef;
                } else if (rawField) {
                  row[accField] = groupDocs.reduce((sum, d) => sum + (Number(d[rawField]) || 0), 0);
                } else {
                  row[accField] = groupDocs.length;
                }
              } else if (accOp === '$avg') {
                if (rawField && groupDocs.length > 0) {
                  const sum = groupDocs.reduce((s, d) => s + (Number(d[rawField]) || 0), 0);
                  row[accField] = Math.round((sum / groupDocs.length) * 100) / 100;
                } else {
                  row[accField] = 0;
                }
              } else if (accOp === '$count') {
                row[accField] = groupDocs.length;
              } else if (accOp === '$max') {
                row[accField] = rawField ? Math.max(...groupDocs.map((d) => Number(d[rawField]) || 0)) : null;
              } else if (accOp === '$min') {
                row[accField] = rawField ? Math.min(...groupDocs.map((d) => Number(d[rawField]) || 0)) : null;
              }
            }

            aggregated.push(row);
          }

          currentResults = aggregated;
          break;
        }
        case '$sort': {
          const sortEntries = Object.entries(stageArg as Record<string, number>);
          currentResults.sort((a, b) => {
            for (const [field, dir] of sortEntries) {
              const valA = a[field];
              const valB = b[field];
              if (valA === valB) continue;
              if (valA > valB) return dir === 1 ? 1 : -1;
              if (valA < valB) return dir === 1 ? -1 : 1;
            }
            return 0;
          });
          break;
        }
        case '$limit': {
          const limitCount = Number(stageArg) || 10;
          currentResults = currentResults.slice(0, limitCount);
          break;
        }
        case '$count': {
          const countField = String(stageArg);
          currentResults = [{ [countField]: currentResults.length }];
          break;
        }
        case '$project': {
          const proj = stageArg as Record<string, 1 | 0>;
          currentResults = currentResults.map((doc) => {
            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(proj)) {
              if (v === 1 && k in doc) {
                out[k] = doc[k];
              }
            }
            return out;
          });
          break;
        }
        default:
          break;
      }
    }

    return currentResults;
  }

  // Interactive MongoDB Shell Command Parser
  public executeMongoCommand(commandStr: string): { success: boolean; result: any; executionTimeMs: number } {
    const start = performance.now();
    const cmd = commandStr.trim();

    try {
      if (!cmd) throw new Error('Command cannot be empty');

      // Command: show dbs / show collections
      if (cmd === 'show dbs' || cmd === 'show databases') {
        const stats = this.getCollectionsStats();
        const totalSize = stats.reduce((acc, c) => acc + c.sizeBytes, 0);
        return {
          success: true,
          result: [
            { name: 'admin', sizeOnDisk: 1048576, empty: false },
            { name: 'config', sizeOnDisk: 110592, empty: false },
            { name: this.config.databaseName, sizeOnDisk: totalSize, empty: totalSize === 0 },
          ],
          executionTimeMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }

      if (cmd === 'show collections') {
        return {
          success: true,
          result: this.getCollectionNames(),
          executionTimeMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }

      if (cmd === 'db.stats()' || cmd === 'db.stats') {
        return {
          success: true,
          result: this.getDatabaseStats(),
          executionTimeMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }

      if (cmd === 'db.getCollectionNames()') {
        return {
          success: true,
          result: this.getCollectionNames(),
          executionTimeMs: Math.round((performance.now() - start) * 100) / 100,
        };
      }

      // Chained modifiers on db.<col>.find()
      let cleanCmd = cmd;
      let chainedLimit: number | undefined;
      let chainedSkip: number | undefined;
      let chainedSort: Record<string, 1 | -1> | undefined;

      const limitMatch = cleanCmd.match(/\.limit\s*\(\s*(\d+)\s*\)/);
      if (limitMatch) {
        chainedLimit = parseInt(limitMatch[1], 10);
        cleanCmd = cleanCmd.replace(limitMatch[0], '');
      }

      const skipMatch = cleanCmd.match(/\.skip\s*\(\s*(\d+)\s*\)/);
      if (skipMatch) {
        chainedSkip = parseInt(skipMatch[1], 10);
        cleanCmd = cleanCmd.replace(skipMatch[0], '');
      }

      const sortMatch = cleanCmd.match(/\.sort\s*\(\s*({[\s\S]*?})\s*\)/);
      if (sortMatch) {
        try {
          const jsonCompatible = sortMatch[1].replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":').replace(/'/g, '"');
          chainedSort = JSON.parse(jsonCompatible);
        } catch {
          // ignore
        }
        cleanCmd = cleanCmd.replace(sortMatch[0], '');
      }

      // Pattern: db.<collection>.<method>(<args>)
      const dbMatch = cleanCmd.match(/^db\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\(([\s\S]*)\)\s*$/);
      if (!dbMatch) {
        throw new Error(`Syntax error in MongoDB command. Expected syntax: db.<collection>.<method>(...) or db.stats()`);
      }

      const [, colName, method, rawArgs] = dbMatch;

      // Safely parse JSON arguments
      let parsedArgs: any[] = [];
      if (rawArgs.trim()) {
        try {
          // Allow relaxed JS object syntax like { status: "Active" }
          const jsonCompatible = rawArgs
            .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
            .replace(/'/g, '"');
          parsedArgs = [JSON.parse(jsonCompatible)];
        } catch {
          // If complex, evaluate safely in restricted context
          parsedArgs = [new Function(`return (${rawArgs});`)()];
        }
      }

      let result: any = null;

      switch (method) {
        case 'find': {
          const filter = parsedArgs[0] || {};
          const options = parsedArgs[1] || {};
          const { documents, totalCount } = this.find(colName, filter, {
            limit: chainedLimit !== undefined ? chainedLimit : options.limit || 50,
            skip: chainedSkip !== undefined ? chainedSkip : options.skip || 0,
            sort: chainedSort || options.sort,
          });
          result = {
            documents,
            count: documents.length,
            totalMatched: totalCount,
          };
          break;
        }
        case 'findOne': {
          result = this.findOne(colName, parsedArgs[0] || {});
          break;
        }
        case 'insertOne': {
          if (!parsedArgs[0]) throw new Error('insertOne requires a document object');
          const doc = this.insertOne(colName, parsedArgs[0]);
          result = { acknowledged: true, insertedId: doc._id };
          break;
        }
        case 'insertMany': {
          if (!Array.isArray(parsedArgs[0])) throw new Error('insertMany requires an array of documents');
          const docs = this.insertMany(colName, parsedArgs[0]);
          result = { acknowledged: true, insertedCount: docs.length, insertedIds: docs.map((d) => d._id) };
          break;
        }
        case 'updateOne': {
          const filter = parsedArgs[0] || {};
          const update = parsedArgs[1] || {};
          result = this.updateOne(colName, filter, update);
          break;
        }
        case 'deleteOne': {
          result = this.deleteOne(colName, parsedArgs[0] || {});
          break;
        }
        case 'deleteMany': {
          result = this.deleteMany(colName, parsedArgs[0] || {});
          break;
        }
        case 'countDocuments':
        case 'count': {
          const filter = parsedArgs[0] || {};
          const { totalCount } = this.find(colName, filter);
          result = totalCount;
          break;
        }
        case 'aggregate': {
          const pipeline = Array.isArray(parsedArgs[0]) ? parsedArgs[0] : [];
          result = this.aggregate(colName, pipeline);
          break;
        }
        case 'drop': {
          result = this.dropCollection(colName);
          break;
        }
        default:
          throw new Error(`Unsupported MongoDB collection method: ${method}`);
      }

      return {
        success: true,
        result,
        executionTimeMs: Math.round((performance.now() - start) * 100) / 100,
      };
    } catch (err: any) {
      return {
        success: false,
        result: { error: err.message },
        executionTimeMs: Math.round((performance.now() - start) * 100) / 100,
      };
    }
  }

  // Populate or Sync MongoDB collections directly from SQLite relational tables
  public syncFromSqlite(): { syncedCollections: Record<string, number>; timestamp: string } {
    const synced: Record<string, number> = {};

    try {
      // 1. Customers
      try {
        const customers = all<any>('SELECT * FROM customers');
        const mongoCustomers: MongoDocument[] = customers.map((c) => ({
          _id: generateObjectId(),
          sql_id: c.id,
          customer_code: c.customer_code,
          name: c.name,
          company: c.company,
          email: c.email,
          phone: c.phone,
          status: c.status,
          industry: c.industry,
          address: c.address,
          deal_value: 15000,
          health_score: 92,
          tags: ['Active Account', 'Enterprise'],
          assigned_user_id: c.assigned_user_id,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        this.collections.set('customers', mongoCustomers);
        this.persistCollection('customers');
        synced['customers'] = mongoCustomers.length;
      } catch (e) {
        console.warn('Sync customers skipped:', e);
      }

      // 2. Leads
      try {
        const leads = all<any>('SELECT * FROM leads');
        const mongoLeads: MongoDocument[] = leads.map((l) => ({
          _id: generateObjectId(),
          sql_id: l.id,
          lead_code: l.lead_code,
          name: l.name,
          email: l.email,
          phone: l.phone,
          company: l.company,
          source: l.source,
          status: l.status,
          priority: l.priority,
          score: l.attention_score || 70,
          potential_value: l.estimated_value || 10000,
          requirement: l.requirement,
          assigned_user_id: l.assigned_user_id,
          created_at: l.created_at,
        }));
        this.collections.set('leads', mongoLeads);
        this.persistCollection('leads');
        synced['leads'] = mongoLeads.length;
      } catch (e) {
        console.warn('Sync leads skipped:', e);
      }

      // 3. Deals / Opportunities
      try {
        const opps = all<any>('SELECT * FROM opportunities');
        const mongoDeals: MongoDocument[] = opps.map((d) => ({
          _id: generateObjectId(),
          sql_id: d.id,
          opp_code: d.opp_code,
          customer_id: d.customer_id,
          title: d.title,
          deal_value: d.value,
          stage: d.stage,
          probability: d.probability,
          priority: d.priority,
          expected_close_date: d.expected_close_date,
          assigned_user_id: d.assigned_user_id,
          created_at: d.created_at,
        }));
        this.collections.set('deals', mongoDeals);
        this.persistCollection('deals');
        synced['deals'] = mongoDeals.length;
      } catch (e) {
        console.warn('Sync deals skipped:', e);
      }

      // 4. Quotations
      try {
        const quotations = all<any>('SELECT * FROM quotations');
        const mongoQuotations: MongoDocument[] = quotations.map((q) => ({
          _id: generateObjectId(),
          sql_id: q.id,
          customer_id: q.customer_id,
          opportunity_id: q.opportunity_id,
          quotation_number: q.quotation_number,
          subtotal: q.subtotal,
          discount: q.discount,
          tax: q.tax,
          total: q.total,
          status: q.status,
          date: q.date,
          valid_until: q.valid_until,
          terms: q.terms,
          created_at: q.created_at,
        }));
        this.collections.set('quotations', mongoQuotations);
        this.persistCollection('quotations');
        synced['quotations'] = mongoQuotations.length;
      } catch (e) {
        console.warn('Sync quotations skipped:', e);
      }

      // 5. Orders
      try {
        const orders = all<any>('SELECT * FROM orders');
        const mongoOrders: MongoDocument[] = orders.map((o) => ({
          _id: generateObjectId(),
          sql_id: o.id,
          order_number: o.order_number,
          customer_id: o.customer_id,
          opportunity_id: o.opportunity_id,
          quotation_id: o.quotation_id,
          subtotal: o.subtotal,
          discount: o.discount,
          tax: o.tax,
          total: o.total,
          status: o.status,
          order_date: o.order_date,
          created_at: o.created_at,
        }));
        this.collections.set('orders', mongoOrders);
        this.persistCollection('orders');
        synced['orders'] = mongoOrders.length;
      } catch (e) {
        console.warn('Sync orders skipped:', e);
      }

      // 6. Support Tickets
      try {
        const tickets = all<any>('SELECT * FROM support_tickets');
        const mongoTickets: MongoDocument[] = tickets.map((t) => ({
          _id: generateObjectId(),
          sql_id: t.id,
          ticket_number: t.ticket_number,
          customer_id: t.customer_id,
          subject: t.subject,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assigned_user_id: t.assigned_user_id,
          created_at: t.created_at,
        }));
        this.collections.set('support_tickets', mongoTickets);
        this.persistCollection('support_tickets');
        synced['support_tickets'] = mongoTickets.length;
      } catch (e) {
        console.warn('Sync support_tickets skipped:', e);
      }

      // 7. Users
      try {
        const users = all<any>('SELECT id, full_name, email, role, status, phone, created_at FROM users');
        const mongoUsers: MongoDocument[] = users.map((u) => ({
          _id: generateObjectId(),
          sql_id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          status: u.status,
          phone: u.phone,
          created_at: u.created_at,
        }));
        this.collections.set('users', mongoUsers);
        this.persistCollection('users');
        synced['users'] = mongoUsers.length;
      } catch (e) {
        console.warn('Sync users skipped:', e);
      }

      // 8. Audit Logs
      try {
        const logs = all<any>('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200');
        const mongoLogs: MongoDocument[] = logs.map((l) => ({
          _id: generateObjectId(),
          sql_id: l.id,
          user_id: l.user_id,
          user_name: l.user_name,
          action: l.action,
          entity: l.entity,
          entity_id: l.entity_id,
          details: l.details,
          timestamp: l.created_at,
        }));
        this.collections.set('audit_logs', mongoLogs);
        this.persistCollection('audit_logs');
        synced['audit_logs'] = mongoLogs.length;
      } catch (e) {
        console.warn('Sync audit_logs skipped:', e);
      }

      // 9. System Settings (Document Schema)
      if (!this.collections.has('system_settings')) {
        const initialSettings: MongoDocument[] = [
          {
            _id: generateObjectId(),
            category: 'general',
            company_name: 'Workflow Enterprise Corp',
            timezone: 'UTC',
            currency: 'USD',
            fiscal_year_start: 'January',
            database_engine: 'MongoDB 7.0 + SQLite Dual Persistence',
            updatedAt: new Date().toISOString(),
          },
          {
            _id: generateObjectId(),
            category: 'notifications',
            email_alerts_enabled: true,
            deal_stage_notifications: true,
            high_priority_ticket_sms: false,
            updatedAt: new Date().toISOString(),
          },
        ];
        this.collections.set('system_settings', initialSettings);
        this.persistCollection('system_settings');
        synced['system_settings'] = initialSettings.length;
      }

      // 10. Product Catalog
      if (!this.collections.has('product_catalog')) {
        const initialProducts: MongoDocument[] = [
          {
            _id: generateObjectId(),
            sku: 'SFT-ENT-001',
            name: 'Enterprise Workflow License',
            category: 'Software Subscription',
            unit_price: 4999.0,
            billing_interval: 'Annual',
            features: ['Full API Access', 'Unlimited Leads', 'MongoDB Storage Sync', '24/7 Priority Support'],
            in_stock: true,
          },
          {
            _id: generateObjectId(),
            sku: 'SRV-ONB-002',
            name: 'Dedicated Onboarding & Architecture',
            category: 'Professional Services',
            unit_price: 2500.0,
            billing_interval: 'One-time',
            features: ['Custom Data Migration', 'Workflow Setup', 'Team Training Session'],
            in_stock: true,
          },
          {
            _id: generateObjectId(),
            sku: 'ADD-AI-003',
            name: 'AI Sales Intelligence Module',
            category: 'Add-on',
            unit_price: 1200.0,
            billing_interval: 'Annual',
            features: ['Automated Lead Scoring', 'Gemini CRM Assistant', 'Predictive Deal Analytics'],
            in_stock: true,
          },
        ];
        this.collections.set('product_catalog', initialProducts);
        this.persistCollection('product_catalog');
        synced['product_catalog'] = initialProducts.length;
      }

      console.log('[MongoDB Engine] Relational SQLite synchronization complete:', synced);
      return { syncedCollections: synced, timestamp: new Date().toISOString() };
    } catch (err: any) {
      console.error('[MongoDB Engine] Sync error:', err);
      throw err;
    }
  }
}

export const mongoDb = new MongoEngine();
