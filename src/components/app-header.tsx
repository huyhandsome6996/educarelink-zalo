import React from 'react';
import { useAuth } from '@/state/auth';
import { IconBell, IconShield } from './common-icons';

interface AppHeaderProps {
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenNotifications, onOpenProfile }) => {
  const { currentUser, role, switchRole, unreadCount } = useAuth();

  const displayName = currentUser
    ? `${currentUser.last_name || ''} ${currentUser.first_name || currentUser.username}`.trim()
    : 'Khách';

  const avatarUrl =
    currentUser?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=F26522&color=fff&bold=true`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-xs">
      <div className="flex items-center justify-between">
        {/* Left: User Avatar & Info */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onOpenProfile}>
          <div className="relative">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-100 shadow-sm"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                {role === 'parent' ? 'Phụ huynh' : 'Carepartner'}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                <IconShield className="w-2.5 h-2.5 mr-0.5" /> Đã xác thực
              </span>
            </div>
            <h2 className="text-sm font-bold text-slate-800 line-clamp-1 leading-tight">
              {displayName}
            </h2>
          </div>
        </div>

        {/* Right: Quick Role Switcher & Notification Bell */}
        <div className="flex items-center space-x-2">
          {/* Quick toggle role button */}
          <button
            onClick={() => switchRole(role === 'parent' ? 'worker' : 'parent')}
            title="Bấm để đổi vai trò thử nghiệm"
            className="flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 active:scale-95 transition-all shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5 animate-pulse"></span>
            {role === 'parent' ? 'Sang Carepartner' : 'Sang Phụ huynh'}
          </button>

          {/* Notification Button */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 active:scale-90 transition-all"
            aria-label="Thông báo"
          >
            <IconBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
