import React from 'react';
import { useAuth } from '@/state/auth';
import {
  IconHome,
  IconBriefcase,
  IconBot,
  IconUser,
  IconCheckCircle,
  IconSearch,
} from './common-icons';

export type NavTab = 'home' | 'tasks' | 'feed' | 'my_jobs' | 'chat' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const { role } = useAuth();

  const tabs =
    role === 'parent'
      ? [
          { id: 'home' as NavTab, label: 'Trang chủ', icon: IconHome },
          { id: 'tasks' as NavTab, label: 'Việc của tôi', icon: IconBriefcase },
          { id: 'chat' as NavTab, label: 'Trợ lý AI', icon: IconBot },
          { id: 'profile' as NavTab, label: 'Tài khoản', icon: IconUser },
        ]
      : [
          { id: 'feed' as NavTab, label: 'Bảng tin việc', icon: IconSearch },
          { id: 'my_jobs' as NavTab, label: 'Việc đã nhận', icon: IconCheckCircle },
          { id: 'chat' as NavTab, label: 'Trợ lý AI', icon: IconBot },
          { id: 'profile' as NavTab, label: 'Tài khoản', icon: IconUser },
        ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 px-2 pt-2 pb-5 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-4 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-orange-600 font-bold'
                  : 'text-slate-400 font-medium hover:text-slate-600'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-orange-50 text-orange-600 -translate-y-0.5' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] mt-0.5 leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
