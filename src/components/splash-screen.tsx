import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

/**
 * Splash Screen EduCareLink
 * Logo khiên + mũ tốt nghiệp, gradient cam chủ đạo,
 * progress bar tự động chuyển cảnh sau ~2.2s (mượt theo prototype).
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = setTimeout(() => setIsLeaving(true), 2100);
    const finishTimer = setTimeout(() => onFinish(), 2500);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-primary via-primary to-primary-dark transition-opacity duration-300 ${
        isLeaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Decorative background circles */}
      <div className="absolute top-[-60px] left-[-60px] w-56 h-56 rounded-full bg-white/5" />
      <div className="absolute bottom-[-80px] right-[-70px] w-72 h-72 rounded-full bg-white/5" />
      <div className="absolute top-1/4 right-8 w-16 h-16 rounded-full bg-white/10 blur-md animate-float" />

      {/* Logo Shield + Graduation Cap */}
      <div className="animate-splash-shield relative z-10 flex flex-col items-center">
        <div className="relative">
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-[2rem] bg-white/20 animate-pulse-ring" />
          <div className="relative w-24 h-24 rounded-[2rem] bg-white shadow-2xl shadow-black/20 flex items-center justify-center">
            <svg
              viewBox="0 0 64 64"
              className="w-14 h-14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Shield */}
              <path
                d="M32 6L54 14v14c0 14.5-9.4 24.6-22 30C19.4 52.6 10 42.5 10 28V14l22-8z"
                fill="url(#shieldGrad)"
              />
              {/* Graduation cap */}
              <path
                d="M32 20L46 26l-14 6-14-6 14-6z"
                fill="#FFFFFF"
                stroke="#D4541E"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M24 29.5v6.2c0 2.2 3.6 4.3 8 4.3s8-2.1 8-4.3v-6.2l-8 3.4-8-3.4z"
                fill="#FFF4ED"
                stroke="#D4541E"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M46 26v8" stroke="#FFF4ED" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="46" cy="35.6" r="1.8" fill="#FFCFB3" />
              <defs>
                <linearGradient id="shieldGrad" x1="10" y1="6" x2="54" y2="58">
                  <stop stopColor="#F26522" />
                  <stop offset="1" stopColor="#D4541E" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <h1 className="mt-6 text-3xl font-extrabold text-white tracking-tight font-display">
          EduCareLink
        </h1>
        <p className="mt-2 text-xs font-semibold text-white/80 tracking-wide uppercase">
          Chăm sóc an toàn • Giáo dục tận tâm
        </p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-16 w-40 h-1.5 rounded-full bg-white/20 overflow-hidden z-10">
        <div className="h-full bg-white rounded-full animate-splash-progress" />
      </div>

      <p className="absolute bottom-8 text-[10px] text-white/60 font-medium z-10">
        Powered by EduCareLink Platform © 2026
      </p>
    </div>
  );
};
