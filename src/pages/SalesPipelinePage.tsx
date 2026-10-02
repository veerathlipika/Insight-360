import React, { useState, useEffect } from 'react';
import {
  Kanban,
  DollarSign,
  Plus,
  ArrowRight,
  ArrowLeft,
  Clock,
  User as UserIcon,
  ChevronRight,
  TrendingUp,
  X,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Opportunity, Customer, User, PipelineStage } from '../types/index.ts';

interface SalesPipelinePageProps {
  onNavigate: (page: string, params?: any) => void;
}

const STAGES: PipelineStage[] = ['New', 'Contacted', 'Proposal', 'Negotiation', 'Converted'];

export const SalesPipelinePage: React.FC<SalesPipelinePageProps> = ({ onNavigate }) => {
  const { success, error, info } = useToast();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    customer_id: '',
    value: '20000',
    stage: 'New' as PipelineStage,
    priority: 'Medium',
    assigned_user_id: '',
    expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  const loadPipeline = async () => {
    try {
      setLoading(true);
      const [oppRes, custRes, userRes] = await Promise.all([
        api.getOpportunities(),
        api.getCustomers(),
        api.getUsers(),
      ]);
      setOpportunities(oppRes.opportunities);
      setCustomers(custRes.customers);
      setUsers(userRes.users);
    } catch (err: any) {
      error('Failed to load sales pipeline', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();
  }, []);

  const handleStageChange = async (oppId: number, newStage: PipelineStage) => {
    try {
      const res = await api.updateOpportunityStage(oppId, newStage);
      success(res.message);

      if (newStage === 'Converted') {
        info('Deal Won! You can now create an official order from this opportunity.');
      }

      loadPipeline();
    } catch (err: any) {
      error('Failed to change stage', err.message);
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.customer_id) {
      error('Title and Customer are required.');
      return;
    }

    try {
      await api.createOpportunity({
        ...formData,
        customer_id: parseInt(formData.customer_id, 10),
        value: parseFloat(formData.value) || 0,
        assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id, 10) : null,
      });

      success('Opportunity added to pipeline');
      setShowAddModal(false);
      loadPipeline();
    } catch (err: any) {
      error('Failed to create opportunity', err.message);
    }
  };

  // Group opportunities by stage
  const stageColumns = STAGES.map((stage) => {
    const oppsInStage = opportunities.filter((o) => o.stage === stage);
    const totalVal = oppsInStage.reduce((sum, o) => sum + (o.value || 0), 0);
    return {
      stage,
      opportunities: oppsInStage,
      count: oppsInStage.length,
      totalVal,
    };
  });

  const totalPipeline = opportunities.reduce((sum, o) => sum + (o.value || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Sales Pipeline
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
              {opportunities.length} opportunities
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Total Pipeline Value: <strong className="text-emerald-400">${totalPipeline.toLocaleString()}</strong> across 5 stages.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              title: '',
              customer_id: customers[0]?.id ? String(customers[0].id) : '',
              value: '25000',
              stage: 'New',
              priority: 'Medium',
              assigned_user_id: users[0]?.id ? String(users[0].id) : '',
              expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
              notes: '',
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Opportunity</span>
        </button>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start min-h-[600px]">
        {stageColumns.map((col, index) => {
          let stageColor = 'border-blue-500/50 bg-blue-950/10 text-blue-300';
          if (col.stage === 'Contacted') stageColor = 'border-sky-500/50 bg-sky-950/10 text-sky-300';
          if (col.stage === 'Proposal') stageColor = 'border-amber-500/50 bg-amber-950/10 text-amber-300';
          if (col.stage === 'Negotiation') stageColor = 'border-indigo-500/50 bg-indigo-950/10 text-indigo-300';
          if (col.stage === 'Converted') stageColor = 'border-emerald-500/50 bg-emerald-950/10 text-emerald-300';

          return (
            <div
              key={col.stage}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col h-full shadow-lg overflow-hidden"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/50">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${stageColor}`}>
                    {col.stage}
                  </span>
                  <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded-full">
                    {col.count}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Stage Value:</span>
                  <span className="font-bold text-slate-200">${col.totalVal.toLocaleString()}</span>
                </div>
              </div>

              {/* Opportunity Cards List */}
              <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto max-h-[700px]">
                {col.opportunities.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs italic">
                    No deals in {col.stage}
                  </div>
                ) : (
                  col.opportunities.map((opp) => {
                    const daysInStage = opp.stage_changed_at
                      ? Math.max(0, Math.floor((Date.now() - new Date(opp.stage_changed_at).getTime()) / 86400000))
                      : 0;

                    const prevStageIndex = index - 1;
                    const nextStageIndex = index + 1;

                    return (
                      <div
                        key={opp.id}
                        className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 p-3 rounded-xl shadow-sm text-xs space-y-2 transition-all group"
                      >
                        {/* Company & Code */}
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div
                              onClick={() => onNavigate('customer-360', { customerId: opp.customer_id })}
                              className="font-bold text-slate-200 hover:text-indigo-400 cursor-pointer transition-colors"
                            >
                              {opp.customer_company || 'Customer Account'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {opp.opp_code}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              opp.priority === 'High'
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {opp.priority}
                          </span>
                        </div>

                        {/* Title */}
                        <p className="text-slate-300 font-medium leading-snug">{opp.title}</p>

                        {/* Value & Days */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                          <span className="font-bold text-emerald-400 text-sm">
                            ${opp.value?.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {daysInStage} {daysInStage === 1 ? 'day' : 'days'} in stage
                          </span>
                        </div>

                        {/* Assigned Rep & Next Followup */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="truncate max-w-[100px]">
                            Rep: {opp.assigned_name?.split(' ')[0] || 'Unassigned'}
                          </span>
                          {opp.next_followup_date && (
                            <span className="text-indigo-300 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {opp.next_followup_date}
                            </span>
                          )}
                        </div>

                        {/* Stage Transition Buttons */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                          {prevStageIndex >= 0 ? (
                            <button
                              onClick={() => handleStageChange(opp.id, STAGES[prevStageIndex])}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-0.5 text-[10px]"
                              title={`Move back to ${STAGES[prevStageIndex]}`}
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Back</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          {nextStageIndex < STAGES.length ? (
                            <button
                              onClick={() => handleStageChange(opp.id, STAGES[nextStageIndex])}
                              className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-700 font-medium flex items-center gap-1 text-[10px] transition-colors"
                              title={`Advance to ${STAGES[nextStageIndex]}`}
                            >
                              <span>Advance</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Won
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Opportunity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Pipeline Opportunity</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOpportunity} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Account *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Opportunity Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. 50 Enterprise User Expansion"
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Deal Value ($) *</label>
                  <input
                    type="number"
                    required
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Initial Stage</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as PipelineStage })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Expected Close Date</label>
                  <input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assigned Executive</label>
                <select
                  value={formData.assigned_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Select sales rep</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Deal Context</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Key decision makers, requirements, discount terms..."
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
                  Save Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
