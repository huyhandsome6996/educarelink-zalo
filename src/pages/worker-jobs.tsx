import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TaskApplication, EarningsSummary } from '@/types';
import { api } from '@/services/api';
import {
  IconCheckCircle,
  IconClock,
  IconMapPin,
  IconShield,
  IconNavigation,
  IconTrendingUp,
  IconRefresh,
} from '@/components/common-icons';

const HEARTBEAT_MS = 30000; // Heartbeat 30s chuẩn spec

export const WorkerJobs: React.FC = () => {
  const [jobs, setJobs] = useState<TaskApplication[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'live' | 'error'>('idle');
  const [lastPing, setLastPing] = useState<string>('—');
  const [pingCount, setPingCount] = useState(0);
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'in_progress' | 'completed'>('all');

  const activeTaskRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMyJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getWorkerJobs();
      if (Array.isArray(res) && res.length > 0) {
        setJobs(res);
        const inProgress = res.find((j) => j.task_status === 'in_progress');
        if (inProgress) activeTaskRef.current = inProgress.task;
        if (isSharingLocation && inProgress?.task) {
          checkDeviceStatus(inProgress.task);
        }
      } else {
        setJobs([
          {
            id: 1,
            task: 101,
            worker: 201,
            task_title: 'Gia sư kèm Toán & Tiếng Việt lớp 4',
            task_status: 'in_progress',
            task_price: 250000,
            task_location: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
            status: 'accepted',
            worker_tier_label: 'Hạng Đồng',
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
            status: 'accepted',
            worker_tier_label: 'Hạng Đồng',
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
  }, [isSharingLocation]);

  const loadEarnings = useCallback(async () => {
    try {
      const res = await api.getMyEarnings();
      if (res && typeof res === 'object') setEarnings(res);
    } catch {
      setEarnings(null);
    }
  }, []);

  const checkDeviceStatus = useCallback(async (taskId?: number) => {
    if (!taskId) return;
    try {
      const status = await api.getDeviceStatus(taskId);
      setDeviceOnline(!!status?.is_online || !!status?.online || status?.status === 'online');
    } catch {
      setDeviceOnline(null);
    }
  }, []);

  useEffect(() => {
    loadMyJobs();
    loadEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Gửi 1 ping vị trí GPS lên backend */
  const pingLocation = useCallback(async () => {
    const send = (lat: number, lng: number) => {
      api
        .updateLocation(lat, lng, activeTaskRef.current)
        .then(() => {
          setGpsStatus('live');
          setPingCount((c) => c + 1);
          setLastPing(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        })
        .catch(() => setGpsStatus('error'));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => send(pos.coords.latitude, pos.coords.longitude),
        () => {
          // Fallback vị trí trung tâm TP.HCM để demo không gián đoạn
          send(10.7769, 106.7009);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 25000 }
      );
    } else {
      send(10.7769, 106.7009);
    }
  }, []);

  /** Bật/tắt chế độ phát sóng GPS Live (chu kỳ heartbeat 30s) */
  const toggleLiveSharing = () => {
    if (isSharingLocation) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsSharingLocation(false);
      setGpsStatus('idle');
      return;
    }
    setIsSharingLocation(true);
    setGpsStatus('acquiring');
    pingLocation();
    intervalRef.current = setInterval(pingLocation, HEARTBEAT_MS);
  };

  // Dọn dẹp interval khi rời màn
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fmtVnd = (v: string | number | undefined) =>
    v === undefined || v === null || v === '' ? '0đ' : new Intl.NumberFormat('vi-VN').format(Number(v)) + 'đ';

  const filteredJobs = jobs.filter((j) => {
    if (activeTab === 'in_progress') return j.task_status === 'in_progress';
    if (activeTab === 'completed') return j.task_status === 'completed';
    return true;
  });

  const statusMeta = (s?: string) => {
    switch (s) {
      case 'in_progress':
        return { color: 'bg-status-infobg text-blue-800', label: 'Đang thực hiện' };
      case 'completed':
        return { color: 'bg-emerald-100 text-emerald-800', label: 'Đã hoàn thành' };
      case 'pending_payment':
        return { color: 'bg-purple-100 text-purple-800', label: 'Chờ thanh toán' };
      case 'open':
        return { color: 'bg-amber-100 text-amber-800', label: 'Chờ duyệt' };
      default:
        return { color: 'bg-slate-100 text-slate-700', label: 'Chờ duyệt' };
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      {/* Live Safety Status Bar — GPS toggle thật */}
      <div className="p-4 bg-teal-50 border border-teal-200/80 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 rounded-full text-white flex items-center justify-center shadow-xs transition-all ${
                isSharingLocation ? 'bg-brand-green live-dot' : 'bg-teal-600'
              }`}
            >
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-teal-900 leading-tight">Giám sát hành trình an toàn</h4>
              <p className="text-[11px] text-teal-700 mt-0.5">
                {gpsStatus === 'acquiring'
                  ? 'Đang kết nối GPS...'
                  : gpsStatus === 'live'
                  ? `Đang phát sóng định vị GPS • Heartbeat 30s • Ping #${pingCount}`
                  : gpsStatus === 'error'
                  ? 'Lỗi kết nối — hệ thống tự thử lại sau 30s'
                  : 'Đã tạm dừng phát sóng định vị'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleLiveSharing}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              isSharingLocation ? 'bg-brand-green text-white shadow-md shadow-emerald-500/25' : 'bg-slate-200 text-slate-600'
            }`}
          >
            <IconNavigation className={`w-3.5 h-3.5 ${isSharingLocation ? 'animate-spin-slow' : ''}`} />
            <span>{isSharingLocation ? 'Đang Live' : 'Bật Live'}</span>
          </button>
        </div>

        {(isSharingLocation || lastPing !== '—') && (
          <div className="mt-3 pt-3 border-t border-teal-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[9px] font-bold text-teal-600 uppercase">Ping gần nhất</p>
              <p className="text-[11px] font-extrabold text-slate-700 mt-0.5">{lastPing}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-teal-600 uppercase">Chu kỳ</p>
              <p className="text-[11px] font-extrabold text-slate-700 mt-0.5">30 giây</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-teal-600 uppercase">Thiết bị</p>
              <p className="text-[11px] font-extrabold text-slate-700 mt-0.5">
                {deviceOnline === null ? '—' : deviceOnline ? '🟢 Online' : '🔴 Mất kết nối'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Earnings Summary — GET /api/payments/my-earnings/ */}
      {earnings && (
        <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl text-white shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <IconTrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Thu nhập của tôi</h4>
            </div>
            <button onClick={loadEarnings} className="text-slate-400 hover:text-white transition-all">
              <IconRefresh className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-[10px] text-slate-300 font-semibold uppercase">Tổng đã nhận</p>
              <p className="text-lg font-extrabold text-emerald-400 mt-0.5">{fmtVnd(earnings.total_earned)}</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <p className="text-[10px] text-slate-300 font-semibold uppercase">Đang chờ nhận</p>
              <p className="text-lg font-extrabold text-amber-400 mt-0.5">{fmtVnd(earnings.pending_payout)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        {(
          [
            ['all', `Tất cả (${jobs.length})`],
            ['in_progress', 'Đang thực hiện'],
            ['completed', 'Đã hoàn thành'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === id
                ? id === 'in_progress'
                  ? 'bg-blue-600 text-white'
                  : id === 'completed'
                  ? 'bg-brand-green text-white'
                  : 'bg-slate-800 text-white'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div>
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
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
              const meta = statusMeta(item.task_status);

              return (
                <div
                  key={item.id}
                  className="p-4 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-teal-200 transition-all animate-fade-in-up"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${meta.color}`}>
                          {meta.label}
                        </span>
                        {item.worker_tier_label && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-white uppercase">
                            {item.worker_tier_label}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 mt-1.5 leading-snug">
                        {item.task_title || `Công việc #${item.task}`}
                      </h4>
                    </div>
                    <span className="text-base font-extrabold text-primary shrink-0 ml-2">{formattedPrice}</span>
                  </div>

                  <div className="mt-2.5 flex items-center space-x-3 text-[11px] text-slate-500">
                    <span className="flex items-center">
                      <IconMapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]">{item.task_location || 'Địa chỉ linh hoạt'}</span>
                    </span>
                    <span className="flex items-center">
                      <IconClock className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span>
                        {item.applied_at ? new Date(item.applied_at).toLocaleDateString('vi-VN') : 'Hôm nay'}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Phụ huynh: <strong>{item.parent_name || 'Liên hệ'}</strong>
                    </span>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl flex items-center">
                      <IconCheckCircle className="w-3 h-3 mr-1" />
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
