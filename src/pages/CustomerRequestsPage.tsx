import React, { useEffect, useState } from 'react';
import { ClipboardList, Download, ExternalLink, Link2, Plus, RefreshCw, Upload, Copy, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

interface CustomerRequestsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CustomerRequestsPage: React.FC<CustomerRequestsPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomerRequests();
      setRequests(data.requests || []);
    } catch (err: any) {
      error('Unable to load Customer Requests', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createShareLink = async () => {
    try {
      setCreatingLink(true);
      const data = await api.createCustomerRequestShareLink();
      setShareUrl(data.url);
      setCopied(false);
      success('Unique customer submission link created');
    } catch (err: any) {
      error('Could not create share link', err.message);
    } finally {
      setCreatingLink(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      success('Shareable link copied');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      error('Copy failed', 'Copy the link manually from the field.');
    }
  };

  const downloadCsv = () => {
    if (!requests.length) {
      error('No customer requests to export');
      return;
    }
    const headers = [
      'Request ID','Customer Name','Company','Customer Email','Customer Phone','Location','Industry',
      'Customer Type','Lead Source','Assigned Sales Executive','Deal Value','Sales Stage','Payment Status',
      'Notes','Manager Email','Submission Date','Status','Submitted Via'
    ];
    const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      headers.map(escapeCsv).join(','),
      ...requests.map((r) => [
        r.request_code, r.customer_name, r.company_name, r.customer_email, r.customer_phone, r.location,
        r.industry, r.customer_type, r.lead_source, r.assigned_sales_executive, r.deal_value, r.sales_stage,
        r.payment_status, r.notes, r.manager_email, r.created_at ? new Date(r.created_at).toLocaleString() : '',
        r.status, r.submitted_via
      ].map(escapeCsv).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Customer_Requests.csv';
    a.click();
    URL.revokeObjectURL(url);
    success('Customer requests exported to CSV');
  };

  const downloadExcel = () => {
    if (!requests.length) {
      error('No customer requests to export');
      return;
    }
    const rows = requests.map((r) => ({
      'Request ID': r.request_code,
      'Customer Name': r.customer_name,
      'Company': r.company_name,
      'Customer Email': r.customer_email || '',
      'Customer Phone': r.customer_phone || '',
      'Location': r.location || '',
      'Industry': r.industry || '',
      'Customer Type': r.customer_type || '',
      'Lead Source': r.lead_source || '',
      'Assigned Sales Executive': r.assigned_sales_executive || '',
      'Deal Value': r.deal_value || 0,
      'Sales Stage': r.sales_stage || '',
      'Payment Status': r.payment_status || '',
      'Notes': r.notes || '',
      'Manager Email': r.manager_email || '',
      'Submission Date': r.created_at ? new Date(r.created_at).toLocaleString() : '',
      'Status': r.status,
      'Submitted Via': r.submitted_via || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Requests');
    XLSX.writeFile(wb, 'Customer_Requests.xlsx');
    success('Customer requests exported to Excel');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Customer Requests</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">{requests.length}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Review pending submissions before they become actual customer records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('customer-submission')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Submission
          </button>
          <button onClick={() => onNavigate('customer-import')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium">
            <Upload className="w-3.5 h-3.5" /> Import Customers
          </button>
          <button onClick={downloadExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium">
            <Download className="w-3.5 h-3.5" /> Download Excel
          </button>
          <button onClick={downloadCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={load} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Link2 className="w-4 h-4 text-indigo-400" /> Create / Share Form</div>
            <p className="text-xs text-slate-400 mt-1">Generate a manager-specific link. Anyone with the link can submit a request; it will still remain Pending.</p>
          </div>
          <button disabled={creatingLink} onClick={createShareLink} className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold">
            {creatingLink ? 'Creating...' : 'Generate Shareable Link'}
          </button>
        </div>
        {shareUrl && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input readOnly value={shareUrl} className="flex-1 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300" />
            <button onClick={copyLink} className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-white flex items-center justify-center gap-1.5">
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-white flex items-center justify-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No customer requests yet</p>
            <p className="text-xs text-slate-500 mt-1">Generate a shareable form link or submit an internal request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Industry</th>
                  <th className="py-3 px-4">Deal Value</th>
                  <th className="py-3 px-4">Sales Stage</th>
                  <th className="py-3 px-4">Submission Date</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-200">{r.customer_name}</td>
                    <td className="py-3 px-4 text-slate-300">{r.company_name}</td>
                    <td className="py-3 px-4 text-slate-400">
                      <div>{r.customer_email || '—'}</div>
                      <div className="text-[10px] mt-0.5">{r.customer_phone || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{r.industry || '—'}</td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold">{Number(r.deal_value || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-300">{r.sales_stage || '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full border border-amber-800/70 bg-amber-950/40 text-amber-300 text-[10px] font-semibold">{r.status}</span>
                    </td>
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
