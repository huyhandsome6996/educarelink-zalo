import React from 'react';
import { useAuth } from '@/state/auth';
import { IconBell, IconShield } from './common-icons';

interface AppHeaderProps {
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
}

/**
 * AppHeader — gradient cam chủ đạo (#F26522 -> #D4541E),
 * avatar viền cam, chuông thông báo có chấm đỏ. Chuẩn prototype gốc.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenNotifications, onOpenProfile }) => {
  const { currentUser, role, unreadCount } = useAuth();

  const displayName = currentUser
    ? `${currentUser.last_name || ''} ${currentUser.first_name || currentUser.username}`.trim()
    : 'Khách';

  const avatarUrl =
    currentUser?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ffffff&color=F26522&bold=true`;

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-primary to-primary-dark px-4 py-3 shadow-md shadow-primary/20">
      <div className="flex items-center justify-between">
        {/* Left: User Avatar & Info */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onOpenProfile}>
          <div className="relative">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white/80 shadow-sm"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-brand-green border-2 border-white rounded-full" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-white/70">
                {role === 'parent' ? 'Phụ huynh' : 'Carepartner'}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-sm">
                <IconShield className="w-2.5 h-2.5 mr-0.5" /> Đã xác thực
              </span>
            </div>
            <h2 className="text-sm font-extrabold text-white line-clamp-1 leading-tight font-display">
              Xin chào, {displayName}
            </h2>
          </div>
        </div>

        {/* Right: Logo mark + Notification Bell */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-full text-white hover:bg-white/15 active:scale-90 transition-all"
            aria-label="Thông báo"
          >
            <IconBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-rose-500 rounded-full ring-2 ring-primary-dark flex items-center justify-center">
                <span className="text-[9px] font-extrabold text-white leading-none">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
