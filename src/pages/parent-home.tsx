import React, { useState, useEffect } from 'react';
import { Task, ServiceCategory } from '@/types';
import { api } from '@/services/api';
import { MOCK_CATEGORIES, MOCK_TASKS, MOCK_TOP_CAREPARTNERS } from '@/services/mockData';
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconSparkles,
  IconMapPin,
  IconClock,
  IconShield,
  IconBook,
  IconBaby,
  IconHeart,
  IconHome,
  IconUtensils,
  IconStar,
  IconCheckCircle,
  IconGraduationCap,
  IconSmartToy,
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
  const [searchTerm, setSearchTerm] = useState('');
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

  const getCategoryIcon = (iconName: string, cls = 'w-5 h-5') => {
    switch (iconName) {
      case 'BookOpen':
        return <IconBook className={cls} />;
      case 'Baby':
        return <IconBaby className={cls} />;
      case 'Heart':
        return <IconHeart className={cls} />;
      case 'Home':
        return <IconHome className={cls} />;
      case 'Restaurant':
        return <IconUtensils className={cls} />;
      case 'SmartToy':
        return <IconSmartToy className={cls} />;
      case 'ShoppingCart':
        return <IconSparkles className={cls} />;
      default:
        return <IconSparkles className={cls} />;
    }
  };

  const getCategoryColor = (iconName: string) => {
    switch (iconName) {
      case 'BookOpen':
        return 'bg-orange-100 text-primary';
      case 'Baby':
        return 'bg-sky-100 text-sky-600';
      case 'Heart':
        return 'bg-rose-100 text-rose-500';
      case 'Home':
        return 'bg-emerald-100 text-emerald-600';
      case 'Restaurant':
        return 'bg-amber-100 text-amber-600';
      case 'SmartToy':
        return 'bg-indigo-100 text-indigo-500';
      default:
        return 'bg-slate-100 text-slate-500';
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesCat = selectedCatId ? t.category === selectedCatId : true;
    const kw = searchTerm.toLowerCase();
    const matchesSearch =
      !kw ||
      t.title.toLowerCase().includes(kw) ||
      (t.description || '').toLowerCase().includes(kw) ||
      (t.location || '').toLowerCase().includes(kw);
    return matchesCat && matchesSearch;
  });

  // 6 danh mục tròn chính theo prototype (Gia sư, Đón trẻ, Trông trẻ, Nấu ăn, Dọn dẹp, AI Assistant)
  const mainCategories: ServiceCategory[] = [
    ...MOCK_CATEGORIES.slice(0, 5),
    MOCK_CATEGORIES.find((c) => c.icon_name === 'SmartToy') || MOCK_CATEGORIES[6],
  ];

  return (
    <div className="space-y-5 pb-24 animate-fade-in">
      {/* Hero Banner: Đăng việc ngay */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-dark p-5 text-white shadow-lg shadow-primary/20">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/10 blur-lg pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-md mb-2">
            <IconShield className="w-3 h-3 mr-1" /> Xác thực CCCD &amp; Giám sát Live
          </div>
          <h2 className="text-xl font-extrabold leading-tight font-display">
            Tìm Carepartner Tin Cậy Cho Bé Yêu
          </h2>
          <p className="text-xs text-white/90 mt-1 max-w-[280px]">
            Kết nối sinh viên sư phạm, y tế đã kiểm duyệt lý lịch. An tâm tuyệt đối với bảo vệ Geofence.
          </p>

          <button
            onClick={onOpenCreateTask}
            className="mt-4 flex items-center px-4 py-2.5 bg-white text-primary hover:bg-orange-50 active:scale-95 text-xs font-extrabold rounded-2xl shadow-md transition-all space-x-1.5"
          >
            <IconPlus className="w-4 h-4" />
            <span>ĐĂNG VIỆC NGAY</span>
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Tìm dịch vụ, Carepartner, khu vực..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all"
          />
          <IconSearch className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
        </div>
        <button
          className={`p-3.5 rounded-2xl border shadow-xs active:scale-95 transition-all ${
            selectedCatId ? 'bg-primary border-primary text-white' : 'bg-white border-slate-200 text-slate-500'
          }`}
          aria-label="Bộ lọc"
        >
          <IconFilter className="w-4 h-4" />
        </button>
      </div>

      {/* Category Icons Grid — 6 vòng tròn lớn theo prototype */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-extrabold text-slate-800 font-display">Dịch vụ phổ biến</h3>
          {selectedCatId && (
            <button
              onClick={() => setSelectedCatId(null)}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Xem tất cả
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {mainCategories.map((cat) => {
            const isSelected = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(isSelected ? null : cat.id)}
                className="flex flex-col items-center justify-center transition-all active:scale-90"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-105'
                      : `${getCategoryColor(cat.icon_name)} border-transparent bg-opacity-100`
                  }`}
                >
                  {getCategoryIcon(cat.icon_name, 'w-5 h-5')}
                </div>
                <span className="text-[10px] font-bold text-slate-600 mt-1.5 text-center leading-tight">
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
          <div className="w-9 h-9 rounded-xl bg-brand-green text-white flex items-center justify-center shadow-xs shrink-0">
            <IconShield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-900 leading-tight">Hạ tầng an toàn 3 lớp</h4>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Định vị GPS thời gian thực • Geofence cảnh báo • Nút SOS khẩn cấp
            </p>
          </div>
        </div>
      </div>

      {/* Posted Tasks Section */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-extrabold text-slate-800 font-display">
            Công việc của bạn ({filteredTasks.length})
          </h3>
          <button onClick={loadMyTasks} className="text-[11px] text-slate-400 hover:text-slate-600">
            Làm mới ↻
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-6 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
            <p className="text-xs text-slate-500">Chưa có công việc nào được đăng</p>
            <button
              onClick={onOpenCreateTask}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-xs"
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
                  ? 'bg-status-infobg text-blue-800'
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
                  className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer animate-fade-in-up"
                  onClick={() => onSelectTask(t)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1.5 leading-snug">{t.title}</h4>
                    </div>
                    <span className="text-base font-extrabold text-primary shrink-0 ml-2">{formattedPrice}</span>
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
                          className="px-3 py-1.5 bg-primary-light hover:bg-primary-soft/40 text-primary font-bold text-[11px] rounded-xl transition-all"
                        >
                          Xem ứng viên
                        </button>
                      )}

                      {t.status === 'in_progress' && (
                        <button
                          onClick={() => onOpenTracking(t)}
                          className="px-3 py-1.5 bg-brand-green hover:bg-emerald-600 text-white font-bold text-[11px] rounded-xl transition-all flex items-center"
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
                          Chấm điểm
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

      {/* Featured Carepartners — Carepartner nổi bật */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-extrabold text-slate-800 font-display">Carepartner nổi bật</h3>
          <span className="text-[11px] font-bold text-primary cursor-pointer hover:underline">Xem thêm</span>
        </div>
        <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {MOCK_TOP_CAREPARTNERS.map((cp) => (
            <div
              key={cp.id}
              className="min-w-[150px] p-3.5 bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md hover:border-orange-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <img
                  src={cp.avatar}
                  alt={cp.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-orange-100"
                />
                <span className="flex items-center text-[11px] font-bold text-amber-500">
                  <IconStar className="w-3 h-3 fill-amber-400 mr-0.5" />
                  {cp.rating.toFixed(1)}
                </span>
              </div>
              <h4 className="text-xs font-extrabold text-slate-800 mt-2 truncate">{cp.name}</h4>
              <p className="flex items-center text-[10px] text-slate-500 mt-0.5">
                <IconGraduationCap className="w-3 h-3 mr-1 text-teal-600 shrink-0" />
                <span className="truncate">{cp.university}</span>
              </p>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold">{cp.jobs} việc đã làm</span>
                <span className="flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  <IconCheckCircle className="w-2.5 h-2.5 mr-0.5" /> Verified
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
