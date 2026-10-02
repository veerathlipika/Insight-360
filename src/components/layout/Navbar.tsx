import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  CheckCheck,
  LogOut,
  User as UserIcon,
  Shield,
  Briefcase,
  Layers,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  Settings,
  Users,
  Lock,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { api } from '../../services/api.ts';
import { NotificationItem } from '../../types/index.ts';
import { UserProfileModal } from '../modals/UserProfileModal.tsx';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate: (page: string, params?: any) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigate }) => {
  const { user, logout, isManager } = useAuth();
  const { success, error } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      // Ignore background notification fetch error
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.search(searchQuery.trim());
        setSearchResults(res);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotificationMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
      success('All notifications marked as read');
    } catch (e) {
      error('Failed to mark notifications read');
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger button + Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search */}
        <div ref={searchRef} className="relative w-full">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customers, leads, deals, orders, quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults) setShowSearchDropdown(true);
              }}
              className="w-full bg-slate-800/80 text-sm pl-9 pr-8 py-2 rounded-lg border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder-slate-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {showSearchDropdown && searchResults && (
            <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-800/80 z-50">
              {/* Customers */}
              {searchResults.customers?.length > 0 && (
                <div className="p-2">
                  <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2 py-1">
                    Customers
                  </div>
                  {searchResults.customers.map((c: any) => (
                    <button
                      key={`c-${c.id}`}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        onNavigate('customer-360', { customerId: c.id });
                      }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-sm group transition-colors"
                    >
                      <div>
                        <span className="font-medium text-slate-200 group-hover:text-indigo-400">
                          {c.company}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">({c.name})</span>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {c.code}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Leads */}
              {searchResults.leads?.length > 0 && (
                <div className="p-2">
                  <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2 py-1">
                    Leads
                  </div>
                  {searchResults.leads.map((l: any) => (
                    <button
                      key={`l-${l.id}`}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        onNavigate('leads');
                      }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-sm group transition-colors"
                    >
                      <div>
                        <span className="font-medium text-slate-200 group-hover:text-indigo-400">
                          {l.name}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">· {l.company}</span>
                      </div>
                      <span className="text-xs text-emerald-400 font-semibold">
                        ${l.estimated_value?.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Opportunities */}
              {searchResults.opportunities?.length > 0 && (
                <div className="p-2">
                  <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2 py-1">
                    Opportunities
                  </div>
                  {searchResults.opportunities.map((o: any) => (
                    <button
                      key={`o-${o.id}`}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        onNavigate('pipeline');
                      }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-sm group transition-colors"
                    >
                      <div>
                        <span className="font-medium text-slate-200 group-hover:text-indigo-400">
                          {o.title}
                        </span>
                        <span className="text-xs text-slate-400 ml-2">({o.company})</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-medium">
                        {o.stage}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Orders & Quotes */}
              {(searchResults.orders?.length > 0 || searchResults.quotations?.length > 0) && (
                <div className="p-2">
                  <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2 py-1">
                    Orders & Quotations
                  </div>
                  {searchResults.orders?.map((ord: any) => (
                    <button
                      key={`ord-${ord.id}`}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        onNavigate('orders');
                      }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-sm group transition-colors"
                    >
                      <span className="text-slate-200 group-hover:text-indigo-400">
                        {ord.code} · {ord.company}
                      </span>
                      <span className="text-xs text-emerald-400 font-semibold">${ord.total?.toLocaleString()}</span>
                    </button>
                  ))}
                  {searchResults.quotations?.map((q: any) => (
                    <button
                      key={`q-${q.id}`}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        onNavigate('quotations');
                      }}
                      className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-sm group transition-colors"
                    >
                      <span className="text-slate-200 group-hover:text-indigo-400">
                        {q.code} · {q.company}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">${q.total?.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}

              {Object.values(searchResults).every((arr: any) => arr?.length === 0) && (
                <div className="p-6 text-center text-slate-400 text-sm">
                  No records matching "{searchQuery}" found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Notifications, Role Switcher, Profile */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notifications Popover */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotificationMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
              <div className="p-3 bg-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.link) {
                          setShowNotificationMenu(false);
                          onNavigate(n.link.replace('/', ''));
                        }
                      }}
                      className={`p-3 text-left hover:bg-slate-800/80 cursor-pointer transition-colors ${
                        n.is_read === 0 ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold ${n.is_read === 0 ? 'text-indigo-300' : 'text-slate-200'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 bg-slate-900 text-center">
                <button
                  onClick={() => {
                    setShowNotificationMenu(false);
                    onNavigate('notifications');
                  }}
                  className="text-xs text-slate-400 hover:text-indigo-400 font-medium py-1"
                >
                  View all in Notification Center →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Demo Role Switcher */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-lg hover:bg-slate-800/80 border border-slate-700/60 transition-colors"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.full_name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-indigo-500"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {user?.full_name?.split(' ')[0]}
              </div>
              <div className="text-[10px] text-indigo-400 font-medium leading-none">
                {user?.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
              <div className="p-3.5 bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-100">{user?.full_name}</p>
                  <span className="text-[10px] font-mono text-slate-400">USR-{String(user?.id || 1).padStart(4, '0')}</span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-950/80 border border-indigo-700/60 text-[11px] font-semibold text-indigo-300">
                  <Lock className="w-3 h-3 text-indigo-400" />
                  <span>Role: {user?.role}</span>
                  <span className="text-[9px] text-slate-400 ml-auto font-normal">Fixed RBAC</span>
                </div>
              </div>

              {/* Account Profile & Team Links */}
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowProfileModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium text-left"
                >
                  <Settings className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div className="leading-tight">Account Profile &amp; Settings</div>
                    <div className="text-[10px] text-slate-400 font-normal">Manage name, phone &amp; credentials</div>
                  </div>
                </button>
              </div>

              {/* RBAC Security Policy Notice */}
              <div className="px-3.5 py-2.5 bg-slate-950/50 text-[10px] text-slate-400 border-t border-slate-800/80 leading-relaxed">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-0.5">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  Role-Based Workspace
                </div>
                <span>Secured by JWT authentication. Configured for Sales Manager and Sales Executive roles.</span>
              </div>

              <div className="p-2 bg-slate-900">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out of account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </header>
  );
};
