import React, { useState, useEffect } from 'react';
import {
  Users,
  Target,
  Kanban,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  LifeBuoy,
  Plus,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  ShieldCheck,
  Package,
  Layers,
  Activity,
  ArrowRight,
  Briefcase,
  AlertCircle,
  BarChart2,
  PhoneCall,
  UserCheck,
  HeartPulse,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { AnalyticsData } from '../types/index.ts';

interface DashboardPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, isManager } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // If user is a manager, default to 'manager' view with option to toggle to 'executive' view
  const [viewMode, setViewMode] = useState<'manager' | 'executive'>(
    isManager ? 'manager' : 'executive'
  );

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalytics('all');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Aggregating live CRM metrics & intelligence...</p>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi;
  const pipeline = data?.pipelineStages || [];
  const totalPipelineValue = pipeline.reduce((sum, p) => sum + p.value, 0);
  const exec = data?.executiveMetrics;

  return (
    <div className="space-y-6">
      {/* Top Banner & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {viewMode === 'manager' ? 'Sales Manager Dashboard' : 'Sales Executive Dashboard'}
            </span>
            <span className="text-xs text-slate-400">
              Logged in as <strong className="text-white">{user?.full_name}</strong> ({user?.role})
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {viewMode === 'manager' ? 'Team Performance & Customer Intelligence' : 'My Daily Sales Workspace'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            {viewMode === 'manager'
              ? 'Complete business visibility across sales rep pipelines, customer churn risks, conversion trends, and revenue forecasting.'
              : 'Assigned customer opportunities, upcoming touchpoints, overdue alerts, and recommended next actions for today.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Manager View Switcher (for managers to inspect both overall team and personal focus) */}
          {isManager && (
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('manager')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'manager'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Team View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('executive')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === 'executive'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Work View
              </button>
            </div>
          )}

          <button
            onClick={() => onNavigate('leads')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </button>
          <button
            onClick={() => onNavigate('ai-assistant')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SALES MANAGER DASHBOARD VIEW                                            */}
      {/* ========================================================================= */}
      {viewMode === 'manager' && (
        <div className="space-y-6">
          {/* Section 1: KPI Summary Row (10 key metrics from Section 8) */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {/* Total Customers */}
            <div
              onClick={() => onNavigate('customers')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Total Customers</span>
                <Users className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.totalCustomers || 0}
              </div>
              <div className="mt-1 text-[11px] text-emerald-400 font-medium">
                {data?.retention?.retentionRate}% customer retention
              </div>
            </div>

            {/* Total Leads */}
            <div
              onClick={() => onNavigate('leads')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Total Leads</span>
                <Target className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.totalLeads || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {kpi?.convertedLeads || 0} won ({kpi?.conversionRate}% rate)
              </div>
            </div>

            {/* Active Opportunities & Pipeline Value */}
            <div
              onClick={() => onNavigate('pipeline')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Active Pipeline</span>
                <Kanban className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.activeOpportunities || 0} Deals
              </div>
              <div className="mt-1 text-[11px] text-sky-300 font-medium">
                ${kpi?.pipelineValue?.toLocaleString()} pipeline value
              </div>
            </div>

            {/* Realized Sales Revenue */}
            <div
              onClick={() => onNavigate('orders')}
              className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Realized Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">
                ${kpi?.totalSales?.toLocaleString() || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Avg deal size: ${kpi?.averageDealSize?.toLocaleString()}
              </div>
            </div>

            {/* Conversion Rate */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Conversion Rate</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.conversionRate}%
              </div>
              <div className="mt-1 text-[11px] text-emerald-400 font-medium">
                Lead-to-order ratio
              </div>
            </div>

            {/* Pending Follow-ups */}
            <div
              onClick={() => onNavigate('followups')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Pending Follow-ups</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.pendingFollowups || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Scheduled touchpoints
              </div>
            </div>

            {/* Overdue Follow-ups */}
            <div
              onClick={() => onNavigate('followups')}
              className={`p-4 rounded-xl cursor-pointer border transition-all ${
                (kpi?.overdueFollowups || 0) > 0
                  ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-500'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Overdue Follow-ups</span>
                <AlertTriangle className={`w-4 h-4 ${(kpi?.overdueFollowups || 0) > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.overdueFollowups || 0}
              </div>
              <div className="mt-1 text-[11px] font-semibold">
                {(kpi?.overdueFollowups || 0) > 0 ? (
                  <span className="text-rose-400">Immediate rep action needed</span>
                ) : (
                  <span className="text-emerald-400">Zero missed touches</span>
                )}
              </div>
            </div>

            {/* At-risk Customers */}
            <div
              onClick={() => onNavigate('customers')}
              className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">At-Risk Customers</span>
                <AlertCircle className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-rose-400 tracking-tight">
                {data?.atRiskCustomers?.length || kpi?.atRiskCustomersCount || 0}
              </div>
              <div className="mt-1 text-[11px] text-rose-300">
                Requires retention focus
              </div>
            </div>

            {/* Customer Retention Rate */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Customer Retention</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {data?.retention?.retentionRate}%
              </div>
              <div className="mt-1 text-[11px] text-emerald-400">
                {data?.retention?.activeCustomers} active accounts
              </div>
            </div>

            {/* Follow-up Performance */}
            <div
              onClick={() => onNavigate('followups')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">Follow-up Completion</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {kpi?.followupCompletionRate}%
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Execution performance
              </div>
            </div>
          </div>

          {/* Section 2: Sales Pipeline & Revenue Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Pipeline Visual Distribution */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Sales Pipeline by Stage
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stage distribution and conversion progression (${totalPipelineValue.toLocaleString()} pipeline volume)
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('pipeline')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Kanban Pipeline</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {pipeline.map((item) => {
                  const percentage =
                    totalPipelineValue > 0
                      ? Math.round((item.value / totalPipelineValue) * 100)
                      : 0;

                  let stageColor = 'bg-blue-500';
                  if (item.stage === 'Contacted') stageColor = 'bg-sky-500';
                  if (item.stage === 'Proposal') stageColor = 'bg-amber-500';
                  if (item.stage === 'Negotiation') stageColor = 'bg-indigo-500';
                  if (item.stage === 'Converted') stageColor = 'bg-emerald-500';

                  return (
                    <div key={item.stage} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          {item.stage}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">
                            {item.count} opportunities
                          </span>
                          <span className="font-bold text-white">
                            ${item.value.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${stageColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(percentage, item.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Customer Segmentation */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Customer Segmentation
                  </h3>
                  <span className="text-[11px] text-indigo-400 font-medium">Portfolio Tiers</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {data?.customerSegmentation?.map((seg) => (
                    <div
                      key={seg.segment}
                      className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${seg.color.split(' ')[0].replace('text-', 'bg-')}`} />
                        <span className="font-semibold text-slate-200">{seg.segment}</span>
                      </div>
                      <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-800">
                        {seg.count} accounts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Account Segmentation Model:</span>
                <span className="font-semibold text-slate-200">Behavioral &amp; CLV</span>
              </div>
            </div>
          </div>

          {/* Section 3: Team Performance, Lead Sources & Revenue Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales by Executive / Team Performance */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Sales Team Performance
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live executive workload, active leads, opportunity conversion, and completed follow-ups
                  </p>
                </div>
                <span className="text-xs text-indigo-400 font-medium">Sales Reps</span>
              </div>

              <div className="mt-4 divide-y divide-slate-800/60">
                {data?.salesByRep?.map((rep) => (
                  <div key={rep.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{rep.name}</div>
                      <div className="text-[11px] text-slate-400">{rep.role}</div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <div className="text-slate-300 font-medium">{rep.leads_count} Leads</div>
                        <div className="text-[10px] text-slate-500">{rep.opps_count} Opportunities</div>
                      </div>
                      <div>
                        <div className="text-slate-300 font-medium">{rep.completed_followups} Follow-ups</div>
                        <div className="text-[10px] text-emerald-400 font-semibold">Completed</div>
                      </div>
                      <div className="w-24">
                        <div className="font-bold text-emerald-400">
                          ${rep.won_value?.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">Won Revenue</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead Sources Breakdown */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Lead Sources Breakdown
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Inbound Channels</span>
                </div>

                <div className="mt-4 space-y-3">
                  {data?.leadSources?.map((source) => {
                    const total = kpi?.totalLeads || 1;
                    const pct = Math.round((source.count / total) * 100);
                    return (
                      <div key={source.source} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-400" />
                          <span className="text-slate-300 font-medium">{source.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{source.count} leads</span>
                          <span className="text-[11px] text-slate-400 w-9 text-right">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 bg-slate-950/40 p-3 rounded-xl flex items-center justify-between">
                <div className="text-xs text-slate-400">Highest Converting:</div>
                <div className="text-xs font-bold text-emerald-400">Referrals &amp; Direct</div>
              </div>
            </div>
          </div>

          {/* Customer sentiment and retention planning */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white"><HeartPulse className="h-4 w-4 text-emerald-400" />Customer Sentiment</h3>
                  <p className="mt-1 text-xs text-slate-400">Portfolio-wide view based on each account's average feedback score</p>
                </div>
                <span className="text-[11px] text-slate-500">{data?.customerSentiment?.total || 0} accounts</span>
              </div>
              <div className="mt-4 space-y-4">
                {[
                  { label: 'Positive', count: data?.customerSentiment?.positive || 0, percent: data?.customerSentiment?.positivePercent || 0, color: 'bg-emerald-400', text: 'text-emerald-300' },
                  { label: 'Neutral', count: data?.customerSentiment?.neutral || 0, percent: data?.customerSentiment?.neutralPercent || 0, color: 'bg-amber-300', text: 'text-amber-200' },
                  { label: 'Negative', count: data?.customerSentiment?.negative || 0, percent: data?.customerSentiment?.negativePercent || 0, color: 'bg-rose-400', text: 'text-rose-300' },
                ].map((sentiment) => (
                  <div key={sentiment.label}>
                    <div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{sentiment.label} <span className="text-slate-500">({sentiment.count})</span></span><span className={`font-bold ${sentiment.text}`}>{sentiment.percent}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${sentiment.color}`} style={{ width: `${sentiment.percent}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-rose-900/50 bg-slate-900/90 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white"><AlertCircle className="h-4 w-4 text-rose-400" />Retention Offer Simulation</h3>
                  <p className="mt-1 text-xs text-slate-400">Illustrative planning scenario, not live account totals</p>
                </div>
                <span className="rounded-md border border-amber-800/70 bg-amber-950/40 px-2 py-1 text-[10px] font-semibold text-amber-200">10% offer</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div><p className="text-[11px] text-slate-400">At-risk customers</p><p className="mt-1 text-xl font-bold text-white">1,284</p></div>
                <div><p className="text-[11px] text-slate-400">Revenue at risk</p><p className="mt-1 text-xl font-bold text-rose-300">₹18.4L</p></div>
                <div><p className="text-[11px] text-slate-400">Estimated retained</p><p className="mt-1 text-lg font-bold text-emerald-300">+210 customers</p></div>
                <div><p className="text-[11px] text-slate-400">Recovered / campaign cost</p><p className="mt-1 text-lg font-bold text-white">₹4.2L / ₹1.1L</p></div>
              </div>
              <button onClick={() => onNavigate('customers')} className="mt-4 text-xs font-semibold text-indigo-300 hover:text-indigo-200">Review customer risk list <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button>
            </section>
          </div>

          {/* Section 4: At-Risk Customer Monitoring & Product Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Risk & Retention Alerts Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Customer Churn Risk Monitoring</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Accounts flagged with overdue touches, open support tickets, or churn indicators
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('customers')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-800/60">
                {data?.atRiskCustomers && data.atRiskCustomers.length > 0 ? (
                  data.atRiskCustomers.slice(0, 5).map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => onNavigate('customer-360', { customerId: cust.id })}
                      className="py-3 flex items-center justify-between text-xs hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          <span>{cust.company}</span>
                          <span className="text-[10px] font-normal text-slate-400">({cust.name})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Assigned Rep: <span className="text-slate-300 font-medium">{cust.assigned_name || 'Unassigned'}</span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          {cust.overdue_count > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mr-1.5">
                              {cust.overdue_count} overdue touch
                            </span>
                          )}
                          {cust.open_tickets_count > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {cust.open_tickets_count} ticket open
                            </span>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No active accounts currently flagged at churn risk.
                  </div>
                )}
              </div>
            </div>

            {/* Product & Service Catalog Performance */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Product &amp; Service Performance
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Top enterprise licenses and services generating recognized sales
                  </p>
                </div>
                <Package className="w-4 h-4 text-indigo-400" />
              </div>

              <div className="mt-4 divide-y divide-slate-800/60">
                {data?.productPerf?.map((prod) => (
                  <div key={prod.name} className="py-3 flex items-center justify-between text-xs">
                    <div className="max-w-[200px] sm:max-w-xs">
                      <div className="font-semibold text-slate-200 truncate">{prod.name}</div>
                      <div className="text-[11px] text-slate-400">{prod.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">
                        ${prod.revenue?.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {prod.quantity_sold} sold across {prod.orders_count} orders
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SALES EXECUTIVE DASHBOARD VIEW                                          */}
      {/* ========================================================================= */}
      {viewMode === 'executive' && (
        <div className="space-y-6">
          {/* Executive Assigned KPI Grid (Section 9) */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {/* My Customers */}
            <div
              onClick={() => onNavigate('customers')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">My Customers</span>
                <Users className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {exec?.myCustomersCount || 0}
              </div>
              <div className="mt-1 text-[11px] text-indigo-300">
                Assigned primary accounts
              </div>
            </div>

            {/* My Leads */}
            <div
              onClick={() => onNavigate('leads')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">My Leads</span>
                <Target className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {exec?.myLeadsCount || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Conversion rate: {exec?.myConversionRate}%
              </div>
            </div>

            {/* My Opportunities & Pipeline Value */}
            <div
              onClick={() => onNavigate('pipeline')}
              className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 p-4 rounded-xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">My Pipeline</span>
                <Kanban className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {exec?.myActiveOppsCount || 0} Deals
              </div>
              <div className="mt-1 text-[11px] text-amber-300 font-medium">
                ${exec?.myPipelineValue?.toLocaleString() || 0} active value
              </div>
            </div>

            {/* My Follow-ups & Overdue */}
            <div
              onClick={() => onNavigate('followups')}
              className={`p-4 rounded-xl cursor-pointer border transition-all ${
                (exec?.myOverdueFollowups || 0) > 0
                  ? 'bg-rose-950/20 border-rose-800/60 hover:border-rose-500'
                  : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">My Follow-ups</span>
                <Clock className={`w-4 h-4 ${(exec?.myOverdueFollowups || 0) > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {exec?.myPendingFollowups || 0}
              </div>
              <div className="mt-1 text-[11px] font-semibold">
                {(exec?.myOverdueFollowups || 0) > 0 ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {exec?.myOverdueFollowups} OVERDUE
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> All on schedule
                  </span>
                )}
              </div>
            </div>

            {/* My Realized Revenue */}
            <div
              onClick={() => onNavigate('orders')}
              className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl cursor-pointer transition-all group col-span-2 sm:col-span-1"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">My Won Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">
                ${exec?.myRevenue?.toLocaleString() || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Closed customer sales
              </div>
            </div>
          </div>

          {/* Section 2: Recommended Next Actions & Customer Risk Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommended Next Actions */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span>Recommended Next Actions for Today</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Prioritized tasks and follow-ups to maximize conversion velocity
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {exec?.myNextActions && exec.myNextActions.length > 0 ? (
                  exec.myNextActions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNavigate(item.link)}
                      className="p-3.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.priority === 'Urgent'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : item.priority === 'High'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {item.priority}
                        </span>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed">
                          {item.action}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No urgent next actions pending for today.
                  </div>
                )}
              </div>
            </div>

            {/* My Customer Risk Alerts */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>My Customer Risk Alerts</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Accounts assigned to you that require relationship care
                  </p>
                </div>
                <span className="text-xs text-rose-400 font-medium">Needs Attention</span>
              </div>

              <div className="mt-4 divide-y divide-slate-800/60">
                {exec?.myRiskAlerts && exec.myRiskAlerts.length > 0 ? (
                  exec.myRiskAlerts.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => onNavigate('customer-360', { customerId: cust.id })}
                      className="py-3 flex items-center justify-between text-xs hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">{cust.company}</div>
                        <div className="text-[11px] text-slate-400">Contact: {cust.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {cust.overdue_fups > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {cust.overdue_fups} overdue
                          </span>
                        )}
                        {cust.open_tickets > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {cust.open_tickets} ticket
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    All your assigned customer accounts are healthy.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Recent Customer Activity */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Recent Customer Activity</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest calls, emails, and meetings recorded across your assigned accounts
                </p>
              </div>
              <button
                onClick={() => onNavigate('communications')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                View Timeline
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-800/60">
              {exec?.myRecentActivity && exec.myRecentActivity.length > 0 ? (
                exec.myRecentActivity.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => onNavigate('customer-360', { customerId: act.customer_id })}
                    className="py-3 flex items-center justify-between text-xs hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {act.type}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-100">{act.company}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-sm sm:max-w-md">
                          {act.subject}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      {new Date(act.date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No interactions recorded yet. Log your first call or meeting!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
