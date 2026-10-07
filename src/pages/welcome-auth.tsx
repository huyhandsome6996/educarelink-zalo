import React, { useState, useRef } from 'react';
import { useAuth } from '@/state/auth';
import { api } from '@/services/api';
import { IconShield, IconSparkles, IconUser, IconCheckCircle, IconLock } from '@/components/common-icons';

/* ---------- Social & Utility Icons ---------- */
const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.8 2.9c2.3-2.1 3.6-5.1 3.6-8.6z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.3v3C3.2 21.3 7.3 24 12 24z" />
    <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4v-3H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
    <path fill="#EA4335" d="M12 4.6c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1 15.2 0 12 0 7.3 0 3.2 2.7 1.3 6.6l3.9 3c1-2.9 3.7-5 6.8-5z" />
  </svg>
);

const FacebookIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z" />
  </svg>
);

const IconEye: React.FC<{ off?: boolean; className?: string }> = ({ off, className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    {off && <line x1="4" y1="4" x2="20" y2="20" />}
  </svg>
);

/* ---------- Upload Box ---------- */
interface UploadBoxProps {
  label: string;
  hint: string;
  preview: string | null;
  onFile: (file: File) => void;
  accent?: 'orange' | 'teal';
}
const UploadBox: React.FC<UploadBoxProps> = ({ label, hint, preview, onFile, accent = 'orange' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const accentCls = accent === 'orange' ? 'border-orange-300 bg-primary-light' : 'border-teal-300 bg-teal-50';
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`relative h-24 rounded-2xl border-2 border-dashed ${accentCls} hover:scale-[1.02] active:scale-95 transition-all overflow-hidden flex flex-col items-center justify-center w-full`}
    >
      {preview ? (
        <>
          <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-bold py-1">
            ✓ Đã tải lên — bấm để đổi
          </span>
        </>
      ) : (
        <>
          <svg className="w-6 h-6 text-orange-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-[11px] font-bold text-slate-700">{label}</span>
          <span className="text-[10px] text-slate-400">{hint}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </button>
  );
};

/* ================= MAIN SCREEN ================= */
export const WelcomeAuth: React.FC = () => {
  const { loginWithDemo, login, isLoading } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login state
  const [roleTab, setRoleTab] = useState<'parent' | 'worker'>('parent');
  const [username, setUsername] = useState('phuhuynh_test');
  const [password, setPassword] = useState('Demo@2026');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regRole, setRegRole] = useState<'parent' | 'worker'>('worker');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUniversity, setRegUniversity] = useState('');
  const [regIdFront, setRegIdFront] = useState<File | null>(null);
  const [regIdBack, setRegIdBack] = useState<File | null>(null);
  const [regSelfie, setRegSelfie] = useState<File | null>(null);
  const [regCert, setRegCert] = useState<File | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [certPreview, setCertPreview] = useState<string | null>(null);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const switchRoleTab = (r: 'parent' | 'worker') => {
    setRoleTab(r);
    setUsername(r === 'parent' ? 'phuhuynh_test' : 'sinhvien_test');
    setPassword('Demo@2026');
    setLoginError('');
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = await login(username, password);
    if (!res.success) {
      setLoginError(res.error || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setLoginError('');
    const res = await loginWithDemo(roleTab);
    if (!res.success) setLoginError(`Đăng nhập ${provider} không khả dụng, dùng tài khoản demo thay thế.`);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');
    if (!regUsername.trim() || !regPassword || !regName.trim()) {
      setRegError('Vui lòng nhập đủ Tên đăng nhập, Mật khẩu và Họ tên.');
      return;
    }
    setIsRegistering(true);
    try {
      await api.register({
        username: regUsername,
        password: regPassword,
        first_name: regName,
        phone_number: regPhone,
        email: regEmail,
        role: regRole,
        university: regUniversity,
      });
      // Nộp kèm giấy tờ (best-effort, không chặn luồng đăng ký)
      if (regIdFront || regIdBack || regSelfie || regCert) {
        try {
          await api.uploadVerificationDocuments({
            id_card_front: regIdFront,
            id_card_back: regIdBack,
            selfie_photo: regSelfie,
            certificate_photo: regCert,
          });
        } catch {
          console.warn('Upload giấy tờ tạm hoãn — có thể nộp sau trong Hồ sơ.');
        }
      }
      setRegSuccess('Đăng ký thành công! Hệ thống đã chuyển sang đăng nhập.');
      setTab('login');
      setUsername(regUsername);
      setPassword(regPassword);
      setRegUsername(''); setRegPassword(''); setRegName('');
    } catch (err: any) {
      setRegError(err.message || 'Đăng ký không thành công. Thử tên đăng nhập khác.');
    } finally {
      setIsRegistering(false);
    }
  };

  const isParent = roleTab === 'parent';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-light via-white to-slate-50 flex flex-col justify-center px-4 py-8">
      <div className="max-w-md w-full mx-auto space-y-4 animate-fade-in-up">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.4rem] bg-gradient-to-tr from-primary to-primary-dark text-white shadow-lg shadow-primary/25 relative">
            <svg viewBox="0 0 64 64" className="w-9 h-9" fill="none">
              <path d="M32 6L54 14v14c0 14.5-9.4 24.6-22 30C19.4 52.6 10 42.5 10 28V14l22-8z" fill="currentColor" opacity="0.25" />
              <path d="M32 6L54 14v14c0 14.5-9.4 24.6-22 30C19.4 52.6 10 42.5 10 28V14l22-8z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M32 24L44 29l-12 5-12-5 12-5z" fill="#fff" />
              <path d="M26 32.5v4.6c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.6l-6 2.5-6-2.5z" fill="#FFCFB3" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight font-display">EduCareLink</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Nền tảng kết nối Chăm sóc &amp; Giáo dục trẻ em an toàn trên Zalo Mini App
          </p>
        </div>

        {/* Role Tabs — chuyển vai trò */}
        <div className="flex bg-white rounded-2xl border border-slate-100 shadow-xs p-1">
          <button
            onClick={() => switchRoleTab('parent')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
              isParent ? 'bg-primary text-white shadow-md shadow-primary/25' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <IconUser className="w-4 h-4" />
            <span>Phụ huynh</span>
          </button>
          <button
            onClick={() => switchRoleTab('worker')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
              !isParent ? 'bg-brand-teal text-white shadow-md shadow-teal-600/25' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <IconShield className="w-4 h-4" />
            <span>Carepartner</span>
          </button>
        </div>

        {/* 1-Click Fast Demo Login */}
        <div className="p-3.5 bg-white rounded-2xl border border-orange-200/70 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <IconSparkles className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-[11px] font-extrabold text-slate-800">Vào nhanh tài khoản demo</h3>
              <p className="text-[10px] text-slate-400">
                {isParent ? 'phuhuynh_test' : 'sinhvien_test'} • mật khẩu Demo@2026
              </p>
            </div>
          </div>
          <button
            onClick={() => loginWithDemo(roleTab)}
            disabled={isLoading}
            className="px-4 py-2 bg-gradient-to-r from-primary to-primary-dark text-white text-xs font-extrabold rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-60"
          >
            {isLoading ? 'Đang vào...' : '1-Click'}
          </button>
        </div>

        {/* Auth Box */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                tab === 'login' ? 'text-primary border-b-2 border-primary bg-primary-light/40' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-3 text-xs font-bold transition-all ${
                tab === 'register' ? 'text-primary border-b-2 border-primary bg-primary-light/40' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>

          <div className="p-5">
            {tab === 'login' && loginError && (
              <div className="mb-3 p-3 bg-status-errorbg text-status-error rounded-xl text-xs font-medium animate-fade-in">
                {loginError}
              </div>
            )}
            {tab === 'register' && regError && (
              <div className="mb-3 p-3 bg-status-errorbg text-status-error rounded-xl text-xs font-medium animate-fade-in">{regError}</div>
            )}
            {tab === 'register' && regSuccess && (
              <div className="mb-3 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium animate-fade-in flex items-center">
                <IconCheckCircle className="w-4 h-4 mr-1.5" /> {regSuccess}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleStandardLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Tên đăng nhập
                  </label>
                  <div className="relative">
                    <IconUser className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Nhập tên đăng nhập..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <IconLock />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 active:scale-90 transition-all"
                      aria-label="Hiện/ẩn mật khẩu"
                    >
                      <IconEye off={showPass} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center space-x-1.5 text-slate-500 font-medium">
                    <input type="checkbox" defaultChecked className="accent-primary w-3.5 h-3.5 rounded" />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>
                  <span className="text-primary font-bold cursor-pointer hover:underline">Quên mật khẩu?</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary-dark text-white font-extrabold text-xs rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all mt-1 disabled:opacity-60"
                >
                  {isLoading ? 'Đang kết nối...' : isParent ? 'Đăng nhập dành cho Phụ huynh' : 'Đăng nhập dành cho Carepartner'}
                </button>

                {/* Social Login */}
                <div className="flex items-center space-x-3 pt-1">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] text-slate-400 font-semibold">hoặc tiếp tục với</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    className="flex items-center justify-center space-x-2 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    <GoogleIcon /> <span>Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocialLogin('facebook')}
                    className="flex items-center justify-center space-x-2 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    <FacebookIcon /> <span>Facebook</span>
                  </button>
                </div>
              </form>
            ) : (
              /* ============ REGISTER FORM ============ */
              <form onSubmit={handleRegister} className="space-y-3.5">
                {/* Role cards */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Bạn muốn gia nhập với vai trò
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole('parent')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                        regRole === 'parent'
                          ? 'border-primary bg-primary-light shadow-sm'
                          : 'border-slate-200 bg-white hover:border-orange-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${regRole === 'parent' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <IconUser className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-extrabold text-slate-800">Phụ huynh</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Đăng việc, tìm người chăm bé</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('worker')}
                      className={`p-3 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                        regRole === 'worker'
                          ? 'border-teal-600 bg-teal-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-teal-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${regRole === 'worker' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <IconShield className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-extrabold text-slate-800">Carepartner</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Sinh viên nhận việc, tạo thu nhập</div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1 tracking-wide">Tên đăng nhập</label>
                    <input type="text" required value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="username" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-primary focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1 tracking-wide">Họ và tên</label>
                    <input type="text" required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nguyễn Văn A" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-primary focus:outline-none transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1 tracking-wide">Số điện thoại</label>
                    <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="09xx xxx xxx" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-primary focus:outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1 tracking-wide">Mật khẩu</label>
                    <input type="password" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-primary focus:outline-none transition-all" />
                  </div>
                </div>

                {/* CCCD 2 mặt + chân dung */}
                <div className="p-3 bg-surface-alt rounded-2xl border border-orange-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-800 flex items-center">
                      <IconShield className="w-3.5 h-3.5 mr-1 text-primary" /> Xác thực danh tính (CCCD &amp; Chân dung)
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">Bảo mật SSL</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <UploadBox label="CCCD mặt trước" hint="Ảnh rõ chữ, không che" preview={idFrontPreview} onFile={(f) => { setRegIdFront(f); setIdFrontPreview(URL.createObjectURL(f)); }} />
                    <UploadBox label="CCCD mặt sau" hint="Ảnh rõ chữ, không che" preview={idBackPreview} onFile={(f) => { setRegIdBack(f); setIdBackPreview(URL.createObjectURL(f)); }} />
                    <UploadBox label="Ảnh chân dung" hint="Selfie rõ mặt" preview={selfiePreview} onFile={(f) => { setRegSelfie(f); setSelfiePreview(URL.createObjectURL(f)); }} />
                    <UploadBox label="Bằng cấp / Chứng chỉ" hint="Nếu có (Sư phạm...)" accent="teal" preview={certPreview} onFile={(f) => { setRegCert(f); setCertPreview(URL.createObjectURL(f)); }} />
                  </div>
                </div>

                {regRole === 'worker' && (
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1 tracking-wide">Trường đại học / Chuyên ngành</label>
                    <input type="text" value={regUniversity} onChange={(e) => setRegUniversity(e.target.value)} placeholder="VD: ĐH Sư Phạm TP.HCM — Sư phạm Toán" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-teal-500 focus:outline-none transition-all" />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white font-extrabold text-xs rounded-xl shadow-lg shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {isRegistering ? 'Đang tạo tài khoản...' : 'Tạo tài khoản & Nộp hồ sơ xác thực'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center space-x-1">
          <IconShield className="w-3.5 h-3.5 text-brand-green" />
          <span>Bảo vệ quyền lợi &amp; thẩm định danh tính bởi EduCareLink</span>
        </div>
      </div>
    </div>
  );
};
