import React, { useState, useEffect } from 'react';
import { Task } from '@/types';
import { api } from '@/services/api';
import { MOCK_TASKS } from '@/services/mockData';
import {
  IconPlus,
  IconMapPin,
  IconClock,
  IconShield,
  IconStar,
  IconBriefcase,
  IconCheckCircle,
} from '@/components/common-icons';

interface ParentTasksProps {
  onOpenCreateTask: () => void;
  onSelectTask: (task: Task) => void;
  onOpenCandidates: (task: Task) => void;
  onOpenTracking: (task: Task) => void;
  onOpenReview: (task: Task) => void;
}

export const ParentTasks: React.FC<ParentTasksProps> = ({
  onOpenCreateTask,
  onSelectTask,
  onOpenCandidates,
  onOpenTracking,
  onOpenReview,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.getParentTasks();
      if (Array.isArray(res) && res.length > 0) {
        setTasks(res);
      } else {
        setTasks(MOCK_TASKS);
      }
    } catch {
      setTasks(MOCK_TASKS);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'all') return true;
    return t.status === activeTab;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">Quản Lý Việc Đã Đăng</h2>
          <p className="text-xs text-slate-500">Theo dõi tiến độ, ứng viên và an toàn của bé</p>
        </div>
        <button
          onClick={onOpenCreateTask}
          className="flex items-center px-3.5 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 space-x-1"
        >
          <IconPlus className="w-4 h-4" />
          <span>Đăng việc</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'all'
              ? 'bg-white text-slate-800 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Tất cả ({tasks.length})
        </button>
        <button
          onClick={() => setActiveTab('open')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'open'
              ? 'bg-white text-amber-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Tìm người
        </button>
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'in_progress'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Đang làm
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Hoàn thành
        </button>
      </div>

      {/* Task List */}
      <div>
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang tải dữ liệu...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
            Không có công việc nào trong danh mục này.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((t) => {
              const formattedPrice =
                new Intl.NumberFormat('vi-VN').format(Number(t.price || 0)) + 'đ';

              const statusColor =
                t.status === 'open'
                  ? 'bg-amber-100 text-amber-800'
                  : t.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : t.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700';

              const statusLabel =
                t.status === 'open'
                  ? 'Đang tìm người'
                  : t.status === 'in_progress'
                  ? 'Đang thực hiện'
                  : t.status === 'completed'
                  ? 'Đã hoàn thành'
                  : 'Đã hủy';

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:border-orange-200 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800 mt-1.5 leading-snug">
                        {t.title}
                      </h3>
                    </div>
                    <span className="text-base font-black text-orange-600 shrink-0 ml-2">
                      {formattedPrice}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center space-x-3 text-[11px] text-slate-500">
                    <span className="flex items-center">
                      <IconMapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{t.location}</span>
                    </span>
                    <span className="flex items-center">
                      <IconClock className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span>
                        {t.scheduled_time
                          ? new Date(t.scheduled_time).toLocaleDateString('vi-VN')
                          : 'Hôm nay'}
                      </span>
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div
                    className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-slate-400">
                      Vùng an toàn: {t.geofence_radius || 500}m
                    </span>

                    <div className="flex items-center space-x-1.5">
                      {t.status === 'open' && (
                        <button
                          onClick={() => onOpenCandidates(t)}
                          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-[11px] rounded-xl transition-all"
                        >
                          Duyệt ứng viên
                        </button>
                      )}

                      {t.status === 'in_progress' && (
                        <button
                          onClick={() => onOpenTracking(t)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition-all flex items-center space-x-1"
                        >
                          <IconShield className="w-3.5 h-3.5" />
                          <span>Giám sát Live</span>
                        </button>
                      )}

                      {t.status === 'completed' && !t.is_reviewed && (
                        <button
                          onClick={() => onOpenReview(t)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-xl transition-all flex items-center space-x-1"
                        >
                          <IconStar className="w-3.5 h-3.5 fill-white" />
                          <span>Đánh giá</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
