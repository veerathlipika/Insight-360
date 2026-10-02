import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  Video,
  FileText,
  Search,
  Filter,
  Plus,
  X,
  User,
  Building,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Communication, Customer } from '../types/index.ts';

interface CommunicationsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CommunicationsPage: React.FC<CommunicationsPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();

  const [communications, setCommunications] = useState<Communication[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    type: 'Call',
    subject: '',
    content: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [commRes, custRes] = await Promise.all([
        api.getCommunications(),
        api.getCustomers(),
      ]);
      setCommunications(commRes.communications);
      setCustomers(custRes.customers);
    } catch (err: any) {
      error('Failed to load communications', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.subject || !formData.content) {
      error('Customer, Subject, and Content are required.');
      return;
    }

    try {
      await api.logCommunication({
        ...formData,
        customer_id: parseInt(formData.customer_id, 10),
      });
      success('Interaction logged to timeline');
      setShowLogModal(false);
      setFormData({ customer_id: '', type: 'Call', subject: '', content: '' });
      loadData();
    } catch (err: any) {
      error('Failed to log interaction', err.message);
    }
  };

  const filtered = communications.filter((c) => {
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    const matchSearch =
      search === '' ||
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase()) ||
      (c.customer_company && c.customer_company.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const getTypeIcon = (type: string) => {
    if (type === 'Call') return <Phone className="w-3.5 h-3.5" />;
    if (type === 'Email') return <Mail className="w-3.5 h-3.5" />;
    if (type === 'Meeting') return <Video className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Unified Communication History
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete chronological activity timeline across all client accounts, phone calls, meetings, emails, and internal sales notes.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              customer_id: customers[0]?.id ? String(customers[0].id) : '',
              type: 'Call',
              subject: '',
              content: '',
            });
            setShowLogModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Activity</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search interaction contents, notes, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/90 text-xs text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
          >
            <option value="all" className="bg-slate-900">All Interaction Types</option>
            <option value="Call" className="bg-slate-900">Calls</option>
            <option value="Email" className="bg-slate-900">Emails</option>
            <option value="Meeting" className="bg-slate-900">Meetings</option>
            <option value="Note" className="bg-slate-900">Notes</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">Loading interaction stream...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No interaction logs found</p>
            <p className="text-xs text-slate-500 mt-1">Record calls and meeting notes to keep everyone on the same page.</p>
          </div>
        ) : (
          <div className="relative border-l border-slate-800 ml-4 space-y-6">
            {filtered.map((c) => (
              <div key={c.id} className="relative pl-6 text-xs space-y-2">
                <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 shadow-md shadow-indigo-500/30" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-300 px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800">
                      {getTypeIcon(c.type)}
                      <span>{c.type}</span>
                    </span>

                    <button
                      onClick={() => onNavigate('customer-360', { customerId: c.customer_id })}
                      className="font-bold text-white hover:text-indigo-400 transition-colors"
                    >
                      {c.customer_company || 'Customer'}
                    </button>

                    <span className="text-slate-600">·</span>
                    <span className="font-semibold text-slate-300">{c.subject}</span>
                  </div>

                  <span className="text-[11px] text-slate-500 shrink-0">
                    {new Date(c.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-slate-200 leading-relaxed text-xs">
                  {c.content}
                </div>

                {c.user_name && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-600" />
                    <span>Recorded by {c.user_name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Activity Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Log Customer Interaction</h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInteraction} className="space-y-3.5 text-xs">
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

              <div>
                <label className="block text-slate-300 font-medium mb-1">Interaction Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Message">Direct Message</option>
                  <option value="Note">Internal Sales Note</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Subject / Header *</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Demonstration of pipeline analytics"
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Interaction Details &amp; Feedback *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Key discussion points, customer reaction, commitments made..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md"
                >
                  Record Interaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
