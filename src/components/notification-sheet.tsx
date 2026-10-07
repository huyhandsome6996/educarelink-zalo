import React, { useState, useEffect } from 'react';
import { NotificationItem } from '@/types';
import { api } from '@/services/api';
import { MOCK_NOTIFICATIONS } from '@/services/mockData';
import { useAuth } from '@/state/auth';
import { IconBell, IconCheckCircle } from './common-icons';

/** Backend trả created_at dạng "27/09/2026 04:20" hoặc ISO — hiển thị an toàn cả hai */
function formatNotifTime(raw: string): string {
  if (!raw) return '';
  // Đã ở dạng dd/mm/yyyy hh:mm -> giữ nguyên
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

interface NotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSheet: React.FC<NotificationSheetProps> = ({ isOpen, onClose }) => {
  const { setUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadNotifications();
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.getNotifications();
      if (Array.isArray(res) && res.length > 0) {
        setNotifications(res);
      } else {
        setNotifications(MOCK_NOTIFICATIONS);
      }
    } catch {
      setNotifications(MOCK_NOTIFICATIONS);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsRead();
    } catch (e) {
      console.warn('Mark read notice:', e);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <IconBell className="w-5 h-5 text-orange-600" />
            <h2 className="text-sm font-bold text-slate-800">Thông báo hệ thống</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-orange-600 font-semibold hover:underline"
            >
              Đọc tất cả
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500 hover:bg-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Đang tải thông báo...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Chưa có thông báo nào</div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  item.is_read
                    ? 'bg-slate-50/60 border-slate-100 text-slate-600'
                    : 'bg-orange-50/40 border-orange-200/60 text-slate-800 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-xs font-bold text-slate-800 leading-snug">{item.title}</h4>
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1"></span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                <span className="text-[10px] text-slate-400 mt-2 block">{formatNotifTime(item.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
