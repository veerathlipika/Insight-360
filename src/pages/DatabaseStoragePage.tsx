import React, { useState, useEffect } from 'react';
import {
  Database,
  Terminal,
  FileCode2,
  FolderTree,
  HardDrive,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  Layers,
  ArrowRightLeft,
  Server,
  Download,
  Upload,
  Play,
  Copy,
  Clock,
  Settings,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
  Code2,
  Filter,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

interface MongoStats {
  db: string;
  collections: number;
  objects: number;
  avgObjSize: number;
  dataSize: number;
  storageSize: number;
  indexes: number;
  engine: string;
  version: string;
  connectionUri: string;
}

interface CollectionInfo {
  name: string;
  count: number;
  sizeBytes: number;
  avgDocSizeBytes: number;
  indexes: string[];
  lastModified: string;
}

export const DatabaseStoragePage: React.FC = () => {
  const { success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'explorer' | 'shell' | 'schema' | 'sync' | 'config'>('overview');

  // Stats & Collections
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MongoStats | null>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Explorer State
  const [selectedCollection, setSelectedCollection] = useState<string>('customers');
  const [documents, setDocuments] = useState<any[]>([]);
  const [totalDocsCount, setTotalDocsCount] = useState(0);
  const [filterQuery, setFilterQuery] = useState('');
  const [explorerViewMode, setExplorerViewMode] = useState<'cards' | 'table'>('cards');
  const [docLoading, setDocLoading] = useState(false);
  const [queryLimit, setQueryLimit] = useState(25);

  // Document Modal (Create / Edit)
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docJsonInput, setDocJsonInput] = useState('');
  const [docModalError, setDocModalError] = useState('');

  // Create Collection Modal
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');

  // Shell State
  const [shellCommand, setShellCommand] = useState('db.customers.find({ status: "Active" }).limit(5)');
  const [shellResult, setShellResult] = useState<any>(null);
  const [shellTiming, setShellTiming] = useState<number | null>(null);
  const [shellLoading, setShellLoading] = useState(false);
  const [shellSuccess, setShellSuccess] = useState<boolean | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Config State
  const [connectionUriInput, setConnectionUriInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Initial load
  const loadDatabaseData = async () => {
    try {
      setLoading(true);
      const res = await api.getMongoStats();
      setStats(res.stats);
      setCollections(res.collections);
      setConfig(res.config);
      setConnectionUriInput(res.config?.connectionUri || 'mongodb://localhost:27017/crm_enterprise');

      if (res.collections.length > 0 && !res.collections.some((c) => c.name === selectedCollection)) {
        setSelectedCollection(res.collections[0].name);
      }
    } catch (err: any) {
      error('Failed to load database stats', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // Fetch documents for explorer
  const fetchDocuments = async (colName: string = selectedCollection, filterText: string = filterQuery) => {
    if (!colName) return;
    try {
      setDocLoading(true);
      let parsedFilter = {};
      if (filterText.trim()) {
        try {
          const relaxed = filterText.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":').replace(/'/g, '"');
          parsedFilter = JSON.parse(relaxed);
        } catch (e: any) {
          error('Invalid JSON filter format', 'Please check query syntax, e.g. { "status": "Active" }');
          setDocLoading(false);
          return;
        }
      }

      const res = await api.queryMongo({
        collection: colName,
        filter: parsedFilter,
        limit: queryLimit,
      });

      setDocuments(res.documents || []);
      setTotalDocsCount(res.totalMatched || 0);
    } catch (err: any) {
      error(`Error querying ${colName}`, err.message);
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCollection && activeTab === 'explorer') {
      fetchDocuments(selectedCollection, filterQuery);
    }
  }, [selectedCollection, activeTab]);

  // Execute Shell Command
  const handleExecuteShell = async (cmd: string = shellCommand) => {
    if (!cmd.trim()) return;
    try {
      setShellLoading(true);
      setShellSuccess(null);
      const res = await api.executeMongoConsole(cmd);
      setShellResult(res.result);
      setShellTiming(res.executionTimeMs);
      setShellSuccess(res.success);
      if (res.success) {
        success('MongoDB Command Executed', `Finished in ${res.executionTimeMs} ms`);
      } else {
        error('Query Error', res.result?.error || 'Command failed');
      }
    } catch (err: any) {
      setShellSuccess(false);
      setShellResult({ error: err.message });
      error('Execution error', err.message);
    } finally {
      setShellLoading(false);
    }
  };

  // Synchronize Relational DB to MongoDB
  const handleSyncDatabase = async () => {
    try {
      setSyncing(true);
      const res = await api.syncMongoWithSql();
      setSyncResult(res);
      success('Database Synchronized', res.message);
      await loadDatabaseData();
      if (activeTab === 'explorer') {
        fetchDocuments(selectedCollection);
      }
    } catch (err: any) {
      error('Synchronization failed', err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Open Document Modal
  const handleOpenDocModal = (doc?: any) => {
    if (doc) {
      setEditingDocId(doc._id);
      setDocJsonInput(JSON.stringify(doc, null, 2));
    } else {
      setEditingDocId(null);
      // Sample template based on collection
      const sample =
        selectedCollection === 'customers'
          ? {
              name: 'Acme Global Technologies',
              company: 'Acme Global Inc',
              email: 'contact@acmeglobal.io',
              phone: '+1 555-0144',
              status: 'Active',
              lifecycle_stage: 'Customer',
              industry: 'Enterprise Software',
              deal_value: 25000,
              health_score: 95,
              tags: ['Cloud', 'High-Priority', 'Renewed'],
            }
          : selectedCollection === 'leads'
          ? {
              name: 'Jordan Rivera',
              company: 'Apex Dynamics',
              email: 'jordan@apexdynamics.com',
              phone: '+1 555-0812',
              source: 'Webinar',
              status: 'Qualified',
              priority: 'High',
              score: 85,
              potential_value: 18000,
              notes: 'Expressed urgency for Q4 implementation.',
            }
          : {
              title: 'Sample Document',
              status: 'Active',
              category: 'Standard',
              attributes: { is_verified: true, level: 1 },
            };
      setDocJsonInput(JSON.stringify(sample, null, 2));
    }
    setDocModalError('');
    setIsDocModalOpen(true);
  };

  // Save Document
  const handleSaveDocument = async () => {
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(docJsonInput);
      } catch (e: any) {
        setDocModalError(`Invalid JSON: ${e.message}`);
        return;
      }

      if (editingDocId) {
        await api.updateMongoDocument(selectedCollection, editingDocId, parsed);
        success('Document Updated', `Document ${editingDocId} saved in ${selectedCollection}`);
      } else {
        const res = await api.insertMongoDocument(selectedCollection, parsed);
        success('Document Created', `Document inserted with _id: ${res.document._id}`);
      }

      setIsDocModalOpen(false);
      fetchDocuments(selectedCollection);
      loadDatabaseData();
    } catch (err: any) {
      setDocModalError(err.message);
      error('Failed to save document', err.message);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (id: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete document ${id}?`)) return;
    try {
      await api.deleteMongoDocument(selectedCollection, id);
      success('Document Deleted', `Deleted ${id} from ${selectedCollection}`);
      fetchDocuments(selectedCollection);
      loadDatabaseData();
    } catch (err: any) {
      error('Delete failed', err.message);
    }
  };

  // Create Collection
  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      await api.createMongoCollection(newColName.trim());
      success('Collection Created', `Created collection "${newColName.trim()}"`);
      setIsColModalOpen(false);
      setNewColName('');
      await loadDatabaseData();
      setSelectedCollection(newColName.trim());
      setActiveTab('explorer');
    } catch (err: any) {
      error('Failed to create collection', err.message);
    }
  };

  // Drop Collection
  const handleDropCollection = async (colName: string) => {
    if (!window.confirm(`Are you sure you want to DROP the collection "${colName}"? All documents inside will be deleted.`)) return;
    try {
      await api.dropMongoCollection(colName);
      success('Collection Dropped', `Collection ${colName} has been dropped`);
      await loadDatabaseData();
      if (selectedCollection === colName) {
        setSelectedCollection(collections[0]?.name || 'customers');
      }
    } catch (err: any) {
      error('Failed to drop collection', err.message);
    }
  };

  // Save Config
  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);
      await api.updateMongoConfig({ connectionUri: connectionUriInput });
      success('Configuration Saved', 'MongoDB connection parameters updated.');
      await loadDatabaseData();
    } catch (err: any) {
      error('Configuration error', err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Import JSON Documents
  const handleImportJson = async () => {
    try {
      let docs: any[];
      try {
        const parsed = JSON.parse(importJsonText);
        docs = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e: any) {
        error('Invalid JSON', e.message);
        return;
      }

      const res = await api.importMongoDocuments(selectedCollection, docs);
      success('Documents Imported', res.message);
      setIsImportModalOpen(false);
      setImportJsonText('');
      fetchDocuments(selectedCollection);
      loadDatabaseData();
    } catch (err: any) {
      error('Import failed', err.message);
    }
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Database className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Database &amp; MongoDB Studio</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  MongoDB 7.0 Document Engine
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[11px] font-semibold">
                  Dual Storage (SQLite + MongoDB)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Full-stack document database persistence, interactive MongoDB query shell, BSON schemas, and bidirectional CRM synchronization.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 relative z-10">
          <button
            onClick={handleSyncDatabase}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm disabled:opacity-50"
            title="Sync all relational SQLite tables to MongoDB documents"
          >
            <ArrowRightLeft className={`w-3.5 h-3.5 text-indigo-400 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync SQLite ↔ MongoDB'}
          </button>
          <button
            onClick={() => setIsColModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New Collection
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium scrollbar-thin">
        {[
          { id: 'overview', label: 'Database Overview & Storage', icon: HardDrive },
          { id: 'explorer', label: 'Collections & Document Explorer', icon: FolderTree },
          { id: 'shell', label: 'Interactive MongoDB Query Shell', icon: Terminal },
          { id: 'schema', label: 'Architecture & Document Schemas', icon: Layers },
          { id: 'sync', label: 'Relational Sync & Backup', icon: ArrowRightLeft },
          { id: 'config', label: 'Connection & Cluster Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition ${
                isActive
                  ? 'bg-slate-800 text-emerald-400 font-semibold border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & STORAGE */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Collections</span>
                <FolderTree className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {stats?.collections || collections.length}
              </div>
              <div className="text-[11px] text-emerald-400/80 mt-1 font-medium">
                Active BSON Collections
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Documents</span>
                <FileCode2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {stats?.objects?.toLocaleString() || collections.reduce((acc, c) => acc + c.count, 0)}
              </div>
              <div className="text-[11px] text-indigo-400/80 mt-1 font-medium">
                Stored Records across JSON/BSON
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Storage Size on Disk</span>
                <HardDrive className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {formatBytes(stats?.dataSize || 0)}
              </div>
              <div className="text-[11px] text-teal-400/80 mt-1 font-medium">
                Persistent `data/mongodb/`
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Query Engine</span>
                <Server className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                v{stats?.version || '7.0'}
              </div>
              <div className="text-[11px] text-amber-400/80 mt-1 font-medium">
                WiredTiger Emulation Active
              </div>
            </div>
          </div>

          {/* Database Architecture Health Card */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Full Persistent Dual Database Architecture Active
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                Every customer, lead, deal, quotation, order, and support ticket is maintained with strict relational integrity in SQLite and simultaneously accessible as high-speed NoSQL JSON/BSON documents in MongoDB format with complete query and aggregation pipelines.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => {
                  setSelectedCollection('customers');
                  setActiveTab('explorer');
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition"
              >
                Explore Customers
              </button>
              <button
                onClick={() => {
                  setShellCommand('db.stats()');
                  setActiveTab('shell');
                  handleExecuteShell('db.stats()');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition"
              >
                Inspect DB Stats
              </button>
            </div>
          </div>

          {/* Collections Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-emerald-400" />
                MongoDB Collections ({collections.length})
              </h2>
              <span className="text-xs text-slate-500">Auto-synchronized with disk storage</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((col) => (
                <div
                  key={col.name}
                  className="p-4 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl transition flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-emerald-500/40 transition">
                          <Code2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100 group-hover:text-emerald-300 transition">
                            {col.name}
                          </h3>
                          <span className="text-[10px] text-slate-500 font-mono">
                            data/mongodb/{col.name}.json
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-mono font-semibold">
                        {col.count} docs
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Storage Size</span>
                        <span className="font-semibold text-slate-200">{formatBytes(col.sizeBytes)}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="text-slate-500 block text-[10px]">Avg Doc Size</span>
                        <span className="font-semibold text-slate-200">{formatBytes(col.avgDocSizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setSelectedCollection(col.name);
                        setActiveTab('explorer');
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition"
                    >
                      Browse Documents <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/mongodb/export/${col.name}`}
                        download={`${col.name}.json`}
                        className="text-slate-400 hover:text-slate-200 p-1"
                        title="Download collection JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {col.name !== 'customers' && col.name !== 'users' && col.name !== 'leads' && (
                        <button
                          onClick={() => handleDropCollection(col.name)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Drop collection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: COLLECTIONS & DOCUMENT EXPLORER */}
      {/* ========================================================================= */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Collection Selector Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Collections</span>
              <button
                onClick={() => setIsColModalOpen(true)}
                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Create new collection"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 bg-slate-900 border border-slate-800 rounded-xl p-2 max-h-[600px] overflow-y-auto">
              {collections.map((col) => {
                const isSelected = selectedCollection === col.name;
                return (
                  <button
                    key={col.name}
                    onClick={() => {
                      setSelectedCollection(col.name);
                      setFilterQuery('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition text-left ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{col.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {col.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs space-y-2">
              <span className="font-semibold text-slate-300 block">Actions for "{selectedCollection}"</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenDocModal()}
                  className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center justify-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Insert Doc
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center justify-center gap-1 transition"
                >
                  <Upload className="w-3.5 h-3.5" /> Import
                </button>
              </div>
              <a
                href={`/api/mongodb/export/${selectedCollection}`}
                download={`${selectedCollection}.json`}
                className="w-full py-1.5 px-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-lg font-medium flex items-center justify-center gap-1 transition block text-center"
              >
                <Download className="w-3.5 h-3.5" /> Export Collection JSON
              </a>
            </div>
          </div>

          {/* Document Explorer Main View */}
          <div className="lg:col-span-3 space-y-4">
            {/* Filter and View Controls Bar */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <div className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchDocuments();
                    }}
                    placeholder='Filter: e.g. { "status": "Active" } or { "score": { "$gte": 70 } }'
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={() => fetchDocuments()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Filter className="w-3.5 h-3.5" /> Find
                </button>
                {filterQuery && (
                  <button
                    onClick={() => {
                      setFilterQuery('');
                      fetchDocuments(selectedCollection, '');
                    }}
                    className="px-2 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* View mode toggle & limits */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  Showing <b>{documents.length}</b> of {totalDocsCount}
                </span>
                <select
                  value={queryLimit}
                  onChange={(e) => {
                    const l = parseInt(e.target.value, 10);
                    setQueryLimit(l);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 px-2 py-1"
                >
                  <option value={10}>10 docs</option>
                  <option value={25}>25 docs</option>
                  <option value={50}>50 docs</option>
                  <option value={100}>100 docs</option>
                </select>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setExplorerViewMode('cards')}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      explorerViewMode === 'cards' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    JSON Cards
                  </button>
                  <button
                    onClick={() => setExplorerViewMode('table')}
                    className={`px-2 py-1 rounded text-xs font-medium transition ${
                      explorerViewMode === 'table' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Document Listing */}
            {docLoading ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Querying MongoDB collection "{selectedCollection}"...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <FolderTree className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No documents found matching criteria</p>
                <p className="text-xs text-slate-500">
                  Try adjusting the filter query or click below to insert the first document.
                </p>
                <button
                  onClick={() => handleOpenDocModal()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  Insert New Document
                </button>
              </div>
            ) : explorerViewMode === 'cards' ? (
              /* Cards View */
              <div className="space-y-3">
                {documents.map((doc, idx) => (
                  <div
                    key={doc._id || idx}
                    className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                          _id: ObjectId("{doc._id}")
                        </span>
                        {doc.status && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                            {doc.status}
                          </span>
                        )}
                        {doc.email && (
                          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                            {doc.email}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
                            info('Copied', 'Document JSON copied to clipboard');
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                          title="Copy JSON"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDocModal(doc)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                          title="Edit Document"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Formatted JSON Body */}
                    <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded-lg overflow-x-auto border border-slate-800/60 leading-relaxed max-h-56 scrollbar-thin">
                      {JSON.stringify(doc, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-3">_id</th>
                      <th className="p-3">Primary Identifier</th>
                      <th className="p-3">Key Attributes</th>
                      <th className="p-3">Updated At</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {documents.map((doc, idx) => {
                      const primaryLabel = doc.name || doc.title || doc.quote_number || doc.order_number || doc.subject || doc.full_name || 'Document';
                      return (
                        <tr key={doc._id || idx} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono text-emerald-400 text-[11px] whitespace-nowrap">
                            {doc._id?.slice(0, 10)}...
                          </td>
                          <td className="p-3 font-medium text-white whitespace-nowrap">
                            {primaryLabel}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px] truncate max-w-xs">
                            {doc.email || doc.company || doc.status || doc.deal_value || doc.priority || '-'}
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenDocModal(doc)}
                              className="p-1 hover:text-emerald-400 text-slate-400 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc._id)}
                              className="p-1 hover:text-rose-400 text-slate-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INTERACTIVE MONGODB QUERY SHELL */}
      {/* ========================================================================= */}
      {activeTab === 'shell' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Interactive MongoDB Command Shell
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Session: {stats?.db || 'crm_enterprise'}
              </span>
            </div>

            {/* Quick Command Templates */}
            <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-mono pb-1 scrollbar-thin">
              <span className="text-slate-500 whitespace-nowrap">Quick Queries:</span>
              {[
                'db.customers.find({ status: "Active" }).limit(5)',
                'db.deals.aggregate([{ $group: { _id: "$stage", total: { $sum: "$deal_value" } } }])',
                'db.leads.find({ score: { $gte: 75 } })',
                'db.orders.find({ order_status: "Completed" })',
                'db.stats()',
                'show collections',
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => {
                    setShellCommand(cmd);
                    handleExecuteShell(cmd);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition"
                >
                  {cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd}
                </button>
              ))}
            </div>

            {/* Command Input Area */}
            <div className="relative">
              <textarea
                value={shellCommand}
                onChange={(e) => setShellCommand(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleExecuteShell();
                  }
                }}
                rows={3}
                placeholder="Enter MongoDB command: e.g. db.customers.find({ status: 'Active' })"
                className="w-full p-3 bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
              <button
                onClick={() => handleExecuteShell()}
                disabled={shellLoading}
                className="absolute right-3 bottom-4 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${shellLoading ? 'animate-spin' : ''}`} />
                {shellLoading ? 'Running...' : 'Execute (Ctrl+Enter)'}
              </button>
            </div>
          </div>

          {/* Shell Output Console */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="font-mono text-slate-400 ml-2">Console Output</span>
              </div>
              {shellTiming !== null && (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className={shellSuccess ? 'text-emerald-400' : 'text-rose-400'}>
                    Execution Time: {shellTiming} ms
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 max-h-[500px] overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed scrollbar-thin">
              {shellResult !== null ? (
                <pre className="text-emerald-400">
                  {typeof shellResult === 'string' ? shellResult : JSON.stringify(shellResult, null, 2)}
                </pre>
              ) : (
                <div className="text-slate-500 italic">
                  Run a MongoDB query above or select one of the quick templates to evaluate document execution and aggregation pipeline outputs.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ARCHITECTURE & SCHEMAS */}
      {/* ========================================================================= */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Unified Data Storage Architecture
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              This application delivers a production-grade dual database model: high-reliability ACID transactions on the relational SQLite engine, and flexible schema-less document indexing on MongoDB Document Storage.
            </p>

            {/* Architecture diagram visual */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                  Client Presentation Layer
                </span>
                <h3 className="text-sm font-semibold text-slate-200">HTML5 + CSS + React 19</h3>
                <p className="text-xs text-slate-400">
                  Semantic DOM, responsive Tailwind CSS styling, real-time reactive state hooks, and client-side token auth.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Backend API &amp; Server Layer
                </span>
                <h3 className="text-sm font-semibold text-slate-200">Node.js + Express API</h3>
                <p className="text-xs text-slate-400">
                  REST endpoints (`/api/...` and `/api/mongodb/...`), JWT verification, audit logging, and Gemini AI inference.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-teal-400 block tracking-wider">
                  Dual Persistence Storage
                </span>
                <h3 className="text-sm font-semibold text-slate-200">MongoDB + SQLite DB</h3>
                <p className="text-xs text-slate-400">
                  JSON/BSON document collections stored in `data/mongodb/*.json` and relational tables in `data/crm.sqlite`.
                </p>
              </div>
            </div>
          </div>

          {/* Collection Schemas */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Document Schemas &amp; Field Inferences
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  collection: 'customers',
                  description: 'Rich 360° customer records with contact, health scores, and lifecycle tags.',
                  fields: [
                    { name: '_id', type: 'ObjectId', desc: 'Unique 24-character document identifier' },
                    { name: 'name', type: 'String', desc: 'Customer or account contact name' },
                    { name: 'company', type: 'String', desc: 'Company / organization name' },
                    { name: 'email', type: 'String', desc: 'Primary email address' },
                    { name: 'deal_value', type: 'Number', desc: 'Total aggregate deal value in USD' },
                    { name: 'health_score', type: 'Number', desc: 'Account health rating (0-100)' },
                    { name: 'tags', type: 'Array<String>', desc: 'Categorization and segment tags' },
                  ],
                },
                {
                  collection: 'leads',
                  description: 'Inbound sales opportunities with automated AI attention scores.',
                  fields: [
                    { name: '_id', type: 'ObjectId', desc: 'Unique 24-character document identifier' },
                    { name: 'name', type: 'String', desc: 'Lead prospect name' },
                    { name: 'score', type: 'Number', desc: 'Predictive lead scoring (0-100)' },
                    { name: 'source', type: 'String', desc: 'Acquisition channel (Web, Referral, etc.)' },
                    { name: 'potential_value', type: 'Number', desc: 'Estimated pipeline value' },
                    { name: 'priority', type: 'String', desc: 'High | Medium | Low' },
                  ],
                },
                {
                  collection: 'deals',
                  description: 'Pipeline stages, probability weightings, and close date milestones.',
                  fields: [
                    { name: '_id', type: 'ObjectId', desc: 'Unique 24-character document identifier' },
                    { name: 'title', type: 'String', desc: 'Deal title or project scope' },
                    { name: 'stage', type: 'String', desc: 'Prospecting, Proposal, Negotiation, Won, Lost' },
                    { name: 'deal_value', type: 'Number', desc: 'Target contract value' },
                    { name: 'probability', type: 'Number', desc: 'Win probability percentage' },
                  ],
                },
                {
                  collection: 'orders',
                  description: 'Fulfilled enterprise purchase orders and invoice line items.',
                  fields: [
                    { name: '_id', type: 'ObjectId', desc: 'Unique 24-character document identifier' },
                    { name: 'order_number', type: 'String', desc: 'Generated PO number' },
                    { name: 'total_amount', type: 'Number', desc: 'Net billing amount' },
                    { name: 'order_status', type: 'String', desc: 'Processing, Shipped, Delivered' },
                    { name: 'payment_status', type: 'String', desc: 'Paid, Pending, Failed' },
                  ],
                },
              ].map((schema) => (
                <div key={schema.collection} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm font-mono flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      db.{schema.collection}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      BSON Document
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{schema.description}</p>
                  <div className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {schema.fields.map((f) => (
                      <div key={f.name} className="py-1.5 flex items-center justify-between">
                        <span className="text-slate-200">{f.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-[10px]">{f.desc}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-indigo-400 text-[10px]">
                            {f.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RELATIONAL SYNC & BACKUP */}
      {/* ========================================================================= */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Relational SQLite ↔ MongoDB Synchronization</h3>
                <p className="text-xs text-slate-400">
                  Synchronize your active relational CRM data (Customers, Leads, Deals, Quotations, Orders, Tickets, Users) into MongoDB document format.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  One-Click Full Re-Sync
                </span>
                <span className="text-[11px] text-slate-400">
                  Reads all rows from SQLite, embeds nested structures and tags, and persists to `data/mongodb/*.json`
                </span>
              </div>
              <button
                onClick={handleSyncDatabase}
                disabled={syncing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Synchronizing...' : 'Run Full Sync'}
              </button>
            </div>

            {syncResult && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  {syncResult.message}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {Object.entries(syncResult.syncedCollections || {}).map(([col, cnt]) => (
                    <div key={col} className="p-2 bg-slate-950/80 rounded border border-emerald-500/20 text-xs">
                      <span className="text-slate-400 block text-[10px]">{col}</span>
                      <span className="font-bold text-emerald-300 font-mono">{cnt as number} docs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Database Backup & Export */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Direct JSON / BSON Export &amp; Backup</h3>
                <p className="text-xs text-slate-400">
                  Export complete collections as standalone JSON files for offline analysis or migration to external MongoDB clusters.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {collections.map((col) => (
                <a
                  key={col.name}
                  href={`/api/mongodb/export/${col.name}`}
                  download={`${col.name}.json`}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl flex items-center justify-between transition group"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block group-hover:text-emerald-400 transition">
                      {col.name}.json
                    </span>
                    <span className="text-[10px] text-slate-500">{col.count} documents</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: CONNECTION & CLUSTER SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">MongoDB Connection &amp; Atlas Configuration</h3>
                <p className="text-xs text-slate-400">
                  Configure local MongoDB daemon connection URI or MongoDB Atlas Cloud cluster connection string.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  MongoDB Connection URI
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={connectionUriInput}
                    onChange={(e) => setConnectionUriInput(e.target.value)}
                    placeholder="mongodb://localhost:27017/crm_enterprise or mongodb+srv://..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                  >
                    {savingConfig ? 'Saving...' : 'Update URI'}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Default: <code>mongodb://localhost:27017/crm_enterprise</code>. Supports MongoDB Atlas SRV URI strings.
                </span>
              </div>

              {/* Status Checklist */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                <span className="font-semibold text-slate-300 block mb-2">Engine Capabilities</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>WiredTiger Emulation Active</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Auto-Persistence to disk (`data/mongodb/`)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>MongoDB Aggregation Pipeline ($match, $group, $sort)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>24-character Hex ObjectId Generation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INSERT / EDIT DOCUMENT MODAL */}
      {/* ========================================================================= */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-emerald-400" />
                  {editingDocId ? `Edit Document in "${selectedCollection}"` : `Insert Document into "${selectedCollection}"`}
                </h3>
                {editingDocId && (
                  <span className="text-[10px] text-slate-400 font-mono">_id: {editingDocId}</span>
                )}
              </div>
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            {docModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-mono">
                {docModalError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                JSON Document Content
              </label>
              <textarea
                value={docJsonInput}
                onChange={(e) => setDocJsonInput(e.target.value)}
                rows={12}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                _id will be automatically created as a 24-character ObjectId if omitted.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDocModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDocument}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
              >
                {editingDocId ? 'Update Document' : 'Insert Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE COLLECTION MODAL */}
      {/* ========================================================================= */}
      {isColModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Create New MongoDB Collection
              </h3>
              <button
                onClick={() => setIsColModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Collection Name
                </label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. analytics_events, invoices, campaigns"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Stored as <code>data/mongodb/&lt;name&gt;.json</code>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsColModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: IMPORT JSON DOCUMENTS */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                Import JSON into "{selectedCollection}"
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Paste JSON Array of Documents
              </label>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='[ { "name": "Item 1", "value": 100 }, { "name": "Item 2", "value": 200 } ]'
                rows={8}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Import Documents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
