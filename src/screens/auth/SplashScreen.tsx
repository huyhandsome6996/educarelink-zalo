/**
 * SplashScreen — port mobile/src/screens/Auth/SplashScreen.js (448 dòng).
 * Nền primary + vòng decor trắng + dot-grid + wave + logo 160×160 radius 80 + tagline italic.
 * Sau 2.5s -> replace('GuestHome') (như RN navigation.replace).
 */
import React, { useEffect, useRef, useState } from "react";
import { COLORS, TYPO, FONT_HEAD } from "@/theme";
import { useNav } from "@/navigation/router";

const SplashScreen: React.FC = () => {
  const nav = useNav();
  const [progress] = useState(80);
  const timer = useRef<any>(null);

  useEffect(() => {
    timer.current = setTimeout(() => {
      nav.replace("GuestHome");
    }, 2500);
    return () => clearTimeout(timer.current);
  }, [nav]);

  const dotGrid = (style: React.CSSProperties) => (
    <div style={{ position: "absolute", display: "grid", gridTemplateColumns: "repeat(3, 5px)", gap: 8, ...style }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.45)" }} />
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.primary,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* Vòng tròn decor */}
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: 150, background: "rgba(255,255,255,0.10)", top: -80, right: -60 }} />
      <div style={{ position: "absolute", width: 200, height: 200, borderRadius: 100, background: "rgba(255,255,255,0.12)", bottom: 100, left: -70 }} />
      {dotGrid({ top: 120, left: 48 })}
      {dotGrid({ bottom: 150, right: 48 })}

      {/* Wave đáy */}
      <svg viewBox="0 0 375 100" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 90 }}>
        <path d="M0,60 C90,100 180,20 375,55 L375,100 L0,100 Z" fill="rgba(255,255,255,0.06)" />
        <path d="M0,80 C120,40 240,95 375,65 L375,100 L0,100 Z" fill="rgba(255,255,255,0.04)" />
      </svg>

      {/* Logo 160×160 radius 80 + shadow */}
      <img
        src="/static/images/logo.png"
        alt="EduCareLink"
        style={{ width: 160, height: 160, borderRadius: 80, objectFit: "cover", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}
      />
      <div
        style={{
          marginTop: 22,
          fontFamily: FONT_HEAD,
          fontSize: 34,
          fontWeight: 900,
          letterSpacing: -0.6,
          color: "#fff",
          lineHeight: "40px",
        }}
      >
        EduCareLink
      </div>
      <div style={{ marginTop: 6, fontSize: 16, fontStyle: "italic", color: "rgba(255,255,255,0.85)" }}>
        An tâm gửi gắm, trọn vẹn yêu thương
      </div>

      {/* Loader bar */}
      <div style={{ position: "absolute", bottom: 96, width: 180 }}>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, background: "#fff", transition: "width 0.3s" }} />
        </div>
        <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
          Đang tải dữ liệu...
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
