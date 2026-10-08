/**
 * NotificationsScreen — port mobile/src/screens/NotificationsScreen.js (280 dòng).
 * Full-screen danh sách thông báo:
 * - App bar TRẮNG "Thông báo" + back (nav.goBack) — spec Zalo (RN dùng header
 *   cam radiusLg; orchestrator chuẩn hoá sub-screen trắng như AppBar chung).
 *   Phải: nút refresh (thay RefreshControl web — RN pull-to-refresh) + nút
 *   "Đánh dấu tất cả đã đọc" (RN CÓ — checkmark-done-outline + spinner).
 * - getNotifications() mount; sort mới nhất lên đầu; tap item chưa đọc ->
 *   markNotificationsRead({ notification_ids: [id] }) + refresh badge
 *   (useNotifications().refresh); mark all -> { mark_all: true } + Alert ✅.
 * - Item: icon theo loại (is_broadcast → megaphone, khác → notifications),
 *   title TYPO.h5 14/700, message 13 #6B7280, time relativeTime RN ("Vừa xong",
 *   "x phút trước", "Hôm qua"...; >7 ngày -> dd/MM HH:mm theo spec Zalo, RN dùng
 *   toLocaleDateString), dot chưa đọc 8×8 #F26522 góc phải, unread nền
 *   primaryLight + viền trái 3 primary.
 * - Empty state ĐÚNG RN: vòng 80×80 notifications-off-outline 40 + h4 +
 *   bodySmall textMuted.
 * Khác platform (mobile-parity-map.md): glyph checkmark-done-outline thiếu trong
 * bộ 159 ionicons -> fallback 'checkmark' cục bộ; FlatList/RefreshControl ->
 * div scroll + nút refresh.
 */
import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { AppBar, showAlert, Spinner, StatusBarSpacer, Touchable, useNotifications } from "@/components/ui";
import { COLORS, TYPO, SHADOWS, SIZES, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import { getNotifications, markNotificationsRead } from "@/api/misc";

interface NotificationItem {
  id: number;
  title?: string;
  message?: string;
  created_at?: string;
  is_read?: boolean;
  is_broadcast?: boolean;
}

/** Glyph thiếu trong bộ ionicons.ts 159 glyph (Icon.tsx chưa có alias) — fallback gần nhất */
const ICON_FALLBACKS: Record<string, string> = {
  "checkmark-done-outline": "checkmark",
};
const ic = (name: string) => ICON_FALLBACKS[name] ?? name;

// Helper: quy đổi timestamp sang "x phút trước" tiếng Việt (nguyên bản RN;
// quá 7 ngày -> dd/MM HH:mm theo spec Zalo thay vì toLocaleDateString)
function relativeTime(iso?: string) {
  if (!iso) return "";
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Hôm qua";
  if (day < 7) return `${day} ngày trước`;
  const dd = String(then.getDate()).padStart(2, "0");
  const MM = String(then.getMonth() + 1).padStart(2, "0");
  const HH = String(then.getHours()).padStart(2, "0");
  const mm = String(then.getMinutes()).padStart(2, "0");
  return `${dd}/${MM} ${HH}:${mm}`;
}

const NotificationsScreen: React.FC = () => {
  const nav = useNav();
  const { refresh: refreshBadge } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res: any = await getNotifications();
      // Sắp xếp mới nhất lên đầu
      const list = (Array.isArray(res) ? res : res?.data || []).slice().sort(
        (a: NotificationItem, b: NotificationItem) =>
          (b.created_at ? new Date(b.created_at).getTime() : 0) -
          (a.created_at ? new Date(a.created_at).getTime() : 0)
      );
      setNotifications(list);
    } catch (e) {
      console.error("Lỗi tải thông báo:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Web không có pull-to-refresh — nút refresh thay thế (spec Zalo)
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleTapNotif = async (item: NotificationItem) => {
    if (item.is_read) return;
    try {
      await markNotificationsRead({ notification_ids: [item.id] });
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      refreshBadge(); // cập nhật badge chuông (RN không có bước này — spec Zalo)
    } catch (e) {
      showAlert("Lỗi", "Không thể đánh dấu đã đọc. Vui lòng thử lại.");
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = notifications.filter((n) => !n.is_read);
    if (unreadItems.length === 0) {
      showAlert("Thông báo", "Không có thông báo chưa đọc.");
      return;
    }
    setMarkingAll(true);
    try {
      await markNotificationsRead({ mark_all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      refreshBadge();
      showAlert("✅ Thành công", "Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch (e) {
      showAlert("Lỗi", "Không thể đánh dấu đã đọc. Vui lòng thử lại.");
    } finally {
      setMarkingAll(false);
    }
  };

  const renderItem = (item: NotificationItem) => (
    <Touchable
      key={String(item.id)}
      onPress={() => handleTapNotif(item)}
      activeOpacity={0.7}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        gap: 12,
        padding: 14,
        borderRadius: SIZES.radiusMd,
        background: item.is_read ? COLORS.surface : COLORS.primaryLight,
        border: `1px solid ${item.is_read ? COLORS.border : COLORS.primarySoft}`,
        ...(item.is_read ? {} : { borderLeft: `3px solid ${COLORS.primary}` }),
        boxShadow: SHADOWS.small,
      }}
    >
      {!item.is_read && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 14,
            width: 8,
            height: 8,
            borderRadius: 4,
            background: COLORS.primary,
          }}
        />
      )}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: COLORS.primaryLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${COLORS.primarySoft}`,
          flexShrink: 0,
        }}
      >
        <Icon name={item.is_broadcast ? "megaphone" : "notifications"} size={18} color={COLORS.primary} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div
            style={{
              ...TYPO.h5,
              color: COLORS.textPrimary,
              fontWeight: 700,
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </div>
          <div style={{ ...TYPO.caption, color: COLORS.textMuted, flexShrink: 0 }}>{relativeTime(item.created_at)}</div>
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: "20px" }}>{item.message}</div>
      </div>
    </Touchable>
  );

  return (
    /* Root cao cố định trừ TabBar (RN: container flex 1 — header đứng yên, list cuộn) */
    <div
      style={{
        height: `calc(100dvh - ${TAB_BAR_HEIGHT}px)`,
        display: "flex",
        flexDirection: "column",
        background: COLORS.background,
        overflow: "hidden",
      }}
    >
      <StatusBarSpacer />
      {/* App bar trắng + back; phải: refresh + đánh dấu tất cả đã đọc */}
      <AppBar
        title="Thông báo"
        onBack={nav.goBack}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Touchable
              onPress={handleRefresh}
              hitSlop={4}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                background: COLORS.primaryLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {refreshing ? <Spinner size={18} color={COLORS.primary} /> : <Icon name="refresh" size={22} color={COLORS.primary} />}
            </Touchable>
            <Touchable
              onPress={handleMarkAllRead}
              disabled={markingAll}
              hitSlop={4}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                background: COLORS.primaryLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {markingAll ? (
                <Spinner size={18} color={COLORS.primary} />
              ) : (
                <Icon name={ic("checkmark-done-outline")} size={22} color={COLORS.primary} />
              )}
            </Touchable>
          </div>
        }
      />

      {isLoading ? (
        <div style={{ marginTop: 60, display: "flex", justifyContent: "center" }}>
          <Spinner size={24} color={COLORS.primary} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {notifications.length === 0 ? (
            /* Empty state ĐÚNG RN */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 12 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  background: COLORS.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: SHADOWS.small,
                }}
              >
                <Icon name="notifications-off-outline" size={40} color={COLORS.textMuted} />
              </div>
              <div style={{ ...TYPO.h4, color: COLORS.textPrimary }}>Chưa có thông báo</div>
              <div style={{ ...TYPO.bodySmall, color: COLORS.textMuted }}>Các thông báo mới sẽ xuất hiện tại đây</div>
            </div>
          ) : (
            <div style={{ padding: SIZES.md, display: "flex", flexDirection: "column", gap: 10 }}>
              {notifications.map((item) => renderItem(item))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsScreen;
