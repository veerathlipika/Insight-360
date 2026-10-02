import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

interface CustomerImportPageProps {
  onNavigate: (page: string, params?: any) => void;
}

type PreviewRow = {
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  deal_value: number;
  location: string;
  notes: string;
  duplicate?: any;
  duplicate_reason?: string | null;
  valid?: boolean;
  allow_duplicate?: boolean;
};

const normalizeHeader = (value: any) =>
  String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

const mapRow = (raw: any): PreviewRow => {
  const normalized: Record<string, any> = {};
  Object.entries(raw || {}).forEach(([key, value]) => {
    normalized[normalizeHeader(key)] = value;
  });
  return {
    name: String(normalized['customer name'] ?? normalized['name'] ?? '').trim(),
    company: String(normalized['company'] ?? normalized['company name'] ?? '').trim(),
    email: String(normalized['email'] ?? normalized['customer email'] ?? '').trim().toLowerCase(),
    phone: String(normalized['phone'] ?? normalized['customer phone'] ?? '').trim(),
    industry: String(normalized['industry'] ?? '').trim(),
    deal_value: Number.parseFloat(String(normalized['deal value'] ?? normalized['deal_value'] ?? 0)) || 0,
    location: String(normalized['location'] ?? normalized['address'] ?? '').trim(),
    notes: String(normalized['notes'] ?? '').trim(),
  };
};

export const CustomerImportPage: React.FC<CustomerImportPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  const duplicates = useMemo(() => rows.filter((r) => r.duplicate), [rows]);

  const handleFile = async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      error('Unsupported file', 'Upload an .xlsx, .xls, or .csv file.');
      return;
    }

    try {
      setChecking(true);
      setFileName(file.name);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      const mapped = rawRows.map(mapRow);
      if (!mapped.length) {
        error('No rows found', 'The selected file does not contain customer records.');
        setRows([]);
        return;
      }
      const checked = await api.checkCustomerImport(mapped);
      setRows((checked.rows || []).map((r: any) => ({
        ...mapRow(r.row),
        duplicate: r.duplicate,
        duplicate_reason: r.duplicate_reason,
        valid: r.valid,
      })));
    } catch (err: any) {
      error('Could not read file', err.message);
      setRows([]);
    } finally {
      setChecking(false);
    }
  };

  const handleImport = async () => {
    const eligible = rows.filter((r) => r.valid && (!r.duplicate || r.allow_duplicate));
    if (!eligible.length) {
      error('Nothing to import', 'Fix invalid rows or choose which duplicates should be imported.');
      return;
    }
    try {
      setImporting(true);
      const result = await api.importCustomers(eligible);
      success(`${result.imported.length} customer(s) imported into the Customers database.`);
      if (result.skipped.length) {
        error(`${result.skipped.length} row(s) were skipped`, 'Some duplicates or invalid rows were detected again during confirmation.');
      }
      setRows([]);
      setFileName('');
    } catch (err: any) {
      error('Import failed', err.message);
    } finally {
      setImporting(false);
    }
  };

  const toggleDuplicate = (index: number) => {
    setRows((current) => current.map((row, i) => i === index ? { ...row, allow_duplicate: !row.allow_duplicate } : row));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Import Customers</h2>
          <p className="text-xs text-slate-400 mt-1">Upload .xlsx, .xls, or .csv and preview every row before it reaches the Customers database.</p>
        </div>
        <button onClick={() => onNavigate('customers')} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200">Back to Customers</button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
        <label className="block cursor-pointer">
          <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500/70 hover:bg-slate-800/30 transition-colors">
            <FileSpreadsheet className="w-9 h-9 text-indigo-400 mx-auto mb-3" />
            <div className="text-sm font-semibold text-white">Choose customer file</div>
            <div className="text-xs text-slate-500 mt-1">Supported: .xlsx, .xls, .csv</div>
            {fileName && <div className="text-xs text-slate-300 mt-3">{fileName}</div>}
            {checking && <div className="text-xs text-indigo-300 mt-3">Reading file and checking duplicates...</div>}
          </div>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white">Import Preview</div>
              <div className="text-xs text-slate-500 mt-0.5">{rows.length} row(s) found · {duplicates.length} possible duplicate(s)</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setRows([]); setFileName(''); }} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Cancel</button>
              <button disabled={importing} onClick={handleImport} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> {importing ? 'Importing...' : 'Import Customers'}</button>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="m-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <div>Possible duplicates are highlighted below. They are skipped by default. Check <strong>Import anyway</strong> only when you have reviewed that row and intentionally want a second customer record.</div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Deal Value</th>
                  <th className="px-4 py-3">Duplicate Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row, index) => (
                  <tr key={`${row.name}-${index}`} className={row.duplicate ? 'bg-amber-950/10' : ''}>
                    <td className="px-4 py-3 text-slate-200 font-medium">{row.name || <span className="text-rose-400">Missing</span>}</td>
                    <td className="px-4 py-3 text-slate-300">{row.company || <span className="text-rose-400">Missing</span>}</td>
                    <td className="px-4 py-3 text-slate-400">{row.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{row.industry || '—'}</td>
                    <td className="px-4 py-3 text-emerald-400">{row.deal_value.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {row.duplicate ? (
                        <label className="flex items-center gap-2 text-amber-300 cursor-pointer">
                          <input type="checkbox" checked={Boolean(row.allow_duplicate)} onChange={() => toggleDuplicate(index)} />
                          <span>{row.duplicate_reason}. Import anyway</span>
                        </label>
                      ) : row.valid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> No duplicate found</span>
                      ) : (
                        <span className="text-rose-400">Customer Name + Company required</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
