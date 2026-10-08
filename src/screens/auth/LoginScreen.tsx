/**
 * LoginScreen — port CHÍNH XÁC mobile/src/screens/Auth/LoginScreen.js (550 dòng).
 * MỚI (fix audit #1): nền #fff8f6, logo 92×92 PHÍA TRÊN tiêu đề, tiêu đề cam căn giữa
 * TYPO.h1 28/34, card trắng radius 20/padding 24/viền outlineVariant.
 * KHÔNG còn tab Đăng nhập/Đăng ký + logo 32×32 cạnh chữ của bản Django cũ.
 * Hành vi: trim input, Alert lỗi, 403 pending_approval, eye toggle, quên mật khẩu 'Sắp ra mắt'.
 */
import React, { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, FONT_HEAD } from "@/theme";
import { useNav } from "@/navigation/router";
import { useAuth } from "@/context/AuthContext";
import { getOAuthConfig } from "@/api/auth";
import * as authApi from "@/api/auth";
import type { LoginResponse } from "@/api/auth";

const LoginScreen: React.FC = () => {
  const nav = useNav();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [oauthConfig, setOauthConfig] = useState<any>({ google: { enabled: false }, facebook: { enabled: false } });

  useEffect(() => {
    // Fade-in header/card 400ms như RN Animated.timing
    requestAnimationFrame(() => document.getElementById("edc-login-fade")?.style.setProperty("opacity", "1"));
    getOAuthConfig()
      .then((d: any) => setOauthConfig(d?.google || d?.facebook ? d : { google: { enabled: false }, facebook: { enabled: false } }))
      .catch(() => setOauthConfig({ google: { enabled: false }, facebook: { enabled: false } }));
  }, []);

  const handleBack = () => {
    // RN: canGoBack ? goBack() : navigate('GuestHome')
    if (window.history.length > 1) nav.goBack();
    else nav.navigate("GuestHome");
  };

  const handleLogin = async () => {
    const u = username.trim();
    // CROSS-REVIEW FIX (7-c, P1): RN chỉ trim username, gửi password NGUYÊN
    // (LoginScreen.js d.209-216: login(username.trim(), password)) — trim password
    // làm sai mật khẩu chứa khoảng trắng ở đầu/cuối. Validate trên bản trim như RN.
    const p = password;
    if (!u || !p.trim()) {
      showAlert("Lỗi", "Vui lòng nhập tên tài khoản và mật khẩu.");
      return;
    }
    setIsLoading(true);
    try {
      await login(u, p);
      // RootNavigator tự chuyển nhánh theo user (như AppNavigator)
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status;
      const data = e?.response?.data ?? e?.data;
      if (status === 403 && data?.status === "pending_approval") {
        showAlert(
          "Tài khoản đang chờ duyệt",
          "Tài khoản Carepartner của bạn đang chờ Admin xét duyệt. Vui lòng kiểm tra lại sau hoặc liên hệ hỗ trợ."
        );
      } else {
        showAlert("Đăng nhập thất bại", data?.error || "Sai tài khoản hoặc mật khẩu.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: "google" | "facebook") => {
    const setter = provider === "google" ? setIsGoogleLoading : setIsFacebookLoading;
    if (!oauthConfig?.[provider]?.enabled) {
      showAlert(
        "Chưa cấu hình",
        `Đăng nhập ${provider === "google" ? "Google" : "Facebook"} chưa được cấu hình trên server. Vui lòng sử dụng tên tài khoản và mật khẩu để đăng nhập.`
      );
      return;
    }
    setter(true);
    setTimeout(() => setter(false), 800); // OAuth thật cần Zalo SDK flow riêng — xem mobile-parity-map.md
  };

  const handleForgot = () =>
    showAlert("Sắp ra mắt", "Tính năng quên mật khẩu đang được phát triển. Vui lòng liên hệ Admin qua email hỗ trợ.");

  const labelStyle: React.CSSProperties = { ...TYPO.caption, color: COLORS.onSurfaceVariant };
  const inputWrapper: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: "0 12px",
    height: 48,
  };

  return (
    <Screen bg={COLORS.surfaceWarm} scroll>
      <div style={{ padding: "16px 20px 40px" }}>
        <StatusBarSpacer />

        {/* Back button 40×40 */}
        <Touchable
          onPress={handleBack}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: COLORS.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            boxShadow: SHADOWS.small,
          }}
        >
          <Icon name="arrow-back" size={24} color={COLORS.onSurface} />
        </Touchable>

        {/* Header: logo 92×92 + title cam căn giữa */}
        <div
          id="edc-login-fade"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 32,
            opacity: 0,
            transition: "opacity 0.4s",
          }}
        >
          <img src="/static/images/logo.png" alt="EduCareLink" style={{ width: 92, height: 92, objectFit: "contain", marginBottom: 14 }} />
          <div style={{ ...TYPO.h1, fontFamily: FONT_HEAD, color: COLORS.primary, textAlign: "center", marginBottom: 8 }}>
            Chào mừng trở lại
          </div>
          <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant, textAlign: "center" }}>
            Đăng nhập để tiếp tục kết nối
          </div>
        </div>

        {/* Card form */}
        <div
          id="edc-login-card"
          style={{
            background: COLORS.surface,
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
            border: `1px solid ${COLORS.outlineVariant}`,
            boxShadow: SHADOWS.small,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            opacity: 0,
            transition: "opacity 0.4s",
          }}
        >
          {/* Field 1 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={labelStyle}>Số điện thoại / Tên tài khoản</div>
            <div style={inputWrapper}>
              <Icon name="phone-portrait-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập số điện thoại của bạn"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  ...TYPO.body,
                  color: COLORS.onSurface,
                  padding: 0,
                }}
              />
            </div>
          </div>

          {/* Field 2 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={labelStyle}>Mật khẩu</div>
              <Touchable onPress={handleForgot} hitSlop={8}>
                <span style={{ ...TYPO.caption, color: COLORS.primary }}>Quên mật khẩu?</span>
              </Touchable>
            </div>
            <div style={inputWrapper}>
              <Icon name="lock-closed-outline" size={20} color={COLORS.outlineVariant} style={{ marginRight: 12 }} />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  ...TYPO.body,
                  color: COLORS.onSurface,
                  padding: 0,
                }}
              />
              <Touchable onPress={() => setShowPass((v) => !v)} hitSlop={12} style={{ padding: 8 }}>
                <Icon name={showPass ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.outlineVariant} />
              </Touchable>
            </div>
          </div>

          {/* Nút đăng nhập */}
          <Touchable
            onPress={handleLogin}
            activeOpacity={0.8}
            style={{
              background: COLORS.primary,
              borderRadius: 14,
              height: 48,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              opacity: isLoading ? 0.7 : 1,
              boxShadow: SHADOWS.large,
            }}
          >
            {isLoading ? (
              <Spinner size={20} color="#fff" />
            ) : (
              <>
                <span style={{ ...TYPO.h4, color: COLORS.textOnPrimary }}>Đăng nhập</span>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </Touchable>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: COLORS.outlineVariant }} />
          <div
            style={{
              ...TYPO.caption,
              color: COLORS.onSurfaceVariant,
              background: COLORS.surfaceWarm,
              padding: "0 8px",
            }}
          >
            Hoặc tiếp tục với
          </div>
          <div style={{ flex: 1, height: 1, background: COLORS.outlineVariant }} />
        </div>

        {/* Social row */}
        <div style={{ display: "flex", flexDirection: "row", gap: 16, marginBottom: 32 }}>
          {(
            [
              { key: "google", icon: "logo-google", color: "#4285F4", label: "Google", loading: isGoogleLoading },
              { key: "facebook", icon: "logo-facebook", color: "#1877F2", label: "Facebook", loading: isFacebookLoading },
            ] as const
          ).map((s) => (
            <Touchable
              key={s.key}
              onPress={() => handleOAuth(s.key)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: COLORS.surface,
                border: `1px solid ${COLORS.outlineVariant}`,
                borderRadius: 14,
                height: 48,
                opacity: s.loading ? 0.5 : 1,
              }}
            >
              {s.loading ? (
                <>
                  <Spinner size={16} color={s.color} />
                  <span style={{ ...TYPO.body, color: COLORS.onSurface }}>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Icon name={s.icon} size={20} color={s.color} />
                  <span style={{ ...TYPO.body, color: COLORS.onSurface }}>{s.label}</span>
                </>
              )}
            </Touchable>
          ))}
        </div>

        {/* Register row */}
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
          <span style={{ ...TYPO.body, color: COLORS.onSurfaceVariant }}>Chưa có tài khoản?</span>
          <Touchable onPress={() => nav.navigate("Register")} hitSlop={8}>
            <span style={{ ...TYPO.h4, color: COLORS.primary }}> Đăng ký ngay</span>
          </Touchable>
        </div>
      </div>
    </Screen>
  );
};

export default LoginScreen;
