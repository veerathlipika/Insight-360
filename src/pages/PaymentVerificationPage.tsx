import React, { useEffect, useState } from 'react';
import { Check, FileCheck2, RefreshCw, X } from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

function money(value: number | string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function displayDate(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const PaymentVerificationPage: React.FC = () => {
  const { success, error } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPayments = async () => {
    try {
      const result = await api.getManagerPayments();
      setPayments(result.payments);
      if (selectedId && result.payments.some((payment) => payment.id === selectedId)) {
        const current = await api.getManagerPayment(selectedId);
        setDetail(current.payment);
      } else if (result.payments.length) {
        setSelectedId(result.payments[0].id);
        const current = await api.getManagerPayment(result.payments[0].id);
        setDetail(current.payment);
      } else {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err: any) {
      error('Could not load payment submissions', err.message);
    }
  };

  useEffect(() => { loadPayments(); }, []);

  const selectPayment = async (paymentId: number) => {
    try {
      const result = await api.getManagerPayment(paymentId);
      setSelectedId(paymentId);
      setDetail(result.payment);
      setRejectReason('');
    } catch (err: any) {
      error('Could not load payment details', err.message);
    }
  };

  const verifyPayment = async (approve: boolean) => {
    if (!detail) return;
    if (!approve && !rejectReason.trim()) {
      error('Add a reason before rejecting this payment.');
      return;
    }
    try {
      setBusy(true);
      if (approve) await api.approveManagerPayment(detail.id);
      else await api.rejectManagerPayment(detail.id, rejectReason.trim());
      success(approve ? 'Payment verified and customer notified.' : 'Payment rejected and customer notified.');
      setRejectReason('');
      await loadPayments();
    } catch (err: any) {
      error('Could not update payment status', err.message);
    } finally {
      setBusy(false);
    }
  };

  const awaitingCount = payments.filter((payment) => ['Verification Pending', 'Under Review'].includes(payment.status)).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-400">Manager workspace</p><h1 className="mt-1 text-xl font-bold text-white">Payment Verification</h1><p className="mt-1 text-xs text-slate-400">Review uploaded receipts before marking customer invoices as paid.</p></div>
        <button onClick={loadPayments} title="Refresh payments" className="rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"><RefreshCw className="h-4 w-4" /></button>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><h2 className="text-sm font-bold text-white">All payments</h2><p className="mt-1 text-[11px] text-slate-400">{awaitingCount} awaiting review</p></div><FileCheck2 className="h-4 w-4 text-amber-300" /></div>
          <div className="divide-y divide-slate-800/80">
            {payments.map((payment) => <button key={payment.id} onClick={() => selectPayment(payment.id)} className={`w-full px-4 py-3 text-left transition-colors ${selectedId === payment.id ? 'bg-slate-800/90' : 'hover:bg-slate-800/50'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-100">{payment.customer_name} <span className="font-normal text-slate-400">· {payment.company}</span></p><p className="mt-1 text-[11px] text-slate-400">{payment.invoice_number} · {payment.transaction_id}</p></div><span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-semibold ${payment.status === 'Verified' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : payment.status === 'Rejected' ? 'border-rose-800 bg-rose-950/40 text-rose-300' : 'border-amber-800 bg-amber-950/40 text-amber-200'}`}>{payment.status}</span></div><div className="mt-2 flex items-center justify-between text-xs"><span className="font-semibold text-white">{money(payment.amount)}</span><span className="text-slate-500">Submitted {displayDate(payment.submitted_at)}</span></div></button>)}
            {!payments.length && <div className="p-10 text-center"><FileCheck2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">No payment submissions</p><p className="mt-1 text-xs text-slate-500">Customer-submitted receipts will appear here.</p></div>}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/80 p-5">
          {detail ? <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Payment details</p><h2 className="mt-1 text-base font-bold text-white">{detail.customer_name}</h2><p className="mt-1 text-xs text-slate-400">{detail.company} · {detail.customer_code}</p></div><span className="rounded border border-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300">{detail.status}</span></div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-xs">
              {[
                ['Invoice', detail.invoice_number], ['Invoice total', money(detail.invoice_amount)], ['Amount claimed', money(detail.amount)], ['Transaction ID / UTR', detail.transaction_id], ['Payment method', detail.payment_method], ['Payment date', displayDate(detail.payment_date)], ['Submitted date', displayDate(detail.submitted_at)], ['Customer email', detail.email],
              ].map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-200">{value}</dd></div>)}
            </dl>
            {detail.rejection_reason && <p className="mt-4 border-l-2 border-rose-500 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">Previous rejection: {detail.rejection_reason}</p>}
            <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs font-semibold text-slate-300">Receipt</p>{detail.receipt_id ? <button onClick={() => api.openManagerReceipt(detail.id).catch((err: Error) => error('Could not open receipt', err.message))} className="mt-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-slate-800">View uploaded receipt</button> : <p className="mt-2 text-xs text-slate-500">No receipt attached.</p>}</div>
            {['Verification Pending', 'Under Review'].includes(detail.status) && <div className="mt-5 space-y-3 border-t border-slate-800 pt-4"><button disabled={busy || !detail.receipt_id} onClick={() => verifyPayment(true)} className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"><Check className="h-4 w-4" /> Approve payment</button><label className="block text-xs font-semibold text-slate-300">Rejection reason<textarea rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-rose-500" placeholder="Explain what needs to be corrected" /></label><button disabled={busy} onClick={() => verifyPayment(false)} className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-800 px-3 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"><X className="h-4 w-4" /> Reject payment</button></div>}
          </> : <div className="flex min-h-64 flex-col items-center justify-center text-center"><FileCheck2 className="h-8 w-8 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">Select a payment</p><p className="mt-1 text-xs text-slate-500">Review its invoice, transaction details, and receipt.</p></div>}
        </section>
      </div>
    </div>
  );
};
