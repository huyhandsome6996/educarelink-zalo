import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/state/auth';
import { api, DEFAULT_API_BASE, LOCAL_API_BASE, RENDER_API_BASE } from '@/services/api';
import { EarningsSummary } from '@/types';
import {
  IconUser,
  IconShield,
  IconCheckCircle,
  IconSparkles,
  IconStar,
  IconGraduationCap,
  IconTrendingUp,
  IconBriefcase,
} from '@/components/common-icons';

export const ProfilePage: React.FC = () => {
  const { currentUser, role, switchRole, backendUrl, changeBackendUrl, loginWithDemo, logout } = useAuth();

  const [customUrl, setCustomUrl] = useState(backendUrl);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [jobsDone, setJobsDone] = useState(0);
  const [avgRating, setAvgRating] = useState(4.9);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
    if (role === 'worker') {
      try {
        const jobs = await api.getWorkerJobs();
        if (Array.isArray(jobs)) {
          const done = jobs.filter((j) => j.task_status === 'completed').length;
          setJobsDone(done);
          const ratings = jobs.map((j) => j.worker_rating).filter((r): r is number => typeof r === 'number');
          if (ratings.length > 0) {
            setAvgRating(Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)));
          }
        }
      } catch {
        /* giữ giá trị mặc định */
      }
      try {
        const e = await api.getMyEarnings();
        if (e && typeof e === 'object') setEarnings(e);
      } catch {
        setEarnings(null);
      }
    }
  }, [role]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    setHealthStatus('Đang kiểm tra kết nối...');
    try {
      const res = await api.checkHealth();
      setHealthStatus(`Kết nối thành công! Server: ${res.status || 'OK'}`);
    } catch (err: any) {
      setHealthStatus(`Không thể kết nối: ${err.message}`);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleSaveUrl = () => {
    changeBackendUrl(customUrl);
    setHealthStatus('Đã lưu cấu hình địa chỉ API!');
  };

  const displayName = currentUser
    ? `${currentUser.last_name || ''} ${currentUser.first_name || currentUser.username}`.trim()
    : 'Người dùng EduCareLink';

  const fmtVnd = (v: string | number | undefined) =>
    v === undefined || v === null || v === '' ? '0đ' : new Intl.NumberFormat('vi-VN').format(Number(v)) + 'đ';

  const isWorker = role === 'worker';

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      {/* ===== Worker Profile Hero — vòng tròn profile ring ===== */}
      <div className="relative overflow-hidden p-5 pb-6 bg-gradient-to-br from-primary via-primary to-primary-dark rounded-3xl text-white shadow-lg shadow-primary/20">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-col items-center">
          {/* Profile Ring */}
          <div className="relative">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#FFCFB3"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - Math.min(avgRating / 5, 1))}`}
              />
            </svg>
            <img
              src={
                profile?.avatar_url ||
                currentUser?.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=F26522&color=fff&size=128&bold=true`
              }
              alt="Avatar"
              className="absolute inset-0 m-auto w-[76px] h-[76px] rounded-full object-cover border-4 border-white/90"
            />
            <span className="absolute bottom-0 right-0 w-5 h-5 bg-brand-green border-[3px] border-white rounded-full" />
          </div>

          <h2 className="mt-3 text-base font-extrabold font-display">{displayName}</h2>
          <p className="text-[11px] text-white/80 mt-0.5">
            @{currentUser?.username || 'user'} • {profile?.phone_number || currentUser?.phone_number || 'Chưa cập nhật SĐT'}
          </p>
          <div className="flex items-center space-x-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/20 backdrop-blur-sm">
              {isWorker ? 'Carepartner' : 'Phụ huynh'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-primary flex items-center">
              <IconShield className="w-3 h-3 mr-0.5" /> {profile?.is_verified ? 'CCCD Verified' : 'Chưa xác thực'}
            </span>
          </div>

          {/* Stats: số việc đã làm, đánh giá trung bình */}
          <div className="w-full grid grid-cols-3 gap-2 mt-4">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm text-center">
              <p className="text-base font-extrabold">{isWorker ? jobsDone : '—'}</p>
              <p className="text-[10px] text-white/80 font-semibold">Việc đã làm</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm text-center">
              <p className="text-base font-extrabold flex items-center justify-center">
                {avgRating.toFixed(1)}
                <IconStar className="w-3.5 h-3.5 fill-amber-300 text-amber-300 ml-0.5" />
              </p>
              <p className="text-[10px] text-white/80 font-semibold">Đánh giá TB</p>
            </div>
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm text-center">
              <p className="text-base font-extrabold">{earnings ? fmtVnd(earnings.total_earned) : '—'}</p>
              <p className="text-[10px] text-white/80 font-semibold">Thu nhập</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Worker: Thu nhập chi tiết ===== */}
      {isWorker && earnings && (
        <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <IconTrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Ví thu nhập EduCareLink</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase">Đã nhận</p>
              <p className="text-lg font-extrabold text-emerald-700">{fmtVnd(earnings.total_earned)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
              <p className="text-[10px] font-bold text-amber-600 uppercase">Đang chờ</p>
              <p className="text-lg font-extrabold text-amber-700">{fmtVnd(earnings.pending_payout)}</p>
            </div>
          </div>
          {earnings.recent_payments && earnings.recent_payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Giao dịch gần đây</p>
              {earnings.recent_payments.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate">{p.task_title || `Công việc #${p.task}`}</p>
                    <p className="text-[10px] text-slate-400">{p.parent_name || 'Phụ huynh'} • {p.method || 'escrow'}</p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-600 shrink-0 ml-2">{fmtVnd(p.worker_payout_amount || p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Chứng chỉ & giấy tờ đã xác thực ===== */}
      <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-xs space-y-2.5">
        <div className="flex items-center space-x-2">
          <IconGraduationCap className="w-4 h-4 text-teal-600" />
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Chứng chỉ &amp; Giấy tờ</h3>
        </div>
        {[
          { label: 'CCCD/Hộ chiếu (2 mặt)', ok: !!profile?.id_card_front && !!profile?.id_card_back },
          { label: 'Ảnh chân dung xác thực', ok: !!profile?.selfie_photo },
          { label: 'Bằng cấp / Chứng chỉ', ok: !!profile?.certificate_photo },
          { label: 'Tài khoản đã được duyệt', ok: !!profile?.is_approved || currentUser?.is_approved },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-700">{item.label}</span>
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center ${
                item.ok ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-100'
              }`}
            >
              <IconCheckCircle className="w-3 h-3 mr-1" />
              {item.ok ? 'Đã xác thực' : 'Chưa nộp'}
            </span>
          </div>
        ))}
      </div>

      {/* ===== Role toggle ===== */}
      <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
        <span className="text-xs text-slate-600 font-bold">Chế độ trải nghiệm:</span>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => switchRole('parent')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              role === 'parent' ? 'bg-white text-primary shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Phụ huynh
          </button>
          <button
            onClick={() => switchRole('worker')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              role === 'worker' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Carepartner
          </button>
        </div>
      </div>

      {/* ===== Tài khoản demo nhanh ===== */}
      <div className="p-4 bg-primary-light/70 border border-orange-200/80 rounded-3xl space-y-3">
        <div className="flex items-center space-x-2">
          <IconSparkles className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-extrabold text-orange-900 uppercase tracking-wider">
            Tài khoản kiểm thử nhanh (Demo)
          </h3>
        </div>
        <p className="text-[11px] text-orange-800/90 leading-relaxed">
          Đăng nhập trực tiếp vào cơ sở dữ liệu thật với mật khẩu mẫu <code className="font-bold">Demo@2026</code>:
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => loginWithDemo('parent')}
            className="p-2.5 bg-white hover:bg-orange-100/50 text-primary font-bold text-xs rounded-xl border border-orange-200 shadow-xs active:scale-95 transition-all text-left"
          >
            <div className="text-[10px] text-orange-400 font-medium">Vai trò Phụ huynh</div>
            <div className="font-extrabold truncate">phuhuynh_test</div>
          </button>
          <button
            onClick={() => loginWithDemo('worker')}
            className="p-2.5 bg-white hover:bg-teal-100/50 text-teal-700 font-bold text-xs rounded-xl border border-teal-200 shadow-xs active:scale-95 transition-all text-left"
          >
            <div className="text-[10px] text-teal-500 font-medium">Vai trò Carepartner</div>
            <div className="font-extrabold truncate">sinhvien_test</div>
          </button>
        </div>
      </div>

      {/* ===== Backend API Config (hỗ trợ QA) ===== */}
      <div className="p-4 bg-white rounded-3xl border border-slate-100 space-y-3 shadow-xs">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Cấu hình Hạ tầng &amp; Backend API</h3>
        <p className="text-[11px] text-slate-500">
          EduCareLink kết nối API REST từ repository <code>huyhandsome6996/educarelink-backend</code> trên Render.
        </p>

        <div className="flex space-x-2">
          <button
            onClick={() => {
              setCustomUrl(RENDER_API_BASE);
              changeBackendUrl(RENDER_API_BASE);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              backendUrl === RENDER_API_BASE
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            Cloud Render
          </button>
          <button
            onClick={() => {
              setCustomUrl(DEFAULT_API_BASE);
              changeBackendUrl(DEFAULT_API_BASE);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              backendUrl === DEFAULT_API_BASE
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            Mặc định (Proxy)
          </button>
          <button
            onClick={() => {
              setCustomUrl(LOCAL_API_BASE);
              changeBackendUrl(LOCAL_API_BASE);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              backendUrl === LOCAL_API_BASE
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            Localhost:8000
          </button>
        </div>

        <div className="flex space-x-2">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:bg-white focus:outline-none"
          />
          <button onClick={handleSaveUrl} className="px-3.5 py-2 bg-primary text-white font-bold text-xs rounded-xl shadow-xs">
            Lưu
          </button>
        </div>

        <div className="pt-1">
          <button
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
          >
            {isCheckingHealth ? 'Đang gửi ping...' : 'Kiểm tra kết nối Server (Ping Health)'}
          </button>
          {healthStatus && <p className="text-[11px] font-semibold mt-2 text-center text-slate-600">{healthStatus}</p>}
        </div>
      </div>

      {/* ===== Logout ===== */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full py-3 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-bold text-xs rounded-2xl transition-all"
        >
          Đăng xuất tài khoản
        </button>
      </div>
    </div>
  );
};
