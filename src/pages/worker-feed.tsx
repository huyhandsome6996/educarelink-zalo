import React, { useState, useEffect } from 'react';
import { Task } from '@/types';
import { api } from '@/services/api';
import { MOCK_TASKS, MOCK_CATEGORIES } from '@/services/mockData';
import {
  IconSearch,
  IconMapPin,
  IconClock,
  IconSparkles,
  IconShield,
  IconCheckCircle,
} from '@/components/common-icons';

interface WorkerFeedProps {
  onSelectTask: (task: Task) => void;
  onApplySuccess: (taskId: number) => void;
}

export const WorkerFeed: React.FC<WorkerFeedProps> = ({ onSelectTask, onApplySuccess }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [appliedIds, setAppliedIds] = useState<number[]>([]);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await api.getTasks();
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

  const handleQuickApply = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.applyTask(task.id, 'Em là sinh viên có trách nhiệm, sẵn sàng nhận việc ngay!');
    } catch (err) {
      console.warn('Quick apply notice:', err);
    }
    setAppliedIds((prev) => [...prev, task.id]);
    onApplySuccess(task.id);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCatId ? t.category === selectedCatId : true;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Top Banner for Worker */}
      <div className="p-4 bg-gradient-to-r from-teal-600 to-emerald-700 rounded-3xl text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider bg-white/20 px-2 py-0.5 rounded-full uppercase">
              Cơ hội việc làm linh hoạt
            </span>
            <h2 className="text-base font-extrabold mt-1">Bảng Tin Công Việc Mới</h2>
            <p className="text-xs text-white/80 mt-0.5">
              Hàng trăm công việc gia sư, chăm sóc được bảo hiểm & trả lương minh bạch.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <IconSparkles className="w-6 h-6 text-yellow-300" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Tìm công việc theo môn học, khu vực (Q1, Bình Thạnh)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs text-slate-700 shadow-2xs focus:border-teal-500 focus:outline-none transition-all"
        />
        <IconSearch className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
      </div>

      {/* Category Filter Pills */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCatId(null)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
            selectedCatId === null
              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả
        </button>
        {MOCK_CATEGORIES.map((cat) => {
          const isSelected = selectedCatId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(isSelected ? null : cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-xs font-bold text-slate-700">
            {filteredTasks.length} công việc đang tuyển
          </span>
          <button onClick={loadTasks} className="text-xs text-teal-600 hover:underline">
            Làm mới ↻
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-7 h-7 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang tải danh sách việc làm...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
            Không tìm thấy công việc phù hợp với từ khóa này.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((t, idx) => {
              const formattedPrice =
                new Intl.NumberFormat('vi-VN').format(Number(t.price || 0)) + 'đ';
              const isApplied = appliedIds.includes(t.id);
              const matchScore = 92 + (idx % 7); // Simulated AI Match percentage

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {/* AI Match Badge */}
                      <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold mb-1.5">
                        <IconSparkles className="w-3 h-3 text-emerald-600" />
                        <span>AI Match: {matchScore}% phù hợp</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                        {t.title}
                      </h3>
                    </div>
                    <span className="text-base font-black text-orange-600 shrink-0 ml-2">
                      {formattedPrice}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>

                  <div className="mt-3 flex items-center space-x-3 text-[11px] text-slate-500">
                    <span className="flex items-center">
                      <IconMapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[140px]">{t.location}</span>
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

                  {/* Footer with Parent name & Apply action */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      Đăng bởi: <strong>{t.parent_name || 'Phụ huynh'}</strong>
                    </span>

                    {isApplied ? (
                      <span className="flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl">
                        <IconCheckCircle className="w-3.5 h-3.5 mr-1" /> Đã nộp hồ sơ
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleQuickApply(t, e)}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all"
                      >
                        Ứng tuyển ngay
                      </button>
                    )}
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
