import React, { useState } from 'react';
import { useAuth } from '@/state/auth';
import { api } from '@/services/api';
import { IconShield, IconSparkles, IconUser, IconCheckCircle } from '@/components/common-icons';

export const WelcomeAuth: React.FC = () => {
  const { loginWithDemo, login, isLoading } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('phuhuynh_test');
  const [password, setPassword] = useState('Demo@2026');
  const [regRole, setRegRole] = useState<'parent' | 'worker'>('parent');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    const saved = localStorage.getItem('educarelink_api_url');
    if (saved && saved.includes('onrender.com')) {
      localStorage.removeItem('educarelink_api_url');
    }
  }, []);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(username, password);
    if (!res.success) {
      setErrorMsg(res.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.register({
        username: regUsername,
        password: regPassword,
        first_name: regName,
        phone_number: regPhone,
        email: regEmail,
        role: regRole,
      });
      setSuccessMsg('Đăng ký thành công! Bạn có thể đăng nhập ngay.');
      setTab('login');
      setUsername(regUsername);
      setPassword(regPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Đăng ký không thành công.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-50 flex flex-col justify-center px-4 py-8">
      <div className="max-w-md w-full mx-auto space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 mb-1">
            <span className="text-2xl font-black">EC</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">EduCareLink</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Nền tảng kết nối Chăm sóc & Giáo dục trẻ em an toàn trên Zalo Mini App
          </p>
        </div>

        {/* 1-Click Fast Demo Login for Judges */}
        <div className="p-4 bg-white rounded-3xl border border-orange-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <IconSparkles className="w-4 h-4 text-orange-600" />
            <h3 className="text-xs font-bold text-orange-900 uppercase tracking-wider">
              Khám phá nhanh (Dành cho Giám khảo & Thử nghiệm)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Bấm chọn để vào ngay giao diện và test tính năng gọi API backend:
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => loginWithDemo('parent')}
              disabled={isLoading}
              className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white font-bold text-xs rounded-2xl shadow-sm hover:from-orange-600 hover:to-orange-700 active:scale-95 transition-all text-left flex flex-col justify-between"
            >
              <div className="text-[10px] text-orange-100 font-medium">1-Click Test</div>
              <div className="text-sm font-black mt-1">Vai trò Phụ huynh</div>
              <div className="text-[10px] text-orange-100/80 mt-1">phuhuynh_test</div>
            </button>

            <button
              onClick={() => loginWithDemo('worker')}
              disabled={isLoading}
              className="p-3 bg-gradient-to-br from-teal-600 to-emerald-700 text-white font-bold text-xs rounded-2xl shadow-sm hover:from-teal-700 hover:to-emerald-800 active:scale-95 transition-all text-left flex flex-col justify-between"
            >
              <div className="text-[10px] text-teal-100 font-medium">1-Click Test</div>
              <div className="text-sm font-black mt-1">Vai trò Carepartner</div>
              <div className="text-[10px] text-teal-100/80 mt-1">sinhvien_test</div>
            </button>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                tab === 'login'
                  ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/20'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                tab === 'register'
                  ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/20'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>

          <div className="p-5">
            {errorMsg && (
              <div className="mb-3 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-3 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium">
                {successMsg}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleStandardLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all mt-2"
                >
                  {isLoading ? 'Đang kết nối...' : 'Đăng nhập vào hệ thống'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                {/* Role selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bạn là:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole('parent')}
                      className={`py-2 text-xs font-bold rounded-xl border ${
                        regRole === 'parent'
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      Phụ huynh
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('worker')}
                      className={`py-2 text-xs font-bold rounded-xl border ${
                        regRole === 'worker'
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      Carepartner (Sinh viên)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Mật khẩu
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all mt-2"
                >
                  Tạo tài khoản mới
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center space-x-1">
          <IconShield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Bảo vệ quyền lợi & thẩm định danh tính bởi EduCareLink</span>
        </div>
      </div>
    </div>
  );
};
