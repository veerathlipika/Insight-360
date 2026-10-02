import React, { useState, useEffect } from 'react';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Sparkles,
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  MessageSquare,
  LifeBuoy,
  Star,
  Plus,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  X,
  Send,
  Kanban,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { CustomerSummaryResult } from '../types/index.ts';

interface Customer360PageProps {
  customerId: number;
  onNavigate: (page: string, params?: any) => void;
}

export const Customer360Page: React.FC<Customer360PageProps> = ({ customerId, onNavigate }) => {
  const { success, error } = useToast();
  const { isManager } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<CustomerSummaryResult | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'timeline' | 'opportunities' | 'followups' | 'quotations' | 'orders' | 'support'>('timeline');

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    type: 'Call',
    subject: '',
    content: '',
  });

  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [fupForm, setFupForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    type: 'Call',
    priority: 'Medium',
    notes: '',
  });

  const loadCustomer360 = async () => {
    try {
      setLoading(true);
      const res = await api.getCustomerById(customerId);
      setData(res);
    } catch (err: any) {
      error('Failed to load customer profile', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer360();
  }, [customerId]);

  const handleGenerateAiSummary = async () => {
    try {
      setIsGeneratingAi(true);
      const res = await api.getCustomerAiSummary(customerId);
      setAiSummary(res);
      success('AI Customer 360 Summary generated!');
    } catch (err: any) {
      error('AI Summary failed', err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.subject.trim() || !logForm.content.trim()) {
      error('Subject and notes are required.');
      return;
    }

    try {
      await api.logCommunication({
        customer_id: customerId,
        type: logForm.type,
        subject: logForm.subject,
        content: logForm.content,
      });
      success('Interaction logged to timeline');
      setShowLogModal(false);
      setLogForm({ type: 'Call', subject: '', content: '' });
      loadCustomer360();
    } catch (err: any) {
      error('Failed to log interaction', err.message);
    }
  };

  const handleScheduleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fupForm.notes.trim()) {
      error('Notes are required.');
      return;
    }

    try {
      await api.createFollowup({
        customer_id: customerId,
        date: fupForm.date,
        time: fupForm.time,
        type: fupForm.type,
        priority: fupForm.priority,
        notes: fupForm.notes,
      });
      success('Follow-up scheduled');
      setShowFollowupModal(false);
      setFupForm({
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        type: 'Call',
        priority: 'Medium',
        notes: '',
      });
      loadCustomer360();
    } catch (err: any) {
      error('Failed to schedule follow-up', err.message);
    }
  };

  const handleCompleteFollowup = async (fupId: number) => {
    try {
      await api.completeFollowup(fupId, 'Completed via Customer 360 profile');
      success('Follow-up marked completed and logged to timeline');
      loadCustomer360();
    } catch (err: any) {
      error('Failed to complete follow-up', err.message);
    }
  };

  const handleSendPaymentReminder = async () => {
    try {
      const result = await api.sendCustomerDueReminder(customerId);
      success(result.emailDeliveryConfigured
        ? `Payment reminder sent by email and in-app notification (${result.emailsSent} email(s)).`
        : 'Payment reminder sent in-app. Configure SMTP to deliver customer emails.');
    } catch (err: any) {
      error('Could not send payment reminder', err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Customer not found.</p>
        <button
          onClick={() => onNavigate('customers')}
          className="mt-3 text-xs text-indigo-400 hover:underline"
        >
          ← Back to Customers
        </button>
      </div>
    );
  }

  const {
    customer,
    salesInfo,
    intelligence = {},
    opportunities = [],
    followups = [],
    quotations = [],
    orders = [],
    communications = [],
    supportTickets = [],
    feedback = [],
  } = data;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('customers')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSendPaymentReminder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send payment reminder email</span>
          </button>
          <button
            onClick={() => setShowFollowupModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Schedule Follow-up</span>
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Interaction</span>
          </button>
        </div>
      </div>

      {/* Customer 360 Profile Hero Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                {customer.customer_code}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  customer.status === 'VIP'
                    ? 'bg-amber-950/40 text-amber-300 border-amber-800'
                    : customer.status === 'Active'
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {customer.status} Account
              </span>
              <span className="text-xs text-slate-400">
                Industry: <strong className="text-slate-200">{customer.industry || 'General'}</strong>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              {customer.company}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-500">Contact:</span>
                <strong>{customer.name}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <a href={`mailto:${customer.email}`} className="text-indigo-400 hover:underline">
                  {customer.email}
                </a>
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{customer.phone || 'N/A'}</span>
              </span>
              {customer.address && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{customer.address}</span>
                </span>
              )}
            </div>
          </div>

          {/* Assigned Executive Box */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-[220px]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Assigned Account Executive
            </p>
            <p className="text-sm font-bold text-white mt-0.5">
              {customer.assigned_name || 'Unassigned'}
            </p>
            <p className="text-[11px] text-slate-400">
              {customer.assigned_email || 'Contact manager to assign'}
            </p>
          </div>
        </div>
      </div>

      {/* Customer 360 AI Intelligence & Health Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                AI Customer Intelligence &amp; Risk Prediction
              </h3>
              <p className="text-[11px] text-slate-400">
                Automated customer health, churn probability, lifecycle value, and sentiment metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Segment:</span>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
              {intelligence.segment || 'Active'}
            </span>
          </div>
        </div>

        {/* 4 Core Intelligence Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Health Score */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 font-medium block mb-1">Account Health Score</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${
                (intelligence.healthScore || 80) >= 75 ? 'text-emerald-400' : (intelligence.healthScore || 80) >= 50 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {intelligence.healthScore || 80}/100
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  (intelligence.healthScore || 80) >= 75 ? 'bg-emerald-500' : (intelligence.healthScore || 80) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${intelligence.healthScore || 80}%` }}
              />
            </div>
          </div>

          {/* Churn Risk */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 font-medium block mb-1">Churn / Retention Risk</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                intelligence.churnRisk === 'High' ? 'bg-rose-500 animate-pulse' : intelligence.churnRisk === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <span className={`text-base font-bold ${
                intelligence.churnRisk === 'High' ? 'text-rose-400' : intelligence.churnRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {intelligence.churnRisk || 'Low'} Risk
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 truncate">
              {intelligence.churnFactors && intelligence.churnFactors.length > 0
                ? `${intelligence.churnFactors.length} risk factor(s) flagged`
                : 'Account engagement healthy'}
            </p>
          </div>

          {/* Customer Lifetime Value */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 font-medium block mb-1">Estimated Lifetime Value (CLV)</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              ${Number(intelligence.estimatedCLV || salesInfo?.totalRevenue || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Historical spend + weighted pipeline
            </p>
          </div>

          {/* Sentiment Analysis */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 font-medium block mb-1">Feedback Sentiment</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-base font-bold ${
                intelligence.sentiment === 'Positive' ? 'text-emerald-400' : intelligence.sentiment === 'Negative' ? 'text-rose-400' : 'text-slate-300'
              }`}>
                {intelligence.sentiment || 'Neutral'}
              </span>
              {intelligence.averageRating > 0 && (
                <span className="text-amber-400 text-xs font-semibold flex items-center">
                  ★ {intelligence.averageRating}/5
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Based on customer feedback surveys
            </p>
          </div>
        </div>

        {/* Churn Factors explanation if any */}
        {intelligence.churnFactors && intelligence.churnFactors.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300">
            <span className="font-semibold text-rose-200">Risk Explanation: </span>
            <span>{intelligence.churnFactors.join(' · ')}</span>
          </div>
        )}

        {/* Next Best Action Banner */}
        {intelligence.nextBestAction && (
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-indigo-200">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Recommended Next Best Action: </span>
              <span>{intelligence.nextBestAction}</span>
            </div>
          </div>
        )}

        {/* Important Customer Alerts */}
        {intelligence.importantAlerts && intelligence.importantAlerts.length > 0 && (
          <div className="space-y-1.5">
            {intelligence.importantAlerts.map((alt: any, idx: number) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                  alt.type === 'danger'
                    ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                    : alt.type === 'warning'
                    ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{alt.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Summary Section */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl relative">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                Customer 360° AI Summary &amp; Recommendations
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Gemini Flash 3.8
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Synthesis of background, interactions, pipeline health, and prioritized next actions
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateAiSummary}
            disabled={isGeneratingAi}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {isGeneratingAi ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing Profile...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiSummary ? 'Regenerate AI Summary' : 'Generate AI Summary'}</span>
              </>
            )}
          </button>
        </div>

        {aiSummary ? (
          <div className="mt-4 space-y-4 text-xs">
            {/* Executive synthesis */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-indigo-500/30 text-slate-200 leading-relaxed">
              <span className="font-semibold text-indigo-300">Executive Brief: </span>
              {aiSummary.summary}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Requirements & Purchase */}
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-300">Purchase &amp; Opportunity Trajectory</div>
                <p className="text-slate-400 leading-relaxed">{aiSummary.purchaseHistory}</p>
                <div className="pt-2 text-indigo-300 font-medium">
                  {aiSummary.activeOpportunities}
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Recommended Next Actions
                </div>
                <ul className="space-y-1.5">
                  {aiSummary.recommendedNextActions.map((action, i) => (
                    <li key={i} className="text-slate-300 flex items-start gap-1.5">
                      <span className="text-indigo-400 font-bold shrink-0">→</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-xs text-slate-400">
              Click <strong>"Generate AI Summary"</strong> to synthesize this customer's orders, open opportunities, support tickets, and recent interaction notes into an actionable briefing.
            </p>
          </div>
        )}
      </div>

      {/* Sales Stats KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Total Orders</span>
          <div className="text-xl font-bold text-white mt-1">{salesInfo?.totalOrders || 0}</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Total Revenue</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            ${salesInfo?.totalRevenue?.toLocaleString() || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Average Order</span>
          <div className="text-xl font-bold text-white mt-1">
            ${Math.round(salesInfo?.averageOrderValue || 0).toLocaleString()}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Active Opportunities</span>
          <div className="text-xl font-bold text-sky-400 mt-1">
            {salesInfo?.activeOpportunitiesCount || 0}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-slate-400 font-medium">Last Purchase</span>
          <div className="text-sm font-semibold text-slate-300 mt-1">
            {salesInfo?.lastPurchase ? new Date(salesInfo.lastPurchase).toLocaleDateString() : 'None'}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto text-xs pb-1">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'timeline'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Timeline ({communications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('opportunities')}
          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'opportunities'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" />
          <span>Opportunities ({opportunities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('followups')}
          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'followups'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Follow-ups ({followups.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('quotations')}
          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'quotations'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Quotations ({quotations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'support'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <LifeBuoy className="w-3.5 h-3.5" />
          <span>Support &amp; Feedback ({supportTickets.length + feedback.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        {/* TAB 1: Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Chronological Interaction History</h4>
              <button
                onClick={() => setShowLogModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                + Log New Activity
              </button>
            </div>

            {communications.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No recorded interactions yet. Click "+ Log New Activity" to record a call or meeting.
              </div>
            ) : (
              <div className="relative border-l border-slate-800 ml-3 space-y-6 pt-2">
                {communications.map((c: any) => (
                  <div key={c.id} className="relative pl-6 text-xs">
                    <div className="absolute -left-2 top-0.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500" />
                    <div className="flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800">
                          {c.type}
                        </span>
                        <span className="font-bold text-slate-200">{c.subject}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(c.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                      {c.content}
                    </p>
                    {c.user_name && (
                      <p className="text-[10px] text-slate-500 mt-1">Logged by {c.user_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Opportunities */}
        {activeTab === 'opportunities' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Sales Opportunities &amp; Pipeline</h4>
              <button
                onClick={() => onNavigate('pipeline')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Open Kanban Pipeline →
              </button>
            </div>

            {opportunities.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No active opportunities open for this customer.
              </div>
            ) : (
              <div className="space-y-2.5">
                {opportunities.map((opp: any) => (
                  <div
                    key={opp.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{opp.title}</span>
                        <span className="text-[10px] font-mono text-slate-500">{opp.opp_code}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{opp.notes}</p>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="font-bold text-white text-sm">${opp.value?.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">{opp.probability}% win prob</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-semibold">
                        {opp.stage}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Follow-ups */}
        {activeTab === 'followups' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Follow-up Tasks</h4>
              <button
                onClick={() => setShowFollowupModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                + Schedule Follow-up
              </button>
            </div>

            {followups.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No follow-ups recorded.</div>
            ) : (
              <div className="space-y-2">
                {followups.map((f: any) => (
                  <div
                    key={f.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                            f.status === 'Overdue'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : f.status === 'Completed'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          }`}
                        >
                          {f.status}
                        </span>
                        <span className="font-bold text-slate-200">
                          {f.type} on {f.date} at {f.time}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1">{f.notes}</p>
                    </div>

                    {f.status !== 'Completed' && (
                      <button
                        onClick={() => handleCompleteFollowup(f.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-700 font-medium text-xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Done</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Quotations */}
        {activeTab === 'quotations' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Quotations &amp; Proposals</h4>
              <button
                onClick={() => onNavigate('quotations')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Quotation Manager →
              </button>
            </div>

            {quotations.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No quotations generated yet.</div>
            ) : (
              <div className="space-y-2">
                {quotations.map((q: any) => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span>{q.quotation_number}</span>
                        <span className="text-[10px] text-slate-400">Valid until {q.valid_until}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{q.terms}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-white">${q.total?.toLocaleString()}</div>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">{q.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">Purchase Orders</h4>
              <button
                onClick={() => onNavigate('orders')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Order Manager →
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No orders recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {orders.map((o: any) => (
                  <div
                    key={o.id}
                    className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span>{o.order_number}</span>
                        <span className="text-[10px] text-slate-400">Date: {o.order_date}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{o.notes}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">${o.total?.toLocaleString()}</div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Support Tickets & Feedback */}
        {activeTab === 'support' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-white mb-2">Support Tickets</h4>
              {supportTickets.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No open or historical support tickets.</p>
              ) : (
                <div className="space-y-2">
                  {supportTickets.map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{t.ticket_number}</span>
                          <span className="font-semibold text-slate-200">{t.subject}</span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5">{t.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-2">Customer Feedback</h4>
              {feedback.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No recorded feedback.</p>
              ) : (
                <div className="space-y-2">
                  {feedback.map((fb: any) => (
                    <div
                      key={fb.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-amber-400">
                          {'★'.repeat(fb.rating)}
                          <span className="text-slate-400 ml-1 font-medium">{fb.category}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(fb.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-300 italic">"{fb.comments}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Log Interaction Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Log Activity with {customer.company}</h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveLog} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Interaction Type</label>
                <select
                  value={logForm.type}
                  onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="Call">Phone Call</option>
                  <option value="Email">Email Sent / Received</option>
                  <option value="Meeting">Executive Meeting</option>
                  <option value="Message">Direct Message</option>
                  <option value="Note">Internal Sales Note</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Subject / Topic *</label>
                <input
                  type="text"
                  required
                  value={logForm.subject}
                  onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })}
                  placeholder="e.g. Contract review with Legal"
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Content / Details *</label>
                <textarea
                  rows={3}
                  required
                  value={logForm.content}
                  onChange={(e) => setLogForm({ ...logForm, content: e.target.value })}
                  placeholder="Summary of discussion, agreement points, objections..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
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
                  Log to Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {showFollowupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Schedule Follow-up Task</h3>
              <button onClick={() => setShowFollowupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleScheduleFollowup} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Date *</label>
                  <input
                    type="date"
                    required
                    value={fupForm.date}
                    onChange={(e) => setFupForm({ ...fupForm, date: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Time *</label>
                  <input
                    type="time"
                    required
                    value={fupForm.time}
                    onChange={(e) => setFupForm({ ...fupForm, time: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Action Type</label>
                  <select
                    value={fupForm.type}
                    onChange={(e) => setFupForm({ ...fupForm, type: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Note">Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Priority</label>
                  <select
                    value={fupForm.priority}
                    onChange={(e) => setFupForm({ ...fupForm, priority: e.target.value as any })}
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
                <label className="block text-slate-300 mb-1 font-medium">Objective / Notes *</label>
                <textarea
                  rows={3}
                  required
                  value={fupForm.notes}
                  onChange={(e) => setFupForm({ ...fupForm, notes: e.target.value })}
                  placeholder="Task goal, topics to cover, document links..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFollowupModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
