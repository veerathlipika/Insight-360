import React, { useState, useEffect } from 'react';
import {
  Target,
  Search,
  Filter,
  Plus,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Phone,
  Mail,
  Clock,
  Calendar,
  UserCheck,
  XCircle,
  MoreVertical,
  X,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Lead, User } from '../types/index.ts';

interface LeadsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ onNavigate }) => {
  const { success, error, info } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [activeScoreTooltip, setActiveScoreTooltip] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'Website',
    requirement: '',
    estimated_value: '',
    priority: 'Medium',
    assigned_user_id: '',
    next_followup_at: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [leadsRes, usersRes] = await Promise.all([
        api.getLeads({ search, status: statusFilter, priority: priorityFilter, source: sourceFilter }),
        api.getUsers(),
      ]);
      setLeads(leadsRes.leads);
      setUsers(usersRes.users);
    } catch (err: any) {
      error('Failed to load leads', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, priorityFilter, sourceFilter]);

  const handleOpenAdd = () => {
    setEditingLead(null);
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      source: 'Website',
      requirement: '',
      estimated_value: '25000',
      priority: 'Medium',
      assigned_user_id: users[0]?.id ? String(users[0].id) : '',
      next_followup_at: new Date().toISOString().split('T')[0],
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (l: Lead) => {
    setEditingLead(l);
    setFormData({
      name: l.name,
      company: l.company,
      email: l.email,
      phone: l.phone || '',
      source: l.source,
      requirement: l.requirement,
      estimated_value: String(l.estimated_value || 0),
      priority: l.priority,
      assigned_user_id: l.assigned_user_id ? String(l.assigned_user_id) : '',
      next_followup_at: l.next_followup_at || '',
    });
    setShowAddModal(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company.trim() || !formData.email.trim() || !formData.requirement.trim()) {
      error('Name, Company, Email, and Requirement are required.');
      return;
    }

    try {
      const payload = {
        ...formData,
        estimated_value: parseFloat(formData.estimated_value) || 0,
        assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id, 10) : null,
      };

      if (editingLead) {
        await api.updateLead(editingLead.id, payload);
        success('Lead updated successfully');
      } else {
        await api.createLead(payload);
        success('New lead created and Attention Score calculated!');
      }

      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      error('Failed to save lead', err.message);
    }
  };

  // WORKFLOW 1: Qualify Lead
  const handleQualifyLead = async (id: number) => {
    try {
      await api.qualifyLead(id);
      success('Lead marked as Qualified!');
      loadData();
    } catch (err: any) {
      error('Failed to qualify lead', err.message);
    }
  };

  // WORKFLOW 1 & 2: Convert Lead -> Creates Customer and Opportunity
  const handleConvertLead = async (lead: Lead) => {
    try {
      const res = await api.convertLead(lead.id);
      success('Lead Converted! Created Customer Account & Pipeline Opportunity');
      loadData();
      if (res.customerId) {
        onNavigate('customer-360', { customerId: res.customerId });
      }
    } catch (err: any) {
      error('Failed to convert lead', err.message);
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.deleteLead(id);
      success('Lead deleted');
      loadData();
    } catch (err: any) {
      error('Failed to delete lead', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Lead Management &amp; Qualification
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
              {leads.length} leads
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Qualify incoming prospects, track AI attention scores, schedule touchpoints, and convert deals to the pipeline.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Lead</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by prospect name, company, requirement, or lead code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/90 text-xs text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900">All</option>
              <option value="New" className="bg-slate-900">New</option>
              <option value="Contacted" className="bg-slate-900">Contacted</option>
              <option value="Qualified" className="bg-slate-900">Qualified</option>
              <option value="Converted" className="bg-slate-900">Converted</option>
              <option value="Unqualified" className="bg-slate-900">Unqualified</option>
              <option value="Lost" className="bg-slate-900">Lost</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900">All</option>
              <option value="Urgent" className="bg-slate-900">Urgent</option>
              <option value="High" className="bg-slate-900">High</option>
              <option value="Medium" className="bg-slate-900">Medium</option>
              <option value="Low" className="bg-slate-900">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900">All Sources</option>
              <option value="Website" className="bg-slate-900">Website</option>
              <option value="Referral" className="bg-slate-900">Referral</option>
              <option value="Direct" className="bg-slate-900">Direct</option>
              <option value="Social Media" className="bg-slate-900">Social Media</option>
              <option value="Advertisement" className="bg-slate-900">Advertisement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading leads database...</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No leads found</p>
            <p className="text-xs text-slate-500 mt-1">Try changing filters or add a new lead.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Attention Score</th>
                  <th className="py-3 px-4">Lead &amp; Company</th>
                  <th className="py-3 px-4">Value &amp; Requirement</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned Rep</th>
                  <th className="py-3 px-4">Next Touchpoint</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.map((l) => {
                  const score = l.attention_score || 50;
                  const isHighAttention = score >= 85;
                  const isMedAttention = score >= 65 && score < 85;

                  return (
                    <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* AI Attention Score */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center font-bold text-xs border ${
                              isHighAttention
                                ? 'bg-rose-950/50 border-rose-600 text-rose-300'
                                : isMedAttention
                                ? 'bg-amber-950/50 border-amber-600 text-amber-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            <span>{score}</span>
                            <span className="text-[8px] opacity-70">/100</span>
                          </div>
                          {isHighAttention && (
                            <span title="High Attention Required" className="text-rose-400">
                              <Flame className="w-4 h-4 fill-rose-500/20" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Lead / Company */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{l.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="text-slate-300 font-medium">{l.company}</span>
                          <span className="text-slate-600">·</span>
                          <span className="font-mono text-[10px] text-slate-500">{l.lead_code}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Source: <strong className="text-slate-400">{l.source}</strong>
                        </div>
                      </td>

                      {/* Value & Requirement */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-emerald-400 text-xs">
                          ${l.estimated_value?.toLocaleString() || 0}
                        </div>
                        <p className="text-[11px] text-slate-300 truncate mt-0.5" title={l.requirement}>
                          {l.requirement}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            l.status === 'Qualified'
                              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                              : l.status === 'Converted'
                              ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800'
                              : l.status === 'Contacted'
                              ? 'bg-sky-950/50 text-sky-300 border-sky-800'
                              : l.status === 'New'
                              ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-semibold ${
                            l.priority === 'Urgent'
                              ? 'text-rose-400'
                              : l.priority === 'High'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {l.priority}
                        </span>
                      </td>

                      {/* Assigned Rep */}
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {l.assigned_name || <span className="text-slate-500 italic">Unassigned</span>}
                      </td>

                      {/* Next Touchpoint */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {l.next_followup_at ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Clock className="w-3 h-3 text-indigo-400" />
                            <span>{l.next_followup_at}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">None scheduled</span>
                        )}
                      </td>

                      {/* Workflow Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Qualify button */}
                          {l.status === 'New' || l.status === 'Contacted' ? (
                            <button
                              onClick={() => handleQualifyLead(l.id)}
                              className="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-700 font-medium text-[11px] transition-colors"
                              title="Qualify Lead"
                            >
                              Qualify
                            </button>
                          ) : null}

                          {/* Convert button (Workflow 1 & 2) */}
                          {l.status === 'Qualified' ? (
                            <button
                              onClick={() => handleConvertLead(l)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm flex items-center gap-1 transition-all"
                              title="Convert to Opportunity & Customer Account"
                            >
                              <span>Convert</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : null}

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(l)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Edit Lead"
                          >
                            ✎
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">
                {editingLead ? 'Edit Lead' : 'Create New Lead'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Estimated Value ($)</label>
                  <input
                    type="number"
                    value={formData.estimated_value}
                    onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Direct">Direct</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Advertisement">Advertisement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assign Sales Executive</label>
                <select
                  value={formData.assigned_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Client Requirement / Needs *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  placeholder="e.g. Migrating 50 sales reps from Salesforce, requires custom ERP connector..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30"
                >
                  {editingLead ? 'Save Changes' : 'Create & Calculate AI Score'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
