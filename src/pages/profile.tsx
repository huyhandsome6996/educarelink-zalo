import React, { useState } from 'react';
import { useAuth } from '@/state/auth';
import { api, DEFAULT_API_BASE, LOCAL_API_BASE } from '@/services/api';
import {
  IconUser,
  IconShield,
  IconCheckCircle,
  IconSparkles,
} from '@/components/common-icons';

export const ProfilePage: React.FC = () => {
  const {
    currentUser,
    role,
    switchRole,
    backendUrl,
    changeBackendUrl,
    loginWithDemo,
    logout,
  } = useAuth();

  const [customUrl, setCustomUrl] = useState(backendUrl);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    setHealthStatus('Đang kiểm tra kết nối...');
    try {
      const res = await api.checkHealth();
      setHealthStatus(`✅ Kết nối thành công! Server: ${res.status || 'OK'}`);
    } catch (err: any) {
      setHealthStatus(`❌ Không thể kết nối: ${err.message}`);
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

  return (
    <div className="space-y-4 pb-24">
      {/* Profile Card */}
      <div className="p-5 bg-white rounded-3xl border border-slate-100 shadow-2xs">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <img
              src={
                currentUser?.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=F26522&color=fff&size=128`
              }
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover ring-4 ring-orange-100 shadow-sm"
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-800">
                {role === 'parent' ? 'Phụ huynh' : 'Carepartner'}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
                <IconShield className="w-3 h-3 mr-0.5" /> CCCD Verified
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-800 mt-1">{displayName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              @{currentUser?.username || 'user'} • {currentUser?.phone_number || '0901234567'}
            </p>
          </div>
        </div>

        {/* Role Toggle Button */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-semibold">Chế độ trải nghiệm:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => switchRole('parent')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                role === 'parent'
                  ? 'bg-white text-orange-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Phụ huynh
            </button>
            <button
              onClick={() => switchRole('worker')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                role === 'worker'
                  ? 'bg-white text-teal-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Carepartner
            </button>
          </div>
        </div>
      </div>

      {/* Fast Demo Accounts Login (for Examiners / Judges) */}
      <div className="p-4 bg-orange-50/70 border border-orange-200/80 rounded-3xl space-y-3">
        <div className="flex items-center space-x-2">
          <IconSparkles className="w-4 h-4 text-orange-600" />
          <h3 className="text-xs font-bold text-orange-900 uppercase tracking-wider">
            Tài khoản kiểm thử nhanh (Demo Accounts)
          </h3>
        </div>
        <p className="text-[11px] text-orange-800/90 leading-relaxed">
          Đăng nhập trực tiếp vào hệ thống cơ sở dữ liệu thật với mật khẩu mẫu <code>Demo@2026</code>:
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => loginWithDemo('parent')}
            className="p-2.5 bg-white hover:bg-orange-100/50 text-orange-700 font-bold text-xs rounded-xl border border-orange-200 shadow-2xs active:scale-95 transition-all text-left"
          >
            <div className="text-[10px] text-orange-500 font-medium">Vai trò Phụ huynh</div>
            <div className="font-extrabold truncate">phuhuynh_test</div>
          </button>

          <button
            onClick={() => loginWithDemo('worker')}
            className="p-2.5 bg-white hover:bg-teal-100/50 text-teal-700 font-bold text-xs rounded-xl border border-teal-200 shadow-2xs active:scale-95 transition-all text-left"
          >
            <div className="text-[10px] text-teal-500 font-medium">Vai trò Carepartner</div>
            <div className="font-extrabold truncate">sinhvien_test</div>
          </button>
        </div>
      </div>

      {/* Backend API Configuration */}
      <div className="p-4 bg-white rounded-3xl border border-slate-100 space-y-3 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Cấu hình Hạ tầng & Backend API
        </h3>
        <p className="text-[11px] text-slate-500">
          EduCareLink kết nối API REST từ repository <code>huyhandsome6996/educarelink-backend-4-12-2026</code>.
        </p>

        {/* Quick URL Presets */}
        <div className="flex space-x-2">
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
            ☁️ Cloud Render
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
            💻 Localhost:8000
          </button>
        </div>

        {/* Input & Save */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:bg-white focus:outline-none"
          />
          <button
            onClick={handleSaveUrl}
            className="px-3.5 py-2 bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Lưu
          </button>
        </div>

        {/* Health Check */}
        <div className="pt-1">
          <button
            onClick={handleCheckHealth}
            disabled={isCheckingHealth}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
          >
            {isCheckingHealth ? 'Đang gửi ping...' : 'Kiểm tra kết nối Server (Ping Health)'}
          </button>
          {healthStatus && (
            <p className="text-[11px] font-semibold mt-2 text-center text-slate-600">
              {healthStatus}
            </p>
          )}
        </div>
      </div>

      {/* Logout button */}
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
