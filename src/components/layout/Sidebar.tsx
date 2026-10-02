import React from 'react';
import {
  LayoutDashboard,
  Users,
  Target,
  Kanban,
  CalendarCheck,
  FileSpreadsheet,
  ShoppingBag,
  MessageSquare,
  Star,
  LifeBuoy,
  Sparkles,
  BarChart3,
  Bell,
  CreditCard,
  Workflow,
  ClipboardList,
  ClipboardPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, onClose }) => {
  const { user, isManager } = useAuth();

  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'customer-submission', label: 'Customer Submission', icon: ClipboardPlus },
    ...(isManager ? [{ id: 'customer-requests', label: 'Customer Requests', icon: ClipboardList }] : []),
    { id: 'leads', label: 'Leads', icon: Target },
    { id: 'pipeline', label: 'Sales Pipeline', icon: Kanban },
    { id: 'followups', label: 'Follow-ups', icon: CalendarCheck },
    { id: 'quotations', label: 'Quotations', icon: FileSpreadsheet },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'feedback', label: 'Feedback', icon: Star },
    { id: 'support', label: 'Support Tickets', icon: LifeBuoy },
  ];

  const intelligenceNav = [
    { id: 'ai-assistant', label: 'AI Sales Assistant', icon: Sparkles, badge: 'AI' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const handleNavClick = (pageId: string) => {
    onNavigate(pageId);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <img
              src="/insight360-logo.jpg"
              alt="Insight360 Logo"
              className="w-9 h-9 object-contain rounded-lg bg-white p-0.5 shadow-md shadow-indigo-500/20"
            />
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">
                Insight360
              </h1>
              <p className="text-[10px] text-indigo-400 font-medium tracking-wide uppercase mt-0.5">
                Customer Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Sales Operations */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Sales Lifecycle
            </div>
            <nav className="space-y-1">
              {mainNav.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id || (item.id === 'customers' && currentPage === 'customer-360');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {isManager && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Billing
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => handleNavClick('payment-verification')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    currentPage === 'payment-verification'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 shrink-0 ${currentPage === 'payment-verification' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Payment Verification</span>
                </button>
              </nav>
            </div>
          )}

          {/* AI & Insights */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Intelligence
            </div>
            <nav className="space-y-1">
              {intelligenceNav.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-violet-500 to-indigo-500 text-white shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer info: Connected User */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-slate-800/50 border border-slate-800">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="truncate flex-1">
              <p className="text-[11px] font-semibold text-slate-200 truncate">
                {user?.company || 'Enterprise Workspace'}
              </p>
              <p className="text-[9px] text-emerald-400 truncate">
                Database Synced · {user?.role}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
