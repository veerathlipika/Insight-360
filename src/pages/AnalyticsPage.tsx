import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Clock,
  Package,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { AnalyticsData } from '../types/index.ts';

export const AnalyticsPage: React.FC = () => {
  const { error } = useToast();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalytics(period);
      setData(res);
    } catch (err: any) {
      error('Failed to load analytics', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const kpi = data?.kpi;
  const pipeline = data?.pipelineStages || [];
  const maxPipelineVal = Math.max(...pipeline.map((p) => p.value), 1);

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Revenue &amp; Operational Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deep-dive metrics across the complete customer and sales lifecycle.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs self-start sm:self-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: '3months', label: 'Last 3 Months' },
            { id: 'year', label: 'This Year' },
            { id: 'all', label: 'All Time' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                period === btn.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 text-xs">Computing real-time analytics...</div>
      ) : (
        <>
          {/* Top Row KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Realized Revenue</span>
              <div className="text-2xl font-bold text-emerald-400">
                ${kpi?.totalSales?.toLocaleString() || 0}
              </div>
              <div className="text-[10px] text-slate-500">Across completed client invoices</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Active Pipeline Value</span>
              <div className="text-2xl font-bold text-sky-400">
                ${kpi?.pipelineValue?.toLocaleString() || 0}
              </div>
              <div className="text-[10px] text-slate-500">{kpi?.activeOpportunities} active opportunities</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Lead Conversion Rate</span>
              <div className="text-2xl font-bold text-white">
                {kpi?.conversionRate}%
              </div>
              <div className="text-[10px] text-emerald-400 font-medium">
                {kpi?.convertedLeads} won of {kpi?.totalLeads} prospects
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Retention &amp; CSAT</span>
              <div className="text-2xl font-bold text-indigo-400">
                {kpi?.retentionRate}%
              </div>
              <div className="text-[10px] text-slate-500">
                {data?.retention?.activeCustomers} active accounts
              </div>
            </div>
          </div>

          {/* Middle Row: Pipeline & Lead Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pipeline Distribution */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Pipeline Value by Stage</h3>
                <span className="text-[11px] text-slate-400 font-medium">Stage Concentration</span>
              </div>

              <div className="space-y-3 pt-2">
                {pipeline.map((p) => {
                  const pct = Math.round((p.value / maxPipelineVal) * 100);
                  return (
                    <div key={p.stage} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-200">{p.stage}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{p.count} deals</span>
                          <span className="font-bold text-white">${p.value.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, p.count > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lead Sources Distribution */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">Lead Generation Channels</h3>
                <span className="text-[11px] text-slate-400 font-medium">Acquisition Split</span>
              </div>

              <div className="space-y-3 pt-2">
                {data?.leadSources?.map((src) => {
                  const total = kpi?.totalLeads || 1;
                  const pct = Math.round((src.count / total) * 100);
                  return (
                    <div key={src.source} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-300">{src.source}</span>
                        <span className="font-bold text-white">{src.count} leads ({pct}%)</span>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Row: Products Sold & Sales Rep League Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Rep League */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
                Sales Rep Leaderboard
              </h3>

              <div className="divide-y divide-slate-800/60">
                {data?.salesByRep?.map((rep) => (
                  <div key={rep.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-200">{rep.name}</p>
                      <p className="text-[11px] text-slate-400">{rep.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400 text-sm">${rep.won_value?.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{rep.completed_followups} touchpoints completed</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Performance */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
                Revenue by Product Offering
              </h3>

              <div className="divide-y divide-slate-800/60">
                {data?.productPerf?.map((p) => (
                  <div key={p.name} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-200">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.quantity_sold} units sold</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white text-sm">${p.revenue?.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">{p.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
