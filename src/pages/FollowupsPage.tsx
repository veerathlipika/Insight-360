import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Phone,
  Mail,
  Video,
  MessageCircle,
  FileText,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Followup, Customer, User } from '../types/index.ts';

interface FollowupsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const FollowupsPage: React.FC<FollowupsPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();

  const [followupsData, setFollowupsData] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | 'overdue-emails'
  const [activeTab, setActiveTab] = useState<'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | 'overdue-emails'>('today');
  const [overdueReminders, setOverdueReminders] = useState<any[]>([]);
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null);
  const [previewingReminder, setPreviewingReminder] = useState<any | null>(null);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [completingFollowup, setCompletingFollowup] = useState<Followup | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');

  // Form
  const [formData, setFormData] = useState({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    type: 'Call',
    priority: 'Medium',
    notes: '',
    assigned_user_id: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [fupRes, custRes, userRes, overdueRes] = await Promise.all([
        api.getFollowups(),
        api.getCustomers(),
        api.getUsers(),
        api.getOverdueReminders().catch(() => ({ reminders: [] })),
      ]);
      setFollowupsData(fupRes);
      setCustomers(custRes.customers);
      setUsers(userRes.users);
      setOverdueReminders(overdueRes.reminders || []);
    } catch (err: any) {
      error('Failed to load follow-ups', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScheduleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.notes.trim() || !formData.date || !formData.time) {
      error('Date, Time, and Notes are required.');
      return;
    }

    try {
      await api.createFollowup({
        ...formData,
        customer_id: formData.customer_id ? parseInt(formData.customer_id, 10) : null,
        assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id, 10) : null,
      });

      success('Follow-up scheduled');
      setShowScheduleModal(false);
      loadData();
    } catch (err: any) {
      error('Failed to schedule follow-up', err.message);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingFollowup) return;

    try {
      await api.completeFollowup(completingFollowup.id, outcomeNotes);
      success('Follow-up marked completed & logged to timeline');
      setCompletingFollowup(null);
      setOutcomeNotes('');
      loadData();
    } catch (err: any) {
      error('Failed to complete follow-up', err.message);
    }
  };

  const handleSendOverdueEmail = async (reminder: any) => {
    try {
      setSendingReminderId(reminder.invoice_id);
      const result = await api.sendOverdueReminderEmail({
        customer_id: reminder.customer_id,
        invoice_id: reminder.invoice_id,
      });
      success(result.message);
      if (previewingReminder?.invoice_id === reminder.invoice_id) {
        setPreviewingReminder(null);
      }
      loadData();
    } catch (err: any) {
      error('Failed to send overdue email reminder', err.message);
    } finally {
      setSendingReminderId(null);
    }
  };

  const getFilteredList = () => {
    if (!followupsData) return [];
    if (activeTab === 'today') return followupsData.today || [];
    if (activeTab === 'overdue') return followupsData.overdue || [];
    if (activeTab === 'upcoming') return followupsData.upcoming || [];
    if (activeTab === 'completed') return followupsData.completed || [];
    return followupsData.all || [];
  };

  const list = getFilteredList();
  const stats = followupsData?.stats;

  const getTypeIcon = (type: string) => {
    if (type === 'Call') return <Phone className="w-3.5 h-3.5" />;
    if (type === 'Email') return <Mail className="w-3.5 h-3.5" />;
    if (type === 'Meeting') return <Video className="w-3.5 h-3.5" />;
    if (type === 'Note') return <FileText className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Follow-up Automation &amp; Schedule
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Proactively manage sales outreach, prevent missed touches, and automatically sync completed calls to customer timelines.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              customer_id: customers[0]?.id ? String(customers[0].id) : '',
              date: new Date().toISOString().split('T')[0],
              time: '11:00',
              type: 'Call',
              priority: 'Medium',
              notes: '',
              assigned_user_id: users[0]?.id ? String(users[0].id) : '',
            });
            setShowScheduleModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule Follow-up</span>
        </button>
      </div>

      {/* Categorized Tab Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <button
          onClick={() => setActiveTab('today')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'today'
              ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-600/10'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Today's Tasks</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1.5">{stats?.todayCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Due before midnight</div>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'overdue'
              ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-md shadow-rose-600/10'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Overdue Tasks</span>
            <AlertTriangle className={`w-4 h-4 ${(stats?.overdueCount || 0) > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="text-xl font-bold text-rose-400 mt-1.5">{stats?.overdueCount || 0}</div>
          <div className="text-[10px] text-rose-300 mt-0.5">Requires action</div>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'upcoming'
              ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-600/10'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Upcoming</span>
            <CalendarCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1.5">{stats?.upcomingCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Future calls</div>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'completed'
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-600/10'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1.5">{stats?.completedCount || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Logged &amp; archived</div>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'all'
              ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">All Follow-ups</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1.5">{stats?.total || 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Master log</div>
        </button>

        <button
          onClick={() => setActiveTab('overdue-emails')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeTab === 'overdue-emails'
              ? 'bg-amber-950/70 border-amber-500 text-amber-200 shadow-md shadow-amber-600/10'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Overdue Emails</span>
            <Mail className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 mt-1.5">{overdueReminders.length}</div>
          <div className="text-[10px] text-amber-300 mt-0.5">Auto 1-click reminders</div>
        </button>
      </div>

      {/* Follow-ups & Overdue Reminders List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading data...</div>
        ) : activeTab === 'overdue-emails' ? (
          overdueReminders.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">All accounts up to date!</p>
              <p className="text-xs text-slate-500 mt-1">There are currently no accounts with overdue payments.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {overdueReminders.map((rem: any) => (
                <div key={`${rem.customer_id}-${rem.invoice_id}`} className="p-5 hover:bg-slate-800/40 transition-colors space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-white">{rem.customer_company}</span>
                        <span className="text-xs text-slate-400">({rem.customer_name})</span>
                        {rem.is_one_month_overdue && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                            Overdue 30+ Days (1 Month+)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Email: <strong className="text-indigo-300">{rem.customer_email}</strong> · Phone: {rem.customer_phone || 'N/A'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold text-rose-400">₹{rem.outstanding_amount?.toLocaleString('en-IN')} Due</div>
                        <div className="text-[11px] text-slate-400">Invoice {rem.invoice_number} ({rem.days_overdue} days overdue)</div>
                      </div>

                      <button
                        disabled={sendingReminderId === rem.invoice_id}
                        onClick={() => handleSendOverdueEmail(rem)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{sendingReminderId === rem.invoice_id ? 'Sending Email...' : 'Send Automated Email'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Email Preview Accordion */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2 text-[11px]">
                      <span><strong className="text-slate-300">Generated Subject:</strong> {rem.generated_subject}</span>
                      <span><strong className="text-slate-300">Login Link Included:</strong> <a href={rem.login_link} target="_blank" rel="noreferrer" className="text-indigo-400 underline">{rem.login_link}</a></span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pre-generated Automated Email Content:</span>
                      <pre className="text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                        {rem.generated_body}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No follow-ups in this view</p>
            <p className="text-xs text-slate-500 mt-1">
              All tasks in this category have been completed or none are scheduled.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {list.map((f: Followup) => {
              const isOverdue = f.status === 'Overdue';

              return (
                <div
                  key={f.id}
                  className={`p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs ${
                    isOverdue ? 'bg-rose-950/10' : ''
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-indigo-300 font-semibold text-[11px]">
                        {getTypeIcon(f.type)}
                        <span>{f.type}</span>
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          f.status === 'Overdue'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : f.status === 'Completed'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-indigo-950 text-indigo-300 border-indigo-800'
                        }`}
                      >
                        {f.status}
                      </span>

                      <span
                        className={`text-[10px] font-bold ${
                          f.priority === 'Urgent' ? 'text-rose-400' : f.priority === 'High' ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        {f.priority} Priority
                      </span>

                      <span className="text-slate-500 text-[11px]">·</span>
                      <span className="text-slate-300 font-medium">
                        {f.date} at {f.time}
                      </span>
                    </div>

                    <div className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                      {f.customer_company ? (
                        <button
                          onClick={() => onNavigate('customer-360', { customerId: f.customer_id })}
                          className="hover:text-indigo-400 transition-colors text-left"
                        >
                          {f.customer_company}
                        </button>
                      ) : (
                        <span>General Prospect Touchpoint</span>
                      )}
                      {f.customer_name && (
                        <span className="text-xs font-normal text-slate-400">({f.customer_name})</span>
                      )}
                    </div>

                    <p className="text-slate-300 leading-relaxed max-w-2xl bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                      {f.notes}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                      <span>Assigned to: <strong className="text-slate-400">{f.assigned_name || 'Unassigned'}</strong></span>
                      {f.customer_phone && <span>Phone: {f.customer_phone}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {f.status !== 'Completed' && (
                      <button
                        onClick={() => {
                          setCompletingFollowup(f);
                          setOutcomeNotes('');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete Task</span>
                      </button>
                    )}

                    {f.customer_id && (
                      <button
                        onClick={() => onNavigate('customer-360', { customerId: f.customer_id })}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium"
                      >
                        View 360° Profile
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Follow-up Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Schedule New Follow-up</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleFollowup} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Account</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Select Customer (Optional)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Note">Note</option>
                    <option value="Other">Other</option>
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
                <label className="block text-slate-300 font-medium mb-1">Assigned Executive</label>
                <select
                  value={formData.assigned_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Select Sales Rep</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Call Objective *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Discuss revised quote terms, resolve pricing question..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30"
                >
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Follow-up Outcome Modal (Workflow 4) */}
      {completingFollowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Record Follow-up Outcome</h3>
              <button onClick={() => setCompletingFollowup(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleComplete} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-200">
                  {completingFollowup.type} with {completingFollowup.customer_company || 'Lead'}
                </div>
                <p className="text-slate-400 text-[11px]">{completingFollowup.notes}</p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Call Notes / Outcome Details (Synced to Customer 360 Timeline)
                </label>
                <textarea
                  rows={3}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="Outcome of the call, customer feedback, next steps agreed upon..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletingFollowup(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20"
                >
                  Save &amp; Complete Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
