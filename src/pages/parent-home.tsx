import React, { useState, useEffect } from 'react';
import { Task, ServiceCategory } from '@/types';
import { api } from '@/services/api';
import { MOCK_CATEGORIES, MOCK_TASKS } from '@/services/mockData';
import {
  IconPlus,
  IconSparkles,
  IconMapPin,
  IconClock,
  IconShield,
  IconBook,
  IconBaby,
  IconHeart,
  IconHome,
  IconStar,
  IconCheckCircle,
} from '@/components/common-icons';

interface ParentHomeProps {
  onOpenCreateTask: () => void;
  onSelectTask: (task: Task) => void;
  onOpenCandidates: (task: Task) => void;
  onOpenTracking: (task: Task) => void;
  onOpenReview: (task: Task) => void;
}

export const ParentHome: React.FC<ParentHomeProps> = ({
  onOpenCreateTask,
  onSelectTask,
  onOpenCandidates,
  onOpenTracking,
  onOpenReview,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  useEffect(() => {
    loadMyTasks();
  }, []);

  const loadMyTasks = async () => {
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

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'BookOpen':
        return <IconBook className="w-5 h-5 text-orange-500" />;
      case 'Baby':
        return <IconBaby className="w-5 h-5 text-sky-500" />;
      case 'Heart':
        return <IconHeart className="w-5 h-5 text-rose-500" />;
      case 'Home':
        return <IconHome className="w-5 h-5 text-emerald-500" />;
      default:
        return <IconSparkles className="w-5 h-5 text-amber-500" />;
    }
  };

  const filteredTasks = selectedCatId
    ? tasks.filter((t) => t.category === selectedCatId)
    : tasks;

  return (
    <div className="space-y-5 pb-24">
      {/* Hero Banner: Đăng việc ngay */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-5 text-white shadow-lg shadow-orange-500/20">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-md mb-2">
            <IconShield className="w-3 h-3 mr-1" /> Xác thực CCCD & Giám sát Live
          </div>
          <h2 className="text-xl font-black leading-tight">
            Tìm Carepartner Tin Cậy Cho Bé Yêu
          </h2>
          <p className="text-xs text-white/90 mt-1 max-w-[280px]">
            Kết nối sinh viên sư phạm, y tế đã kiểm duyệt lý lịch. An tâm tuyệt đối với bảo vệ Geofence.
          </p>

          <button
            onClick={onOpenCreateTask}
            className="mt-4 flex items-center px-4 py-2.5 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 text-xs font-black rounded-2xl shadow-md transition-all space-x-1.5"
          >
            <IconPlus className="w-4 h-4" />
            <span>ĐĂNG CÔNG VIỆC MỚI</span>
          </button>
        </div>
      </div>

      {/* Category Icons Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-extrabold text-slate-800">Dịch vụ phổ biến</h3>
          {selectedCatId && (
            <button
              onClick={() => setSelectedCatId(null)}
              className="text-[11px] font-bold text-orange-600 hover:underline"
            >
              Xem tất cả
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {MOCK_CATEGORIES.slice(0, 8).map((cat) => {
            const isSelected = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(isSelected ? null : cat.id)}
                className={`p-2.5 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 border ${
                  isSelected
                    ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                    : 'bg-white hover:bg-slate-50 border-slate-100 shadow-2xs text-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-xl mb-1 ${
                    isSelected ? 'bg-white/20' : 'bg-slate-50'
                  }`}
                >
                  {getCategoryIcon(cat.icon_name)}
                </div>
                <span className="text-[11px] font-bold text-center leading-tight truncate w-full">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Safety Highlight Banner */}
      <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <IconShield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-900 leading-tight">
              Hạ tầng an toàn 3 lớp
            </h4>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Định vị GPS thời gian thực • Geofence cảnh báo • Nút SOS khẩn cấp
            </p>
          </div>
        </div>
      </div>

      {/* Posted Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-extrabold text-slate-800">
            Công việc của bạn ({filteredTasks.length})
          </h3>
          <button onClick={loadMyTasks} className="text-[11px] text-slate-400 hover:text-slate-600">
            Làm mới ↻
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang tải dữ liệu công việc...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
            <p className="text-xs text-slate-500">Chưa có công việc nào được đăng</p>
            <button
              onClick={onOpenCreateTask}
              className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              Đăng việc ngay
            </button>
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
                  className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:shadow-sm hover:border-orange-200 transition-all cursor-pointer"
                  onClick={() => onSelectTask(t)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1.5 leading-snug">
                        {t.title}
                      </h4>
                    </div>
                    <span className="text-base font-black text-orange-600 shrink-0 ml-2">
                      {formattedPrice}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center space-x-3 text-[11px] text-slate-500">
                    <span className="flex items-center">
                      <IconMapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      <span className="truncate max-w-[150px]">{t.location}</span>
                    </span>
                    <span className="flex items-center">
                      <IconClock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      <span>
                        {t.scheduled_time
                          ? new Date(t.scheduled_time).toLocaleDateString('vi-VN')
                          : 'Hôm nay'}
                      </span>
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] text-slate-400">
                      Vùng an toàn: {t.geofence_radius || 500}m
                    </span>

                    <div className="flex items-center space-x-1.5">
                      {t.status === 'open' && (
                        <button
                          onClick={() => onOpenCandidates(t)}
                          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold text-[11px] rounded-xl transition-all"
                        >
                          Xem ứng viên
                        </button>
                      )}

                      {t.status === 'in_progress' && (
                        <button
                          onClick={() => onOpenTracking(t)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition-all flex items-center"
                        >
                          <IconShield className="w-3 h-3 mr-1" />
                          Giám sát Live
                        </button>
                      )}

                      {t.status === 'completed' && !t.is_reviewed && (
                        <button
                          onClick={() => onOpenReview(t)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-xl transition-all flex items-center"
                        >
                          <IconStar className="w-3 h-3 mr-1 fill-white" />
                          Đánh giá
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
