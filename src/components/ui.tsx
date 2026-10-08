/**
 * UI primitives dùng chung — bề mặt tương đương các component RN cơ bản.
 * Mọi screen port phải dùng các primitives này để thống nhất hành vi.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { COLORS, TYPO, SIZES, SHADOWS } from "@/theme";
import api from "@/api/client";

/* ---------------- Safe area / status bar ---------------- */
let cachedStatusBarHeight = 0;

export function useStatusBarHeight(): number {
  const [h, setH] = useState(cachedStatusBarHeight);
  useEffect(() => {
    if (cachedStatusBarHeight) return;
    (async () => {
      try {
        const zmp: any = await import("zmp-sdk/apis");
        const info = await zmp.getSystemInfo();
        cachedStatusBarHeight = info?.statusBarHeight ?? 0;
        setH(cachedStatusBarHeight);
      } catch {
        cachedStatusBarHeight = 0; // web test
      }
    })();
  }, []);
  return h;
}

/** Khối đệm chiều cao thanh trạng thái Zalo (RN: paddingTop insets.top) */
export const StatusBarSpacer: React.FC = () => {
  const h = useStatusBarHeight();
  return <div style={{ height: h }} />;
};

/* ---------------- TouchableOpacity / Pressable ---------------- */
export const Touchable: React.FC<{
  onPress?: () => void;
  style?: React.CSSProperties;
  activeOpacity?: number;
  hitSlop?: number;
  disabled?: boolean;
  id?: string;
  children: React.ReactNode;
}> = ({ onPress, style, activeOpacity = 0.8, hitSlop = 0, disabled, id, children }) => (
  <div
    id={id}
    onClick={disabled ? undefined : onPress}
    style={{
      cursor: disabled ? "default" : "pointer",
      userSelect: "none",
      WebkitTapHighlightColor: "transparent",
      transition: "opacity 0.12s",
      margin: hitSlop ? -hitSlop : undefined,
      padding: hitSlop ? hitSlop : undefined,
      ...style,
    }}
    onTouchStart={(e) => ((e.currentTarget as HTMLElement).style.opacity = String(activeOpacity))}
    onTouchEnd={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
    onMouseDown={(e) => ((e.currentTarget as HTMLElement).style.opacity = String(activeOpacity))}
    onMouseUp={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
  >
    {children}
  </div>
);

/* ---------------- ActivityIndicator ---------------- */
export const Spinner: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = COLORS.primary }) => (
  <span
    className="edc-spinner"
    style={{
      display: "inline-block",
      width: size,
      height: size,
      border: `${Math.max(2, size / 10)}px solid ${color}22`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "edc-spin 0.8s linear infinite",
    }}
  />
);

/* ---------------- Alert (RN Alert.alert -> web) ---------------- */
export function showAlert(title: string, message?: string) {
  window.alert(message ? `${title}\n\n${message}` : title);
}

/* ---------------- Avatar chữ cái ---------------- */
export const LetterAvatar: React.FC<{
  name?: string;
  size: number;
  bg?: string;
  color?: string;
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({ name, size, bg = COLORS.primaryLight, color = COLORS.primary, fontSize, style }) => {
  const letter = (name || "U").trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fontSize ?? size * 0.42,
        fontWeight: 800,
        fontFamily: TYPO.h4.fontFamily,
        flexShrink: 0,
        ...style,
      }}
    >
      {letter}
    </div>
  );
};

/* ---------------- Notifications context (poll 30s — RN NotificationBell) ---------------- */
interface NotifCtx {
  unread: number;
  refresh: () => void;
}
const NotificationsContext = createContext<NotifCtx>({ unread: 0, refresh: () => {} });
export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => {
  const [unread, setUnread] = useState(0);
  const refresh = useCallback(() => {
    if (!enabled) return;
    api.get("/notifications/unread-count/").then((d: any) => setUnread(d?.unread_count ?? 0)).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  return <NotificationsContext.Provider value={{ unread, refresh }}>{children}</NotificationsContext.Provider>;
};

/** Nút chuông — variant header (nền trắng 20%) / plain / dark (RN MyJobs NotificationBell dark: badge số + filled khi có unread) */
export const NotificationBell: React.FC<{ variant?: "header" | "plain" | "dark" }> = ({ variant = "header" }) => {
  const { unread } = useNotifications();
  const nav = useNav();
  const isDark = variant === "dark";
  return (
    <Touchable
      onPress={() => nav.navigate("Notifications")}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(variant === "header"
          ? { background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.25)" }
          : isDark
          ? { background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)" }
          : {}),
      }}
    >
      <Icon
        name={isDark && unread > 0 ? "notifications" : "notifications-outline"} // CROSS-REVIEW FIX (7-b): filled khi có unread như RN
        size={21}
        color={variant === "plain" ? COLORS.primary : "#fff"}
      />
      {isDark && unread > 0 ? (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            background: COLORS.error,
            border: "1.5px solid #fff",
            color: "#fff",
            fontSize: 9.5,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : unread > 0 ? (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            width: 8,
            height: 8,
            borderRadius: 4,
            background: COLORS.error,
            border: "1.5px solid #fff",
          }}
        />
      ) : null}
    </Touchable>
  );
};

import { useNav } from "@/navigation/router";

/* ---------------- Screen container (scroll + safe top) ---------------- */
export const Screen: React.FC<{
  bg?: string;
  scroll?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ bg = COLORS.background, scroll = true, style, children }) => (
  <div
    className="edc-screen"
    style={{
      minHeight: "100dvh",
      background: bg,
      display: "flex",
      flexDirection: "column",
      ...style,
    }}
  >
    {scroll ? (
      <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {children}
      </div>
    ) : (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>{children}</div>
    )}
  </div>
);

/* ---------------- App bar trắng chuẩn RN ---------------- */
export const AppBar: React.FC<{
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
  backIconColor?: string;
  titleColor?: string;
  bg?: string;
}> = ({ title, right, onBack, backIconColor = COLORS.onSurface, titleColor = COLORS.onSurface, bg = COLORS.surface }) => {
  const nav = useNav();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: bg,
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        {onBack !== null && (
          <Touchable
            onPress={onBack ?? nav.goBack}
            hitSlop={12}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: bg === COLORS.surface ? COLORS.surface : "rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: bg === COLORS.surface ? SHADOWS.small : undefined,
            }}
          >
            <Icon name="arrow-back" size={24} color={backIconColor} />
          </Touchable>
        )}
        <div
          style={{
            ...TYPO.h4,
            color: titleColor,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
      </div>
      {right}
    </div>
  );
};

/* ---------------- Empty state chuẩn ---------------- */
export const EmptyState: React.FC<{
  icon: string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}> = ({ icon, iconColor = COLORS.primary, iconBg = COLORS.primaryLight, title, subtitle, children }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", textAlign: "center" }}>
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: 38,
        background: iconBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}
    >
      <Icon name={icon} size={38} color={iconColor} />
    </div>
    <div style={{ ...TYPO.h3, color: COLORS.ink, marginBottom: subtitle ? 6 : 0 }}>{title}</div>
    {subtitle && <div style={{ ...TYPO.body, color: COLORS.textSecondary }}>{subtitle}</div>}
    {children && <div style={{ marginTop: 16, width: "100%" }}>{children}</div>}
  </div>
);

/* ---------------- Nút primary ---------------- */
export const PrimaryButton: React.FC<{
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  bg?: string;
  style?: React.CSSProperties;
  icon?: string;
  iconSize?: number;
}> = ({ title, onPress, loading, disabled, bg = COLORS.primary, style, icon, iconSize = 18 }) => (
  <Touchable
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
    style={{
      background: bg,
      borderRadius: SIZES.radiusMd,
      height: 48,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      opacity: disabled || loading ? 0.7 : 1,
      boxShadow: SHADOWS.large,
      ...style,
    }}
  >
    {loading ? (
      <Spinner size={20} color="#fff" />
    ) : (
      <>
        <span style={{ ...TYPO.h4, color: COLORS.textOnPrimary }}>{title}</span>
        {icon && <Icon name={icon} size={iconSize} color="#fff" />}
      </>
    )}
  </Touchable>
);

export { SIZES, SHADOWS };
