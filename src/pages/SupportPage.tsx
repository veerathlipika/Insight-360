import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Edit2,
  User,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { SupportTicket, Customer, User as UserType, TicketStatus } from '../types/index.ts';

interface SupportPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const SupportPage: React.FC<SupportPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<SupportTicket | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    customer_id: '',
    subject: '',
    description: '',
    priority: 'Medium',
    assigned_user_id: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [tRes, cRes, uRes] = await Promise.all([
        api.getSupportTickets(),
        api.getCustomers(),
        api.getUsers(),
      ]);
      setTickets(tRes.tickets);
      setCustomers(cRes.customers);
      setUsers(uRes.users);
    } catch (err: any) {
      error('Failed to load support tickets', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.subject.trim() || !formData.description.trim()) {
      error('Customer, Subject, and Description are required.');
      return;
    }

    try {
      await api.createSupportTicket({
        ...formData,
        customer_id: parseInt(formData.customer_id, 10),
        assigned_user_id: formData.assigned_user_id ? parseInt(formData.assigned_user_id, 10) : null,
      });

      success('Support ticket created');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      error('Failed to create ticket', err.message);
    }
  };

  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket) return;

    try {
      await api.updateSupportTicket(resolvingTicket.id, {
        status: 'Resolved',
        resolution: resolutionText,
      });

      success('Ticket resolved and resolution logged');
      setResolvingTicket(null);
      setResolutionText('');
      loadData();
    } catch (err: any) {
      error('Failed to resolve ticket', err.message);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchStatus && matchPriority;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Customer Support &amp; Incident Desk
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track SLA response times, technical inquiries, and resolution logs seamlessly linked to the Customer 360 view.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              customer_id: customers[0]?.id ? String(customers[0].id) : '',
              subject: '',
              description: '',
              priority: 'Medium',
              assigned_user_id: users[0]?.id ? String(users[0].id) : '',
            });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Open Ticket</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-slate-900">All</option>
              <option value="Open" className="bg-slate-900">Open</option>
              <option value="In Progress" className="bg-slate-900">In Progress</option>
              <option value="Resolved" className="bg-slate-900">Resolved</option>
              <option value="Closed" className="bg-slate-900">Closed</option>
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
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </span>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No support tickets found</p>
            <p className="text-xs text-slate-500 mt-1">All accounts are operating smoothly without open issues.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4">Subject &amp; Description</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned Engineer</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-400">{t.ticket_number}</span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <button
                        onClick={() => onNavigate('customer-360', { customerId: t.customer_id })}
                        className="hover:text-indigo-400 text-left transition-colors"
                      >
                        {t.customer_company}
                      </button>
                      <div className="text-[11px] text-slate-400 font-normal">{t.customer_name}</div>
                    </td>

                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-semibold text-slate-200">{t.subject}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>
                      {t.resolution && (
                        <p className="text-[10px] text-emerald-400 mt-1">Resolution: {t.resolution}</p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold ${
                          t.priority === 'Urgent'
                            ? 'text-rose-400'
                            : t.priority === 'High'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {t.assigned_name || <span className="text-slate-500 italic">Unassigned</span>}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.status === 'Resolved' || t.status === 'Closed'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : t.status === 'In Progress'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-800'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {t.status !== 'Resolved' && t.status !== 'Closed' ? (
                        <button
                          onClick={() => {
                            setResolvingTicket(t);
                            setResolutionText('');
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-700 font-semibold text-[11px] transition-colors"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Open Customer Support Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Account *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company} ({c.name})
                    </option>
                  ))}
                </select>
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
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Support Staff</label>
                  <select
                    value={formData.assigned_user_id}
                    onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Subject / Issue Summary *</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. SSO SAML configuration question"
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Detailed Description *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed symptoms, error codes, steps to reproduce..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md"
                >
                  Open Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Ticket Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Resolve Ticket {resolvingTicket.ticket_number}</h3>
              <button onClick={() => setResolvingTicket(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResolution} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="font-semibold text-slate-200">{resolvingTicket.subject}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{resolvingTicket.description}</p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Resolution Summary *</label>
                <textarea
                  rows={3}
                  required
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Explain what steps or fixes resolved this ticket..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
