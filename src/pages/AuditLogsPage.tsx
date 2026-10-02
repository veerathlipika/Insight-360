import React, { useState, useEffect } from 'react';
import { History, Shield, Search, Filter, Clock } from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { AuditLog } from '../types/index.ts';

export const AuditLogsPage: React.FC = () => {
  const { error } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs();
      setLogs(res.logs);
    } catch (err: any) {
      error('Failed to load audit logs', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    const matchSearch =
      search === '' ||
      (log.details && log.details.toLowerCase().includes(search.toLowerCase())) ||
      (log.user_name && log.user_name.toLowerCase().includes(search.toLowerCase())) ||
      log.entity.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            System Audit Log &amp; Security Compliance
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
            Immutable History
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Complete, tamper-resistant trail of record creations, deletions, pipeline movements, and stage transitions.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit details, users, entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 text-xs text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
          >
            <option value="all" className="bg-slate-900">All Operations</option>
            <option value="CREATED" className="bg-slate-900">CREATED</option>
            <option value="UPDATED" className="bg-slate-900">UPDATED</option>
            <option value="STAGE_CHANGED" className="bg-slate-900">STAGE_CHANGED</option>
            <option value="CONVERTED" className="bg-slate-900">CONVERTED</option>
            <option value="STATUS_CHANGED" className="bg-slate-900">STATUS_CHANGED</option>
            <option value="DELETED" className="bg-slate-900">DELETED</option>
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading audit trail...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">No matching audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Operation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {log.user_name || 'System'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          log.action === 'CREATED'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : log.action === 'CONVERTED'
                            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                            : log.action === 'STAGE_CHANGED'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-800'
                            : log.action === 'DELETED'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-300">{log.entity}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">#{log.entity_id}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-md">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
