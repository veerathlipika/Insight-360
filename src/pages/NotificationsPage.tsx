import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { NotificationItem } from '../types/index.ts';

interface NotificationsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch (err: any) {
      error('Failed to load notifications', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      success('All notifications marked as read');
    } catch (err: any) {
      error('Failed to update notifications');
    }
  };

  const handleItemClick = async (n: NotificationItem) => {
    if (n.is_read === 0) {
      await api.markNotificationRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: 1 } : item))
      );
    }
    if (n.link) {
      onNavigate(n.link.replace('/', ''));
    }
  };

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Notification Center
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            System alerts for upcoming follow-ups, overdue client tasks, opportunity stage changes, and new assignments.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all self-start sm:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Notifications Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-800/60">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">All caught up!</p>
            <p className="text-xs text-slate-500 mt-1">No notifications currently pending.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`p-4 flex items-start justify-between gap-4 hover:bg-slate-800/40 cursor-pointer transition-colors ${
                n.is_read === 0 ? 'bg-indigo-950/20' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {n.is_read === 0 && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                  <span className={`text-xs font-bold ${n.is_read === 0 ? 'text-white' : 'text-slate-300'}`}>
                    {n.title}
                  </span>
                  <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase font-mono">
                    {n.type}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">{n.message}</p>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(n.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              </div>

              {n.link && (
                <button className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
