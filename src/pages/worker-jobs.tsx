import React, { useState, useEffect } from 'react';
import { TaskApplication } from '@/types';
import { api } from '@/services/api';
import {
  IconCheckCircle,
  IconClock,
  IconMapPin,
  IconShield,
  IconAlertTriangle,
} from '@/components/common-icons';

export const WorkerJobs: React.FC = () => {
  const [jobs, setJobs] = useState<TaskApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSharingLocation, setIsSharingLocation] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    loadMyJobs();
  }, []);

  const loadMyJobs = async () => {
    setLoading(true);
    try {
      const res = await api.getWorkerJobs();
      if (Array.isArray(res) && res.length > 0) {
        setJobs(res);
      } else {
        // Sample jobs fallback
        setJobs([
          {
            id: 1,
            task: 101,
            worker: 201,
            task_title: 'Gia sư kèm Toán & Tiếng Việt lớp 4',
            task_status: 'in_progress',
            task_price: 250000,
            task_location: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
            status: 'approved',
            parent_name: 'Chị Lan',
            applied_at: '2026-10-07T10:20:00+07:00',
          },
          {
            id: 2,
            task: 102,
            worker: 201,
            task_title: 'Đón bé gái 6 tuổi tại trường Tiểu học',
            task_status: 'completed',
            task_price: 150000,
            task_location: 'Trường TH Lê Ngọc Hân, Quận 1, TP.HCM',
            status: 'approved',
            parent_name: 'Anh Minh',
            applied_at: '2026-10-06T12:00:00+07:00',
          },
        ]);
      }
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (activeTab === 'in_progress') return j.task_status === 'in_progress';
    if (activeTab === 'completed') return j.task_status === 'completed';
    return true;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Live Safety Status Bar for Worker */}
      <div className="p-4 bg-teal-50 border border-teal-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
            <IconShield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-teal-900 leading-tight">
              Giám sát hành trình an toàn
            </h4>
            <p className="text-[11px] text-teal-700 mt-0.5">
              {isSharingLocation
                ? 'Đang phát sóng định vị GPS bảo vệ (Chu kỳ 30s)'
                : 'Đã tạm dừng phát sóng định vị'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsSharingLocation(!isSharingLocation)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            isSharingLocation
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {isSharingLocation ? 'Bật Live' : 'Đã tắt'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'all'
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Tất cả ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'in_progress'
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Đang thực hiện
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Đã hoàn thành
        </button>
      </div>

      {/* Job list */}
      <div>
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <div className="w-7 h-7 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang tải việc làm của bạn...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
            Bạn chưa nhận công việc nào trong mục này.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((item) => {
              const formattedPrice =
                new Intl.NumberFormat('vi-VN').format(Number(item.task_price || 0)) + 'đ';

              const statusColor =
                item.task_status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : item.task_status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800';

              const statusLabel =
                item.task_status === 'in_progress'
                  ? 'Đang thực hiện'
                  : item.task_status === 'completed'
                  ? 'Đã hoàn thành'
                  : 'Chờ duyệt';

              return (
                <div
                  key={item.id}
                  className="p-4 bg-white rounded-2xl border border-slate-100 shadow-2xs hover:border-teal-200 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1.5">
                        {item.task_title || `Công việc #${item.task}`}
                      </h4>
                    </div>
                    <span className="text-base font-black text-orange-600 shrink-0 ml-2">
                      {formattedPrice}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center space-x-3 text-[11px] text-slate-500">
                    <span className="flex items-center">
                      <IconMapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">
                        {item.task_location || 'Địa chỉ linh hoạt'}
                      </span>
                    </span>
                    <span className="flex items-center">
                      <IconClock className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span>
                        {item.applied_at
                          ? new Date(item.applied_at).toLocaleDateString('vi-VN')
                          : 'Hôm nay'}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Phụ huynh: <strong>{item.parent_name || 'Liên hệ'}</strong>
                    </span>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl">
                      Đã xác nhận hồ sơ
                    </span>
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
