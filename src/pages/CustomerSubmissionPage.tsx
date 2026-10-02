import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Mail, ShieldCheck } from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

interface CustomerSubmissionPageProps {
  token?: string;
  onNavigate?: (page: string) => void;
}

const initialForm = {
  customer_name: '',
  company_name: '',
  customer_email: '',
  customer_phone: '',
  location: '',
  industry: '',
  customer_type: '',
  lead_source: '',
  assigned_sales_executive: '',
  deal_value: '',
  sales_stage: '',
  payment_status: '',
  notes: '',
  manager_email: '',
};

export const CustomerSubmissionPage: React.FC<CustomerSubmissionPageProps> = ({ token, onNavigate }) => {
  const { success, error } = useToast();
  const [form, setForm] = useState(initialForm);
  const [executives, setExecutives] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [managerName, setManagerName] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState('');

  const isPublic = Boolean(token);

  useEffect(() => {
    const load = async () => {
      try {
        if (token) {
          const data = await api.getCustomerRequestForm(token);
          setManagerName(data.manager.name);
          setForm((prev) => ({ ...prev, manager_email: data.manager.email }));
          setExecutives(data.executives || []);
        } else {
          const data = await api.getUsers();
          const activeManagers = (data.users || []).filter((u: any) => u.role === 'Sales Manager' && u.status === 'Active');
          setManagers(activeManagers);
          setExecutives((data.users || []).filter((u: any) => u.role === 'Sales Executive' && u.status === 'Active'));
          if (activeManagers.length === 1) {
            setForm((prev) => ({ ...prev, manager_email: activeManagers[0].email }));
          }
        }
      } catch (err: any) {
        error('Unable to load the submission form', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const title = useMemo(() => (isPublic ? 'Customer Submission Form' : 'Internal Customer Submission Form'), [isPublic]);

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.company_name.trim() || !form.manager_email.trim()) {
      error('Customer Name, Company Name, and Manager Email are required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...form, deal_value: Number.parseFloat(form.deal_value || '0') || 0 };
      const result = token
        ? await api.submitPublicCustomerRequest(token, payload)
        : await api.submitCustomerRequest(payload);
      setSubmittedCode(result.request_code);
      success('Customer request submitted as Pending. It was not added to Customers.');
      setForm((prev) => ({ ...initialForm, manager_email: prev.manager_email }));
    } catch (err: any) {
      error('Submission failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-400">Loading customer form...</div>;
  }

  if (submittedCode) {
    return (
      <div className={`${isPublic ? 'min-h-screen' : 'min-h-[70vh]'} bg-slate-950 flex items-center justify-center p-5`}>
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Request Submitted</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your submission is saved separately as a <span className="text-indigo-300 font-semibold">Pending Customer Request</span>.
            It has not been created as an active customer.
          </p>
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Request ID</div>
            <div className="mt-1 text-sm font-semibold text-white">{submittedCode}</div>
          </div>
          {!isPublic && onNavigate && (
            <button onClick={() => onNavigate('customer-requests')} className="mt-5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
              View Customer Requests
            </button>
          )}
        </div>
      </div>
    );
  }

  const fieldClass = "w-full bg-slate-800/90 text-white px-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm placeholder-slate-500";
  const labelClass = "block text-xs font-semibold text-slate-300 mb-1.5";

  return (
    <div className={`${isPublic ? 'min-h-screen py-10' : 'space-y-6'} bg-slate-950 p-5`}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <ClipboardList className="w-4 h-4" />
              Insight360
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Submit customer information for manager review. Submission status starts as Pending.
            </p>
            {managerName && (
              <p className="mt-2 text-xs text-slate-500">Assigned manager: <span className="text-slate-300">{managerName}</span></p>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Separate from Customers
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6">
            <div>
              <label className={labelClass}>Customer Name *</label>
              <input required value={form.customer_name} onChange={(e) => setField('customer_name', e.target.value)} className={fieldClass} placeholder="Customer full name" />
            </div>
            <div>
              <label className={labelClass}>Company Name *</label>
              <input required value={form.company_name} onChange={(e) => setField('company_name', e.target.value)} className={fieldClass} placeholder="Company name" />
            </div>
            <div>
              <label className={labelClass}>Customer Email</label>
              <input type="email" value={form.customer_email} onChange={(e) => setField('customer_email', e.target.value)} className={fieldClass} placeholder="customer@company.com" />
            </div>
            <div>
              <label className={labelClass}>Customer Phone</label>
              <input value={form.customer_phone} onChange={(e) => setField('customer_phone', e.target.value)} className={fieldClass} placeholder="+91..." />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input value={form.location} onChange={(e) => setField('location', e.target.value)} className={fieldClass} placeholder="City, State, Country" />
            </div>
            <div>
              <label className={labelClass}>Industry</label>
              <input value={form.industry} onChange={(e) => setField('industry', e.target.value)} className={fieldClass} placeholder="IT, Finance, Healthcare..." />
            </div>
            <div>
              <label className={labelClass}>Customer Type</label>
              <select value={form.customer_type} onChange={(e) => setField('customer_type', e.target.value)} className={fieldClass}>
                <option value="">Select type</option>
                <option>New Customer</option>
                <option>Existing Customer</option>
                <option>Enterprise</option>
                <option>SMB</option>
                <option>Partner</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Lead Source</label>
              <input value={form.lead_source} onChange={(e) => setField('lead_source', e.target.value)} className={fieldClass} placeholder="Website, Referral, Event..." />
            </div>
            <div>
              <label className={labelClass}>Assigned Sales Executive</label>
              {executives.length > 0 ? (
                <select value={form.assigned_sales_executive} onChange={(e) => setField('assigned_sales_executive', e.target.value)} className={fieldClass}>
                  <option value="">Select executive</option>
                  {executives.map((u) => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                </select>
              ) : (
                <input value={form.assigned_sales_executive} onChange={(e) => setField('assigned_sales_executive', e.target.value)} className={fieldClass} placeholder="Sales executive name" />
              )}
            </div>
            <div>
              <label className={labelClass}>Deal Value</label>
              <input type="number" min="0" step="0.01" value={form.deal_value} onChange={(e) => setField('deal_value', e.target.value)} className={fieldClass} placeholder="0" />
            </div>
            <div>
              <label className={labelClass}>Sales Stage</label>
              <select value={form.sales_stage} onChange={(e) => setField('sales_stage', e.target.value)} className={fieldClass}>
                <option value="">Select stage</option>
                <option>New</option>
                <option>Contacted</option>
                <option>Proposal</option>
                <option>Negotiation</option>
                <option>Converted</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment Status</label>
              <select value={form.payment_status} onChange={(e) => setField('payment_status', e.target.value)} className={fieldClass}>
                <option value="">Select status</option>
                <option>Not Applicable</option>
                <option>Pending</option>
                <option>Partially Paid</option>
                <option>Paid</option>
                <option>Overdue</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Notes</label>
              <textarea rows={4} value={form.notes} onChange={(e) => setField('notes', e.target.value)} className={fieldClass} placeholder="Additional customer context..." />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Manager Email *</label>
              {isPublic ? (
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input readOnly value={form.manager_email} className={`${fieldClass} pl-9 bg-slate-900 text-slate-300`} />
                </div>
              ) : (
                <select required value={form.manager_email} onChange={(e) => setField('manager_email', e.target.value)} className={fieldClass}>
                  <option value="">Select manager</option>
                  {managers.map((u) => <option key={u.id} value={u.email}>{u.full_name} — {u.email}</option>)}
                </select>
              )}
              <p className="mt-1 text-[10px] text-slate-500">This determines which manager receives the pending request.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/40 px-6 py-4">
            <button type="button" onClick={() => onNavigate?.('customer-requests')} className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
            <button disabled={submitting} type="submit" className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20">
              {submitting ? 'Submitting...' : 'Submit Customer Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
