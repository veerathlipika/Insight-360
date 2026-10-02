import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Headphones,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Minus,
  Plus,
  Phone,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { api } from '../services/api.ts';

interface CustomerPortalPageProps {
  customerId: number;
}

type CustomerView = 'dashboard' | 'profile' | 'customer360' | 'invoices' | 'orders' | 'payments' | 'usage' | 'timeline' | 'support' | 'notifications';
type PaymentMethod = 'UPI' | 'QR Code';

const navigation: Array<{ id: CustomerView; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile', label: 'My Profile', icon: UserRound },
  { id: 'customer360', label: 'My Customer 360', icon: Activity },
  { id: 'invoices', label: 'My Invoices', icon: ReceiptText },
  { id: 'orders', label: 'My Orders', icon: ClipboardList },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'usage', label: 'Product Usage', icon: ShoppingBag },
  { id: 'timeline', label: 'Activity Timeline', icon: CalendarDays },
  { id: 'support', label: 'Support', icon: Headphones },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const paymentQrUrl = import.meta.env.VITE_INSIGHT360_CUSTOMER_PAYMENT_QR;

function money(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function displayDate(value?: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Verification Pending': 'bg-amber-50 text-amber-800 border-amber-200',
    'Under Review': 'bg-sky-50 text-sky-800 border-sky-200',
    Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
    Unpaid: 'bg-amber-50 text-amber-800 border-amber-200',
    Pending: 'bg-amber-50 text-amber-800 border-amber-200',
    Open: 'bg-sky-50 text-sky-800 border-sky-200',
    'In Progress': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Closed: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{status}</span>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',').pop() || '');
    reader.onerror = () => reject(new Error('Could not read the receipt file.'));
    reader.readAsDataURL(file);
  });
}

export const CustomerPortalPage: React.FC<CustomerPortalPageProps> = ({ customerId }) => {
  const { logout, user } = useAuth();
  const { success, error } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<CustomerView>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', phone: '', address: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<number, number>>({});
  const [orderNotes, setOrderNotes] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const loadDashboard = async () => {
    try {
      const result = await api.getCustomerDashboard();
      setData(result);
      setProfileDraft({
        name: result.profile.name || '',
        email: result.profile.email || '',
        phone: result.profile.phone || '',
        address: result.profile.address || '',
      });
    } catch (err: any) {
      error('Could not load your account', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) loadDashboard();
    else setLoading(false);
  }, [customerId]);

  const profile = data?.profile;
  const invoices = data?.invoices || [];
  const orders = data?.orders || [];
  const orderRequests = data?.orderRequests || [];
  const payments = data?.payments || [];
  const tickets = data?.supportTickets || [];
  const activities = data?.activities || [];
  const notifications = data?.notifications || [];
  const usage = data?.usage || [];
  const latestUsage = usage[0];
  const outstandingInvoices = useMemo(() => invoices.filter((invoice: any) =>
    Number(invoice.outstanding_amount) > 0 && !payments.some((payment: any) =>
      payment.invoice_id === invoice.id && ['Verification Pending', 'Under Review'].includes(payment.status)
    )
  ), [invoices, payments]);
  const selectedInvoice = invoices.find((invoice: any) => invoice.id === selectedInvoiceId) || outstandingInvoices[0] || null;
  const openTickets = tickets.filter((ticket: any) => ['Open', 'In Progress'].includes(ticket.status));
  const resolvedTickets = tickets.filter((ticket: any) => ['Resolved', 'Closed'].includes(ticket.status));
  const selectedProducts = products.filter((product) => Number(productQuantities[product.id]) > 0);
  const orderSubtotal = selectedProducts.reduce((sum, product) => sum + Number(product.unit_price) * Number(productQuantities[product.id]), 0);
  const orderTax = Math.round(orderSubtotal * 0.08 * 100) / 100;
  const orderTotal = Math.round((orderSubtotal + orderTax) * 100) / 100;

  useEffect(() => {
    if (selectedInvoice) setPaymentAmount(String(selectedInvoice.outstanding_amount));
  }, [selectedInvoiceId, selectedInvoice?.id]);

  const navigate = (view: CustomerView) => {
    setActiveView(view);
    setMobileNavOpen(false);
    setInvoicePreview(null);
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedInvoice || !receiptFile) {
      error('Choose an invoice and upload the payment receipt.');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(receiptFile.type)) {
      error('Receipt must be a PDF, JPG, or PNG file.');
      return;
    }
    if (receiptFile.size > 3 * 1024 * 1024) {
      error('Receipt file must be 3 MB or smaller.');
      return;
    }

    try {
      setSubmittingPayment(true);
      const receiptBase64 = await fileToBase64(receiptFile);
      const result = await api.submitCustomerPayment({
        invoiceId: selectedInvoice.id,
        amount: Number(paymentAmount),
        paymentMethod,
        transactionId,
        paymentDate,
        receipt: { fileName: receiptFile.name, mimeType: receiptFile.type, base64: receiptBase64 },
      });
      success(`Payment submitted. Status: ${result.payment.status}.`);
      setReceiptFile(null);
      setTransactionId('');
      await loadDashboard();
      navigate('payments');
    } catch (err: any) {
      error('Payment could not be submitted', err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSupportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setBusy(true);
      await api.createCustomerSupport({ subject: supportSubject, description: supportDescription });
      success('Support request submitted.');
      setSupportSubject('');
      setSupportDescription('');
      setShowSupportForm(false);
      await loadDashboard();
    } catch (err: any) {
      error('Could not submit support request', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setBusy(true);
      await api.updateCustomerPortalProfile(profileDraft);
      await loadDashboard();
      setEditingProfile(false);
      success('Profile updated.');
    } catch (err: any) {
      error('Could not update your profile', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setBusy(true);
      await api.updateCustomerPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
      success('Password updated.');
    } catch (err: any) {
      error('Could not update your password', err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePayNow = (invoice: any) => {
    setSelectedInvoiceId(invoice.id);
    setActiveView('payments');
  };

  const openOrderModal = async () => {
    setShowOrderModal(true);
    setProductQuantities({});
    try {
      setLoadingProducts(true);
      const result = await api.getCustomerProducts();
      setProducts(result.products);
    } catch (err: any) {
      error('Could not load products', err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const submitOrderRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const items = selectedProducts.map((product) => ({ product_id: product.id, quantity: Number(productQuantities[product.id]) }));
    if (!items.length) {
      error('Choose at least one product or service.');
      return;
    }
    try {
      setPlacingOrder(true);
      const result = await api.createCustomerOrderRequest({ items, notes: orderNotes });
      success(`Order request ${result.request.request_number} sent for sales approval.`);
      setShowOrderModal(false);
      setOrderNotes('');
      await loadDashboard();
      navigate('orders');
    } catch (err: any) {
      error('Could not submit order request', err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const downloadInvoice = (invoice: any) => {
    const invoiceHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${invoice.invoice_number}</title><style>body{font:16px sans-serif;max-width:720px;margin:48px auto;color:#17382b}h1{margin-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:32px}td{padding:12px;border-bottom:1px solid #dce6de}td:last-child{text-align:right}</style></head><body><h1>Insight360 Invoice</h1><p>${profile.company} · ${profile.name}</p><table><tr><td>Invoice</td><td>${invoice.invoice_number}</td></tr><tr><td>Invoice date</td><td>${displayDate(invoice.created_at)}</td></tr><tr><td>Due date</td><td>${displayDate(invoice.due_date)}</td></tr><tr><td>Amount</td><td>${money(invoice.amount)}</td></tr><tr><td>Outstanding</td><td>${money(invoice.outstanding_amount)}</td></tr><tr><td>Status</td><td>${invoice.status}</td></tr></table></body></html>`;
    const url = URL.createObjectURL(new Blob([invoiceHtml], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoice_number}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markNotificationRead = async (notificationId: number) => {
    try {
      await api.markCustomerNotificationRead(notificationId);
      await loadDashboard();
    } catch (err: any) {
      error('Could not update notification', err.message);
    }
  };

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f3f7f1] text-sm text-[#52675a]">Loading your Insight360 account...</main>;
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f3f7f1] px-5 text-center text-[#405248]">
        <p>Your customer profile is not linked to this account yet. Contact your sales team to connect the phone number on your profile.</p>
        <button onClick={logout} className="text-sm font-semibold text-[#27704c] hover:text-[#174d3b]">Sign out</button>
      </main>
    );
  }

  const chartData = {
    labels: ['Active days', 'Sessions', 'Features used'],
    datasets: [{
      label: 'This month',
      data: [Number(latestUsage?.active_days || 0), Number(latestUsage?.sessions || 0), latestUsage?.features_used?.length || 0],
      backgroundColor: ['#398660', '#ed7653', '#d6ad53'],
      borderRadius: 5,
    }],
  };

  return (
    <div className="min-h-screen bg-[#f3f7f1] text-[#172820]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#dce6de] bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="rounded-md p-2 text-[#52675a] hover:bg-[#f1f5f1] lg:hidden" aria-label="Toggle customer navigation">
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <img src="/insight360-logo.jpg" alt="Insight360 Logo" className="h-9 w-9 object-contain rounded-lg bg-white p-0.5 shadow-sm border border-[#dce6de]" />
          <div><p className="text-sm font-bold tracking-tight text-[#17382b]">Insight360</p><p className="text-[10px] text-[#718077]">Customer account</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-[#647168] sm:block">{profile.name || user?.full_name}</span>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-md border border-[#d4dfd5] px-3 py-2 text-xs font-semibold text-[#52675a] hover:bg-[#f3f7f1]"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1480px]">
        <aside className={`${mobileNavOpen ? 'block' : 'hidden'} fixed inset-x-0 top-16 z-20 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-[#dce6de] bg-white p-3 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-4`}>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#88948c]">Your account</p>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs font-semibold transition-colors ${activeView === item.id ? 'bg-[#e9f1e9] text-[#174d3b]' : 'text-[#647168] hover:bg-[#f5f8f5] hover:text-[#17382b]'}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.id === 'notifications' && notifications.some((notification: any) => !notification.is_read) && <span className="h-2 w-2 rounded-full bg-[#ed7653]" />}
                </button>
              );
            })}
          </nav>
          <div className="mt-7 border-t border-[#e5ebe5] pt-4">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-[#88948c]">Account reference</p>
            <p className="mt-2 px-3 text-xs font-bold text-[#315446]">{profile.customerCode}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          {activeView === 'dashboard' && (
            <div className="space-y-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#ba5e43]">Customer overview</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#17382b]">Welcome back, {profile.name}</h1>
                <p className="mt-1 text-sm text-[#647168]">Here's an overview of your account.</p>
                </div>
                <button onClick={openOrderModal} className="inline-flex items-center gap-2 rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#103c2d]"><Plus className="h-4 w-4" /> Place New Order</button>
              </div>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: 'Outstanding amount', value: money(data.metrics.outstandingAmount), icon: Wallet, accent: 'text-[#bd5942]' },
                  { label: 'Total paid', value: money(data.metrics.totalPaid), icon: CircleDollarSign, accent: 'text-[#398660]' },
                  { label: 'Open support tickets', value: data.metrics.openTickets, icon: Headphones, accent: 'text-[#b18435]' },
                  { label: 'Last payment', value: data.metrics.lastPayment ? money(data.metrics.lastPayment.amount) : 'No payments', icon: CreditCard, accent: 'text-[#315f89]' },
                  { label: 'Relationship score', value: `${data.metrics.relationshipScore}/100`, icon: Activity, accent: 'text-[#398660]' },
                ].map((metric) => {
                  const Icon = metric.icon;
                  return <div key={metric.label} className="border border-[#dce6de] bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs text-[#718077]">{metric.label}</p><Icon className={`h-4 w-4 ${metric.accent}`} /></div><p className="mt-3 text-xl font-bold text-[#17382b]">{metric.value}</p>{metric.label === 'Last payment' && data.metrics.lastPayment && <p className="mt-1 text-[10px] text-[#88948c]">{displayDate(data.metrics.lastPayment.date)}</p>}</div>;
                })}
              </section>
              <p className="-mt-5 text-[10px] text-[#88948c]">Relationship score reflects your product activity and feedback. It is not a credit or churn rating.</p>

              {outstandingInvoices.length > 0 && (
                <section className="flex flex-col justify-between gap-4 border border-[#edc1b1] bg-[#fff8f4] p-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-[#fde7dd] text-[#b85a3d]"><FileText className="h-4 w-4" /></span><div><p className="text-sm font-bold text-[#8f442f]">Payment due</p><p className="mt-1 text-xs text-[#765e55]">{outstandingInvoices[0].invoice_number} · {money(outstandingInvoices[0].outstanding_amount)} · Due {displayDate(outstandingInvoices[0].due_date)}</p></div></div>
                  <button onClick={() => handlePayNow(outstandingInvoices[0])} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ed7653] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#d85f40]">Pay now <ArrowRight className="h-3.5 w-3.5" /></button>
                </section>
              )}

              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="border border-[#dce6de] bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-[#e7ece7] pb-3"><div><h2 className="text-sm font-bold text-[#17382b]">Recent activity</h2><p className="mt-1 text-xs text-[#718077]">Recent account events</p></div><button onClick={() => navigate('timeline')} className="text-xs font-semibold text-[#27704c] hover:text-[#174d3b]">View timeline</button></div>
                  <div className="divide-y divide-[#edf1ed]">
                    {activities.slice(0, 5).map((activity: any, index: number) => <div key={`${activity.type}-${activity.created_at}-${index}`} className="flex items-start gap-3 py-3"><span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#edf4ee] text-[#398660]"><CheckCircle2 className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-[#405248]">{activity.description}</p><p className="mt-1 text-[10px] text-[#88948c]">{activity.type} · {displayDate(activity.created_at)}</p></div></div>)}
                    {!activities.length && <p className="py-7 text-center text-xs text-[#88948c]">Activity will appear here as your account is used.</p>}
                  </div>
                </div>
                <div className="border border-[#dce6de] bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-[#e7ece7] pb-3"><div><h2 className="text-sm font-bold text-[#17382b]">Product usage</h2><p className="mt-1 text-xs text-[#718077]">Latest monthly activity</p></div><button onClick={() => navigate('usage')} title="Open product usage" className="rounded-md p-1.5 text-[#52675a] hover:bg-[#f3f7f1]"><Activity className="h-4 w-4" /></button></div>
                  <div className="mt-4 h-48"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf1ed' } } } }} /></div>
                </div>
              </section>
            </div>
          )}

          {activeView === 'profile' && (
            <section className="max-w-3xl space-y-5">
              <div><h1 className="text-xl font-bold text-[#17382b]">My Profile</h1><p className="mt-1 text-sm text-[#647168]">Manage the contact information on your account.</p></div>
              <div className="border border-[#dce6de] bg-white p-5">
                {editingProfile ? (
                  <form onSubmit={handleProfileSave} className="grid gap-4 sm:grid-cols-2">
                    {([
                      ['name', 'Full name', 'text'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['address', 'Address', 'text'],
                    ] as const).map(([field, label, type]) => <label key={field} className="text-xs font-semibold text-[#52675a]">{label}<input required={field !== 'address'} type={type} value={profileDraft[field]} onChange={(event) => setProfileDraft({ ...profileDraft, [field]: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] bg-white px-3 py-2.5 text-sm font-normal text-[#17382b] outline-none focus:border-[#398660]" /></label>)}
                    <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Save profile</button><button type="button" onClick={() => setEditingProfile(false)} className="rounded-md border border-[#d4dfd5] px-4 py-2.5 text-xs font-semibold text-[#52675a]">Cancel</button></div>
                  </form>
                ) : (
                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    {[
                      { label: 'Full name', value: profile.name, icon: UserRound },
                      { label: 'Email', value: profile.email, icon: Mail },
                      { label: 'Phone', value: profile.phone, icon: Phone },
                      { label: 'Company', value: profile.company, icon: Building2 },
                      { label: 'Address', value: profile.address || 'Not provided', icon: MapPin },
                      { label: 'Customer since', value: displayDate(profile.customerSince), icon: CalendarDays },
                    ].map((field) => { const Icon = field.icon; return <div key={field.label} className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 text-[#718077]" /><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#88948c]">{field.label}</p><p className="mt-1 text-sm text-[#315446]">{field.value}</p></div></div>; })}
                    <div className="flex flex-wrap gap-2 sm:col-span-2"><button onClick={() => setEditingProfile(true)} className="rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white">Edit profile</button><button onClick={() => setShowPasswordForm(!showPasswordForm)} className="rounded-md border border-[#d4dfd5] px-4 py-2.5 text-xs font-semibold text-[#52675a]">Change password</button></div>
                  </div>
                )}
                {showPasswordForm && <form onSubmit={handlePasswordSave} className="mt-5 grid gap-3 border-t border-[#e7ece7] pt-5 sm:grid-cols-2"><label className="text-xs font-semibold text-[#52675a]">Current password<input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm" /></label><label className="text-xs font-semibold text-[#52675a]">New password<input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm" /></label><button disabled={busy} className="rounded-md bg-[#ed7653] px-4 py-2.5 text-xs font-bold text-white sm:col-span-2">Update password</button></form>}
              </div>
            </section>
          )}

          {activeView === 'customer360' && (
            <section className="space-y-6">
              <div><h1 className="text-xl font-bold text-[#17382b]">My Customer 360</h1><p className="mt-1 text-sm text-[#647168]">Your profile, activity, invoices, product usage, and support in one view.</p></div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Profile</h2><div className="mt-4 space-y-3 text-xs text-[#52675a]"><p>{profile.name} · {profile.company}</p><p>{profile.email} · {profile.phone}</p><p>Customer since {displayDate(profile.customerSince)}</p><p>{profile.address || 'No address saved'}</p><p>Relationship score: <strong className="text-[#27704c]">{data.metrics.relationshipScore}/100</strong></p></div></div>
                <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Engagement</h2><div className="mt-4 space-y-3 text-xs text-[#52675a]"><p>Last login: {displayDate(profile.lastLogin)}</p><p>Product active days: {latestUsage?.active_days || 0}</p><p>Sessions this month: {latestUsage?.sessions || 0}</p><p>Last activity: {activities[0] ? displayDate(activities[0].created_at) : 'No activity yet'}</p></div></div>
                <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Financial</h2><div className="mt-4 grid grid-cols-2 gap-4 text-xs"><p className="text-[#718077]">Total paid<strong className="mt-1 block text-lg text-[#398660]">{money(data.metrics.totalPaid)}</strong></p><p className="text-[#718077]">Outstanding<strong className="mt-1 block text-lg text-[#bd5942]">{money(data.metrics.outstandingAmount)}</strong></p><p className="text-[#718077]">Invoices<strong className="mt-1 block text-lg text-[#17382b]">{data.metrics.invoiceCount}</strong></p></div></div>
                <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Support</h2><div className="mt-4 grid grid-cols-2 gap-4 text-xs"><p className="text-[#718077]">Open tickets<strong className="mt-1 block text-lg text-[#315f89]">{data.metrics.openTickets}</strong></p><p className="text-[#718077]">Resolved tickets<strong className="mt-1 block text-lg text-[#398660]">{data.metrics.resolvedTickets}</strong></p></div></div>
              </div>
              <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Recent interactions</h2><div className="mt-3 divide-y divide-[#edf1ed]">{activities.slice(0, 6).map((activity: any, index: number) => <div key={`${activity.created_at}-${index}`} className="flex justify-between gap-4 py-3 text-xs"><span className="text-[#52675a]">{activity.description}</span><span className="shrink-0 text-[#88948c]">{displayDate(activity.created_at)}</span></div>)}</div></div>
            </section>
          )}

          {activeView === 'invoices' && (
            <section className="space-y-5">
              <div><h1 className="text-xl font-bold text-[#17382b]">My Invoices</h1><p className="mt-1 text-sm text-[#647168]">Invoices and balances for your account only.</p></div>
              <div className="overflow-hidden border border-[#dce6de] bg-white">
                <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#f5f8f5] text-[10px] uppercase tracking-wide text-[#718077]"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#edf1ed]">{invoices.map((invoice: any) => <tr key={invoice.id}><td className="px-4 py-3 font-semibold text-[#315446]">{invoice.invoice_number}</td><td className="px-4 py-3 text-[#647168]">{displayDate(invoice.created_at)}</td><td className="px-4 py-3 font-semibold text-[#17382b]">{money(invoice.amount)}</td><td className="px-4 py-3 text-[#647168]">{displayDate(invoice.due_date)}</td><td className="px-4 py-3"><StatusBadge status={invoice.outstanding_amount > 0 && invoice.due_date < new Date().toISOString().slice(0, 10) ? 'Overdue' : invoice.status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => setInvoicePreview(invoice)} className="rounded px-2 py-1.5 font-semibold text-[#27704c] hover:bg-[#edf4ee]">View</button><button onClick={() => downloadInvoice(invoice)} title="Download invoice" className="rounded p-1.5 text-[#52675a] hover:bg-[#edf4ee]"><Download className="h-3.5 w-3.5" /></button>{invoice.outstanding_amount > 0 && <button onClick={() => handlePayNow(invoice)} className="rounded px-2 py-1.5 font-semibold text-[#bd5942] hover:bg-[#fff1eb]">Pay now</button>}</div></td></tr>)}</tbody></table></div>
                {!invoices.length && <p className="p-8 text-center text-xs text-[#88948c]">No invoices are available for your account.</p>}
              </div>
            </section>
          )}

          {activeView === 'orders' && (
            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-bold text-[#17382b]">My Orders</h1><p className="mt-1 text-sm text-[#647168]">Approved orders and requests awaiting sales review.</p></div><button onClick={openOrderModal} className="inline-flex items-center gap-2 rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#103c2d]"><Plus className="h-4 w-4" /> Place New Order</button></div>
              <div className="overflow-hidden border border-[#dce6de] bg-white">
                <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[#f5f8f5] text-[10px] uppercase tracking-wide text-[#718077]"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Payment</th></tr></thead><tbody className="divide-y divide-[#edf1ed]">{orders.map((order: any) => <tr key={order.id}><td className="px-4 py-3"><span className="font-semibold text-[#315446]">{order.order_number}</span>{order.invoice_number && <span className="mt-1 block text-[10px] text-[#88948c]">{order.invoice_number}</span>}</td><td className="px-4 py-3 text-[#647168]">{displayDate(order.order_date)}</td><td className="px-4 py-3 text-[#647168]">{order.item_count}</td><td className="px-4 py-3 font-semibold text-[#17382b]">{money(order.total)}</td><td className="px-4 py-3"><StatusBadge status={order.status} /></td><td className="px-4 py-3 text-right">{Number(order.outstanding_amount) > 0 && order.invoice_id ? <button onClick={() => handlePayNow(invoices.find((invoice: any) => invoice.id === order.invoice_id))} className="rounded px-2 py-1.5 font-semibold text-[#bd5942] hover:bg-[#fff1eb]">Pay now</button> : <span className="text-[#88948c]">-</span>}</td></tr>)}</tbody></table></div>
                {!orders.length && <p className="p-8 text-center text-xs text-[#88948c]">No orders are available for your account.</p>}
              </div>
              <div className="overflow-hidden border border-[#dce6de] bg-white"><div className="border-b border-[#e7ece7] px-4 py-3"><h2 className="text-sm font-bold text-[#17382b]">Order Requests</h2><p className="mt-1 text-[11px] text-[#718077]">Your sales representative reviews requests before orders and invoices are created.</p></div><div className="divide-y divide-[#edf1ed]">{orderRequests.map((request: any) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"><div><p className="font-semibold text-[#315446]">{request.request_number} <span className="ml-2 font-normal text-[#718077]">{request.item_count} item(s) · {displayDate(request.created_at)}</span></p>{request.resolution_note && <p className="mt-1 text-[11px] text-[#647168]">{request.resolution_note}</p>}{request.invoice_number && <p className="mt-1 text-[11px] font-semibold text-[#27704c]">Invoice {request.invoice_number}</p>}</div><div className="flex items-center gap-3"><span className="font-semibold text-[#17382b]">{money(request.total)}</span><StatusBadge status={request.status} />{request.status === 'Approved' && request.invoice_id && <button onClick={() => handlePayNow(invoices.find((invoice: any) => invoice.id === request.invoice_id))} className="rounded px-2 py-1.5 font-semibold text-[#bd5942] hover:bg-[#fff1eb]">Pay now</button>}</div></div>)}{!orderRequests.length && <p className="p-6 text-center text-xs text-[#88948c]">No order requests yet.</p>}</div></div>
            </section>
          )}

          {activeView === 'payments' && (
            <section className="space-y-6">
              <div><h1 className="text-xl font-bold text-[#17382b]">Payments</h1><p className="mt-1 text-sm text-[#647168]">Submit your payment details and receipt for manager verification.</p></div>
              {selectedInvoice && selectedInvoice.outstanding_amount > 0 && (
                <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="border border-[#dce6de] bg-white p-5">
                    <h2 className="text-sm font-bold text-[#17382b]">Payment</h2>
                    <label className="mt-4 block text-xs font-semibold text-[#52675a]">Invoice<select value={selectedInvoiceId || selectedInvoice.id} onChange={(event) => setSelectedInvoiceId(Number(event.target.value))} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] bg-white px-3 py-2.5 text-sm text-[#17382b]">{outstandingInvoices.map((invoice: any) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {money(invoice.outstanding_amount)}</option>)}</select></label>
                    <div className="mt-4 border-l-2 border-[#ed7653] bg-[#fff8f4] px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9f4f3a]">Amount due</p><p className="mt-1 text-xl font-bold text-[#17382b]">{money(selectedInvoice.outstanding_amount)}</p><p className="mt-1 text-xs text-[#765e55]">Due {displayDate(selectedInvoice.due_date)}</p></div>
                    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Payment method">{(['UPI', 'QR Code'] as PaymentMethod[]).map((method) => <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`rounded-md border px-3 py-2.5 text-xs font-semibold ${paymentMethod === method ? 'border-[#398660] bg-[#edf4ee] text-[#174d3b]' : 'border-[#d4dfd5] text-[#647168]'}`}>{method}</button>)}</div>
                    <div className="mt-5 flex min-h-[210px] flex-col items-center justify-center border border-dashed border-[#cbd8ce] bg-[#f8faf8] p-4 text-center">
                      {paymentQrUrl ? <img src={paymentQrUrl} alt="Insight360 business payment QR code" className="h-44 w-44 object-contain" /> : <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-[#718077]"><CreditCard className="h-8 w-8 text-[#98a29b]" /><p className="text-xs font-semibold">Merchant QR code not configured</p><p className="max-w-xs text-[10px] leading-4">Add the real company QR image at VITE_INSIGHT360_CUSTOMER_PAYMENT_QR. No placeholder QR is used.</p></div>}
                      <p className="mt-2 text-xs font-bold text-[#315446]">Scan &amp; Pay</p><p className="text-[10px] text-[#718077]">Use your UPI or payment application.</p>
                    </div>
                  </div>

                  <form onSubmit={handlePaymentSubmit} className="border border-[#dce6de] bg-white p-5">
                    <h2 className="text-sm font-bold text-[#17382b]">Submit payment for verification</h2><p className="mt-1 text-xs leading-5 text-[#718077]">Payment remains pending until a Sales Manager verifies your receipt.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-[#52675a]">Amount paid<input required type="number" min="0.01" step="0.01" max={selectedInvoice.outstanding_amount} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm font-normal text-[#17382b]" /></label>
                      <label className="text-xs font-semibold text-[#52675a]">Transaction ID / UTR<input required maxLength={100} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm font-normal text-[#17382b]" /></label>
                      <label className="text-xs font-semibold text-[#52675a]">Payment date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm font-normal text-[#17382b]" /></label>
                      <label className="text-xs font-semibold text-[#52675a]">Upload receipt<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-[11px] font-normal text-[#647168] file:mr-2 file:rounded-md file:border-0 file:bg-[#edf4ee] file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-[#315446]" /><span className="mt-1 block text-[10px] text-[#88948c]">PDF, JPG, or PNG · maximum 3 MB</span></label>
                    </div>
                    <button disabled={submittingPayment} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#103c2d] disabled:opacity-50">{submittingPayment ? 'Submitting...' : 'Submit payment'} <ArrowRight className="h-3.5 w-3.5" /></button>
                  </form>
                </div>
              )}
              {!selectedInvoice && <div className="border border-[#cfe2d4] bg-[#f2f8f3] p-4 text-sm text-[#315446]">There are no outstanding invoices to pay right now.</div>}
              <div className="overflow-hidden border border-[#dce6de] bg-white"><div className="border-b border-[#e7ece7] px-4 py-3"><h2 className="text-sm font-bold text-[#17382b]">Payment history</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-[#f5f8f5] text-[10px] uppercase tracking-wide text-[#718077]"><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Method / transaction</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Receipt</th></tr></thead><tbody className="divide-y divide-[#edf1ed]">{payments.map((payment: any) => <tr key={payment.id}><td className="px-4 py-3 font-semibold text-[#315446]">{payment.invoice_number}</td><td className="px-4 py-3 text-[#647168]">{displayDate(payment.payment_date)}</td><td className="px-4 py-3 font-semibold text-[#17382b]">{money(payment.amount)}</td><td className="px-4 py-3 text-[#647168]">{payment.payment_method}<span className="block max-w-40 truncate text-[10px] text-[#88948c]">{payment.transaction_id}</span></td><td className="px-4 py-3"><StatusBadge status={payment.status} />{payment.rejection_reason && <p className="mt-1 max-w-48 text-[10px] text-rose-700">{payment.rejection_reason}</p>}</td><td className="px-4 py-3">{payment.receipt_id ? <button onClick={() => api.openCustomerReceipt(payment.id).catch((err: Error) => error('Could not open receipt', err.message))} className="font-semibold text-[#27704c] hover:underline">View receipt</button> : <span className="text-[#98a29b]">No file</span>}</td></tr>)}</tbody></table></div>{!payments.length && <p className="p-7 text-center text-xs text-[#88948c]">No payment submissions yet.</p>}</div>
            </section>
          )}

          {activeView === 'usage' && (
            <section className="space-y-5">
              <div><h1 className="text-xl font-bold text-[#17382b]">Product Usage</h1><p className="mt-1 text-sm text-[#647168]">Usage information recorded for your workspace.</p></div>
              <div className="grid gap-3 sm:grid-cols-3">{[{ label: 'Active days', value: latestUsage?.active_days || 0 }, { label: 'Sessions', value: latestUsage?.sessions || 0 }, { label: 'Features used', value: latestUsage?.features_used?.length || 0 }].map((item) => <div key={item.label} className="border border-[#dce6de] bg-white p-4"><p className="text-xs text-[#718077]">{item.label}</p><p className="mt-2 text-2xl font-bold text-[#17382b]">{item.value}</p></div>)}</div>
              <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Monthly usage</h2><div className="mt-4 h-72"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf1ed' } } } }} /></div></div>
              <div className="border border-[#dce6de] bg-white p-5"><h2 className="text-sm font-bold text-[#17382b]">Features used</h2><div className="mt-3 flex flex-wrap gap-2">{(latestUsage?.features_used || []).map((feature: string) => <span key={feature} className="border border-[#dce6de] bg-[#f6f9f6] px-3 py-1.5 text-xs text-[#52675a]">{feature}</span>)}{!latestUsage?.features_used?.length && <p className="text-xs text-[#88948c]">No feature activity recorded.</p>}</div></div>
            </section>
          )}

          {activeView === 'timeline' && (
            <section className="max-w-3xl space-y-5"><div><h1 className="text-xl font-bold text-[#17382b]">Activity Timeline</h1><p className="mt-1 text-sm text-[#647168]">A chronological view of your account activity.</p></div><div className="divide-y divide-[#e7ece7] border border-[#dce6de] bg-white px-4">{activities.map((activity: any, index: number) => <div key={`${activity.type}-${activity.created_at}-${index}`} className="flex gap-4 py-4"><div className="flex w-24 shrink-0 flex-col text-[10px] text-[#88948c]"><span>{displayDate(activity.created_at)}</span></div><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#398660]" /><div><p className="text-xs font-semibold text-[#315446]">{activity.type}</p><p className="mt-1 text-xs leading-5 text-[#647168]">{activity.description}</p></div></div>)}{!activities.length && <p className="py-8 text-center text-xs text-[#88948c]">No activity has been recorded.</p>}</div></section>
          )}

          {activeView === 'support' && (
            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-[#17382b]">Support</h1><p className="mt-1 text-sm text-[#647168]">Your support requests and updates.</p></div><button onClick={() => setShowSupportForm(!showSupportForm)} className="rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white">{showSupportForm ? 'Close form' : '+ Create support request'}</button></div>
              {showSupportForm && <form onSubmit={handleSupportSubmit} className="grid gap-3 border border-[#dce6de] bg-white p-5"><label className="text-xs font-semibold text-[#52675a]">Subject<input required maxLength={120} value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm font-normal" /></label><label className="text-xs font-semibold text-[#52675a]">Description<textarea required maxLength={3000} rows={4} value={supportDescription} onChange={(event) => setSupportDescription(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm font-normal" /></label><button disabled={busy} className="justify-self-start rounded-md bg-[#ed7653] px-4 py-2.5 text-xs font-bold text-white">Submit request</button></form>}
              <div className="overflow-x-auto border border-[#dce6de] bg-white"><table className="w-full min-w-[600px] text-left text-xs"><thead className="bg-[#f5f8f5] text-[10px] uppercase tracking-wide text-[#718077]"><tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Last updated</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-[#edf1ed]">{tickets.map((ticket: any) => <tr key={ticket.id}><td className="px-4 py-3 font-semibold text-[#315446]">{ticket.ticket_number}</td><td className="px-4 py-3 text-[#52675a]">{ticket.subject}</td><td className="px-4 py-3 text-[#647168]">{displayDate(ticket.created_at)}</td><td className="px-4 py-3 text-[#647168]">{displayDate(ticket.updated_at)}</td><td className="px-4 py-3"><StatusBadge status={ticket.status} /></td></tr>)}</tbody></table>{!tickets.length && <p className="p-8 text-center text-xs text-[#88948c]">No support requests yet.</p>}</div>
            </section>
          )}

          {activeView === 'notifications' && (
            <section className="max-w-3xl space-y-5"><div><h1 className="text-xl font-bold text-[#17382b]">Notifications</h1><p className="mt-1 text-sm text-[#647168]">Payment, invoice, and support updates for your account.</p></div><div className="divide-y divide-[#e7ece7] border border-[#dce6de] bg-white">{notifications.map((notification: any) => <div key={notification.id} className="flex items-start justify-between gap-4 p-4"><div className="flex gap-3"><Bell className={`mt-0.5 h-4 w-4 shrink-0 ${notification.is_read ? 'text-[#98a29b]' : 'text-[#ed7653]'}`} /><div><p className="text-xs font-bold text-[#315446]">{notification.title}</p><p className="mt-1 text-xs leading-5 text-[#647168]">{notification.message}</p><p className="mt-1 text-[10px] text-[#88948c]">{displayDate(notification.created_at)}</p></div></div>{!notification.is_read && <button onClick={() => markNotificationRead(notification.id)} className="shrink-0 text-[10px] font-semibold text-[#27704c] hover:underline">Mark read</button>}</div>)}{!notifications.length && <p className="p-8 text-center text-xs text-[#88948c]">You have no notifications.</p>}</div></section>
          )}
        </main>
      </div>

      {showOrderModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17382b]/45 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowOrderModal(false); }}><form onSubmit={submitOrderRequest} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden border border-[#dce6de] bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-[#e7ece7] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ba5e43]">Customer order request</p><h2 className="mt-1 text-lg font-bold text-[#17382b]">Browse products &amp; services</h2><p className="mt-1 text-xs text-[#718077]">Your sales representative will confirm terms before an order or invoice is created.</p></div><button type="button" onClick={() => setShowOrderModal(false)} aria-label="Close order request" className="rounded-md p-1.5 text-[#647168] hover:bg-[#f3f7f1]"><X className="h-4 w-4" /></button></div><div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{loadingProducts ? <p className="py-12 text-center text-sm text-[#718077]">Loading active products...</p> : products.length ? <div className="divide-y divide-[#edf1ed] border border-[#e1e8e1]">{products.map((product: any) => <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-[#718077]">{product.category}</p><h3 className="mt-0.5 text-sm font-bold text-[#17382b]">{product.name}</h3>{product.description && <p className="mt-1 text-xs leading-5 text-[#647168]">{product.description}</p>}<p className="mt-1 text-xs font-semibold text-[#27704c]">{money(product.unit_price)} each</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => setProductQuantities({ ...productQuantities, [product.id]: Math.max(0, Number(productQuantities[product.id] || 0) - 1) })} title={`Remove one ${product.name}`} className="rounded-md border border-[#d4dfd5] p-2 text-[#52675a] hover:bg-[#f3f7f1]"><Minus className="h-3.5 w-3.5" /></button><input aria-label={`Quantity for ${product.name}`} type="number" min="0" max="500" step="1" value={productQuantities[product.id] || 0} onChange={(event) => setProductQuantities({ ...productQuantities, [product.id]: Math.max(0, Math.min(500, Math.floor(Number(event.target.value) || 0)) ) })} className="w-14 rounded-md border border-[#cbd8ce] px-2 py-2 text-center text-sm text-[#17382b]" /><button type="button" onClick={() => setProductQuantities({ ...productQuantities, [product.id]: Math.min(500, Number(productQuantities[product.id] || 0) + 1) })} title={`Add one ${product.name}`} className="rounded-md border border-[#d4dfd5] p-2 text-[#27704c] hover:bg-[#edf4ee]"><Plus className="h-3.5 w-3.5" /></button></div></div>)}</div> : <p className="py-12 text-center text-sm text-[#718077]">No active products or services are available.</p>}<label className="block text-xs font-semibold text-[#52675a]">Notes for your sales representative<textarea rows={2} maxLength={500} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} placeholder="Additional seats, preferred terms, or module requirements" className="mt-1.5 w-full rounded-md border border-[#cbd8ce] px-3 py-2.5 text-sm font-normal text-[#17382b]" /></label></div><div className="border-t border-[#e7ece7] bg-[#f8faf8] px-5 py-4"><div className="ml-auto max-w-sm space-y-1.5 text-xs"><p className="flex justify-between text-[#647168]"><span>Subtotal</span><span>{money(orderSubtotal)}</span></p><p className="flex justify-between text-[#647168]"><span>Estimated tax (8%)</span><span>{money(orderTax)}</span></p><p className="flex justify-between border-t border-[#dce6de] pt-2 text-sm font-bold text-[#17382b]"><span>Estimated total</span><span>{money(orderTotal)}</span></p></div><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowOrderModal(false)} className="rounded-md border border-[#d4dfd5] px-4 py-2.5 text-xs font-semibold text-[#52675a]">Cancel</button><button disabled={placingOrder || loadingProducts || !selectedProducts.length} className="inline-flex items-center gap-2 rounded-md bg-[#174d3b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#103c2d] disabled:cursor-not-allowed disabled:opacity-50">{placingOrder ? 'Sending request...' : 'Submit for sales approval'} <ArrowRight className="h-3.5 w-3.5" /></button></div></div></form></div>}

      {invoicePreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17382b]/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setInvoicePreview(null); }}><section className="w-full max-w-md border border-[#dce6de] bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-[#17382b]">Invoice {invoicePreview.invoice_number}</h2><button onClick={() => setInvoicePreview(null)} title="Close invoice" className="rounded p-1 text-[#647168] hover:bg-[#f3f7f1]"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3 text-xs"><p className="flex justify-between"><span className="text-[#718077]">Customer</span><strong>{profile.company}</strong></p><p className="flex justify-between"><span className="text-[#718077]">Invoice date</span><strong>{displayDate(invoicePreview.created_at)}</strong></p><p className="flex justify-between"><span className="text-[#718077]">Due date</span><strong>{displayDate(invoicePreview.due_date)}</strong></p><p className="flex justify-between"><span className="text-[#718077]">Invoice amount</span><strong>{money(invoicePreview.amount)}</strong></p><p className="flex justify-between"><span className="text-[#718077]">Outstanding</span><strong>{money(invoicePreview.outstanding_amount)}</strong></p><p className="flex justify-between"><span className="text-[#718077]">Status</span><StatusBadge status={invoicePreview.status} /></p></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => downloadInvoice(invoicePreview)} className="rounded-md border border-[#d4dfd5] px-3 py-2 text-xs font-semibold text-[#52675a]">Download</button>{invoicePreview.outstanding_amount > 0 && <button onClick={() => { handlePayNow(invoicePreview); setInvoicePreview(null); }} className="rounded-md bg-[#ed7653] px-3 py-2 text-xs font-bold text-white">Pay now</button>}</div></section></div>}
    </div>
  );
};
