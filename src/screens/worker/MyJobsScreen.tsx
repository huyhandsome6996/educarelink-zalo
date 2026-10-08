/**
 * MyJobsScreen — port CHÍNH XÁC mobile/src/screens/Worker/MyJobsScreen.js (1746 dòng).
 * "Việc của tôi" CarePartner — KIẾN TRÚC 4 TAB VÒNG ĐỜI:
 *   Tab 1 "Chờ xác nhận"  — awaiting_commitment: countdown thời gian thực (1 interval duy nhất),
 *                           xác nhận cam kết / từ chối (modal lý do CANCEL_REASONS), hết hạn tự đồng bộ 4s.
 *   Tab 2 "Sắp làm"       — committed + in_progress (in_progress luôn trên cùng): liên hệ phụ huynh
 *                           (tel/sms), chỉ đường (Google Maps), đổi giờ (modal).
 *   Tab 3 "Đã hoàn thành" — completed (+ awaiting_review): thu nhập vào ví.
 *   Tab 4 "Lịch sử"       — audit log đầy đủ + việc legacy (TaskApplication) + chip lọc +
 *                           kháng cáo ELO + nhật ký ca + tracking/SOS (legacy).
 * KHÔNG custom bottom nav — FlatList paddingBottom 110 của RN → paddingBottom 84 (tab bar chung Zalo).
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - LocationService (expo-location background task) → web tracking module nội tuyến: geolocation
 *    permission + POST /tracking/location/ mỗi 10s + heartbeat 30s + storage 'tracking_task_id'.
 *  - TrackingConsentModal & ActiveTrackingBanner (components RN riêng) được port NỘI TẠY vì chỉ
 *    được phép ghi đúng 2 file màn hình này.
 *  - Alert.alert 2 nút ("Viết nhật ký ngay"/"Để sau") → window.confirm; Alert 1 nút → showAlert().
 *  - SOS modal bổ sung hàng hotline 0862427404 (theo Task 5-d; cùng pattern Parent MyTasksScreen).
 *  - handleResolveSOS của RN là dead-code (không có JSX gọi) — không port.
 *  - RefreshControl (kéo-tải) của RN không tồn tại trên web — fetch khi mount (poll không có ở RN).
 *  - Icon thiếu glyph (hourglass, checkmark-done*, swap-horizontal, play-circle, star-half, cash, call,
 *    chatbubble x2, lock-closed, book-outline, close-circle-outline) → alias glyph gần nhất trong bộ 159.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Screen, Spinner, StatusBarSpacer, Touchable, showAlert, useNotifications } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, TYPO } from "@/theme";
import storage from "@/utils/storage";
import { getMyJobsAsWorker } from "@/api/tasks";
import {
  getBookings,
  commitBooking,
  cancelBooking,
  requestReschedule,
  completeBooking,
  getOnboardingStatus,
} from "@/api/matching";
import { checkConsent, triggerSOS, getSOSAlerts, revokeConsent, updateLocation, sendHeartbeat, grantConsent } from "@/api/tracking";
import { useNav } from "@/navigation/router";

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  hourglass: "hourglass-outline",
  "checkmark-done": "checkmark",
  "checkmark-done-circle": "checkmark-circle",
  "checkmark-done-outline": "checkmark",
  "swap-horizontal": "sync-outline",
  "play-circle": "play",
  "star-half": "star-outline",
  cash: "cash-outline",
  call: "call-outline",
  chatbubble: "chatbubble-ellipses",
  "chatbubble-outline": "chatbubble-ellipses-outline",
  "lock-closed": "lock-closed-outline",
  "book-outline": "book",
  "close-circle-outline": "close-circle",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

const SUPPORT_HOTLINE = "0862427404"; // mobile/src/config/appConfig.js

/**
 * CANCEL_REASONS — copy NGUYÊN mobile/src/api/matching.js:129-138.
 * (Bản CANCEL_REASONS hiện có trong src/api/matching.ts của zalo lệch danh sách RN —
 *  dùng bản local này để giữ đúng 8 lý do + cờ forceMajeure của RN, không sửa file chung.)
 */
const CANCEL_REASONS: { code: string; label: string; forceMajeure?: boolean }[] = [
  { code: "school_schedule", label: "Trùng lịch học đột xuất", forceMajeure: true },
  { code: "health", label: "Sức khỏe không tốt", forceMajeure: true },
  { code: "family_emergency", label: "Việc gia đình khẩn cấp", forceMajeure: true },
  { code: "accident", label: "Tai nạn / sự cố di chuyển", forceMajeure: true },
  { code: "wrong_job_info", label: "Thông tin công việc không đúng mô tả", forceMajeure: true },
  { code: "transport", label: "Không thể di chuyển", forceMajeure: false },
  { code: "personal", label: "Lý do cá nhân", forceMajeure: false },
  { code: "other", label: "Khác (bắt buộc ghi chú)", forceMajeure: false },
];

/** numberOfLines RN → CSS line-clamp */
const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: n,
  overflow: "hidden",
});

/** RN Linking.openURL → web: đổi location (tel:/sms:/https:) */
const openURL = (url: string, onError?: () => void) => {
  try {
    window.location.href = url;
  } catch {
    onError?.();
  }
};

// ── Định nghĩa 4 tab (thứ tự cố định, không gộp) ──
const TABS = [
  { key: "awaiting", label: "Chờ xác nhận", icon: "hourglass-outline" },
  { key: "upcoming", label: "Sắp làm", icon: "calendar-outline" },
  { key: "completed", label: "Đã hoàn thành", icon: "checkmark-done-outline" },
  { key: "history", label: "Lịch sử", icon: "time-outline" },
];

// Alias tham số điều hướng từ BookingDetailScreen (Confirmation Jump)
const TAB_KEY_ALIASES: Record<string, string> = {
  awaiting: "awaiting",
  upcoming: "upcoming",
  completed: "completed",
  history: "history",
};

// ── Nhóm trạng thái Booking theo tab ──
const BOOKING_AWAITING = ["awaiting_commitment"];
const BOOKING_UPCOMING = ["committed", "in_progress", "reschedule_requested", "suspected_no_show"];
const BOOKING_COMPLETED = ["completed", "awaiting_review"];
// Tab 4 = audit log: MỌI trạng thái đã kết thúc (gồm cả completed).
const BOOKING_ENDED = [
  "completed",
  "awaiting_review",
  "cancelled_by_carepartner",
  "cancelled_by_parent",
  "no_show",
  "no_show_unconfirmed",
  "declined_in_window",
  "expired_no_response",
  "disputed",
];

// STATUS_STYLE — copy NGUYÊN RN dòng 62–80
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  awaiting_commitment: { color: "#B45309", bg: "#FEF3C7", label: "Chờ bạn xác nhận", icon: "hourglass" },
  committed: { color: COLORS.primary, bg: COLORS.primaryLight, label: "Đã cam kết", icon: "checkmark-circle" },
  reschedule_requested: { color: "#7C3AED", bg: "#EDE9FE", label: "Đang xin đổi giờ", icon: "swap-horizontal" },
  in_progress: { color: "#0284C7", bg: "#E0F2FE", label: "Đang làm", icon: "play-circle" },
  suspected_no_show: { color: "#B45309", bg: "#FEF3C7", label: "Nghi ngờ không đến", icon: "warning" },
  completed: { color: COLORS.success, bg: "#ECFDF5", label: "Hoàn thành", icon: "checkmark-done-circle" },
  awaiting_review: { color: "#0E7490", bg: "#CFFAFE", label: "Chờ phụ huynh đánh giá", icon: "star-half" },
  cancelled_by_carepartner: { color: COLORS.textMuted, bg: "#F3F4F6", label: "Bạn đã từ chối nhận ca", icon: "close-circle" },
  cancelled_by_parent: { color: COLORS.textMuted, bg: "#F3F4F6", label: "Phụ huynh đã hủy", icon: "close-circle" },
  no_show: { color: "#B91C1C", bg: "#FEE2E2", label: "Không đến làm", icon: "warning" },
  no_show_unconfirmed: { color: "#B45309", bg: "#FEF3C7", label: "Chưa xác nhận vắng mặt", icon: "warning" },
  declined_in_window: { color: COLORS.textMuted, bg: "#F3F4F6", label: "Bạn đã từ chối nhận ca", icon: "close-circle" },
  expired_no_response: { color: COLORS.textMuted, bg: "#F3F4F6", label: "Đã hết hạn xác nhận", icon: "time" },
  disputed: { color: "#B91C1C", bg: "#FEE2E2", label: "Có tranh chấp", icon: "warning" },
  // Legacy TaskApplication
  accepted: { color: COLORS.primary, bg: COLORS.primaryLight, label: "Sắp làm", icon: "calendar" },
  rejected: { color: COLORS.textMuted, bg: "#F3F4F6", label: "Đã bị từ chối (ứng tuyển cũ)", icon: "close-circle" },
};

// Ngưỡng chuyển màu cảnh báo countdown (< 10 phút)
const URGENT_THRESHOLD_SEC = 600;

const fmtVnd = (v: any) => {
  const n = parseInt(v || 0, 10);
  return `${n.toLocaleString("vi-VN")}đ`;
};

// "Còn 10 phút 10 giây để xác nhận" / "Còn 1 giờ 5 phút"
const formatCountdown = (total: number) => {
  if (!total || total <= 0) return "Đã hết hạn";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  return `${m} phút ${s} giây`;
};

const fmtDateTime = (iso: string | null | undefined) => {
  try {
    const d = new Date(iso as string);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

// Khoảng cách gần đúng (Haversine, km) từ vị trí thiết bị tới địa điểm job
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
};

/* ══════════════════════════════════════════════════════════════════
   Web tracking module — thay mobile/src/services/LocationService.js
   (expo-location background task không tồn tại trên web; dùng geolocation
   + interval: location 10s, heartbeat 30s, storage key 'tracking_task_id')
   ══════════════════════════════════════════════════════════════════ */
let webTrackingTimer: ReturnType<typeof setInterval> | null = null;
let webHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let webLastCoords: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null };

const webGetCurrentTaskId = (): number | null => {
  const raw = storage.getSync("tracking_task_id");
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return isNaN(n) ? null : n;
};

const webStartTracking = async (taskId: number | string): Promise<boolean> => {
  const granted = await new Promise<boolean>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        webLastCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        resolve(true);
      },
      () => resolve(false),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
  if (!granted) return false;
  await storage.setItem("tracking_task_id", String(taskId));
  if (webTrackingTimer) clearInterval(webTrackingTimer);
  const push = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        webLastCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        updateLocation({
          task_id: taskId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          speed: pos.coords.speed ?? null,
          heading: pos.coords.heading ?? null,
          recorded_at: new Date().toISOString(),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };
  push();
  webTrackingTimer = setInterval(push, 10_000); // RN UPDATE_INTERVAL_MS
  if (webHeartbeatTimer) clearInterval(webHeartbeatTimer);
  webHeartbeatTimer = setInterval(() => {
    sendHeartbeat({ task_id: taskId, latitude: webLastCoords.latitude, longitude: webLastCoords.longitude }).catch(() => {});
  }, 30_000); // RN HEARTBEAT_INTERVAL_MS
  return true;
};

const webStopTracking = async (): Promise<void> => {
  if (webTrackingTimer) {
    clearInterval(webTrackingTimer);
    webTrackingTimer = null;
  }
  if (webHeartbeatTimer) {
    clearInterval(webHeartbeatTimer);
    webHeartbeatTimer = null;
  }
  await storage.deleteItem("tracking_task_id");
};

/* ══════════════════════════════════════════════════════════════════
   ActiveTrackingBanner — port components/ActiveTrackingBanner.js (web path).
   Poll queue SQLite (offline queue) không tồn tại trên web → không hiện hint.
   ══════════════════════════════════════════════════════════════════ */
const ActiveTrackingBanner: React.FC<{ taskId: any; taskTitle: string; onStopped: () => void }> = ({
  taskId,
  taskTitle,
  onStopped,
}) => {
  const [isStopping, setIsStopping] = useState(false);

  const handleStop = async () => {
    // RN Platform.OS === 'web' → window.confirm
    if (window.confirm("Dừng chia sẻ vị trí với phụ huynh?")) {
      setIsStopping(true);
      try {
        await revokeConsent(taskId);
        await webStopTracking();
        onStopped();
        showAlert("✅ Đã dừng", "Đã dừng chia sẻ vị trí với phụ huynh.");
      } catch {
        showAlert("Lỗi", "Không thể dừng. Vui lòng thử lại.");
      } finally {
        setIsStopping(false);
      }
    }
  };

  return (
    <div
      style={{
        margin: 12,
        background: "#ecfdf5",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        border: "1.5px solid #a7f3d0",
        boxShadow: SHADOWS.cardHover,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: COLORS.success,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          boxShadow: SHADOWS.small,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: 24,
            background: COLORS.success,
            opacity: 0.4,
            animation: "edc-pulse 3s ease-in-out infinite",
          }}
        />
        <Icon name="location" size={20} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...TYPO.bodySmall, fontWeight: 800, color: "#065f46" }}>Đang chia sẻ vị trí</div>
        <div style={{ ...TYPO.caption, color: "#047857", marginTop: 2, ...clamp(1) }}>
          Phụ huynh đang thấy bạn · {taskTitle || `Task #${taskId}`}
        </div>
        {/* RN batteryHint — Platform.OS 'web' không làm gì (openBatteryOptimizationSettings no-op) */}
        <div style={{ ...TYPO.caption, color: "#7c4a03", marginTop: 4, textDecoration: "underline" }}>
          ⚡ Tối ưu pin có thể làm ngắt kết nối — bấm để hướng dẫn
        </div>
      </div>
      <Touchable
        onPress={handleStop}
        disabled={isStopping}
        activeOpacity={0.85}
        style={{
          background: "#fff",
          border: "1.5px solid #fecaca",
          borderRadius: 8,
          padding: "6px 12px",
          opacity: isStopping ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <span style={{ ...TYPO.buttonSmall, color: COLORS.error, fontWeight: 700 }}>{isStopping ? "..." : "Dừng"}</span>
      </Touchable>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   TrackingConsentModal — port components/TrackingConsentModal.js
   ══════════════════════════════════════════════════════════════════ */
const TrackingConsentModal: React.FC<{
  visible: boolean;
  taskId: any;
  parentName?: string;
  taskTitle?: string;
  onConsent: (granted: boolean) => void;
  onClose: () => void;
}> = ({ visible, taskId, parentName, taskTitle, onConsent, onClose }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleChoice = async (granted: boolean) => {
    setSubmitting(true);
    try {
      await grantConsent(taskId, granted);
      onConsent(granted);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Không thể lưu đồng ý. Vui lòng thử lại.";
      showAlert("Lỗi", msg);
      // Vẫn gọi onConsent để tiếp tục flow (như RN)
      onConsent(granted);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  const features = [
    { icon: "time-outline", pre: "Chỉ chia sẻ ", bold: "khi đang làm việc" },
    { icon: "eye-off-outline", pre: "Phụ huynh chỉ thấy ", bold: "vị trí hiện tại" },
    { icon: "stop-circle-outline", pre: "Bạn có thể ", bold: "dừng bất cứ lúc nào" },
    { icon: "lock-closed-outline", pre: "", bold: "Dữ liệu mã hóa, chỉ phụ huynh sở hữu việc mới xem" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: "24px 24px 36px",
          boxShadow: SHADOWS.large,
          animation: "edc-fade-in-up 0.25s ease-out",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: COLORS.divider, alignSelf: "center", marginBottom: 16 }} />

        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: COLORS.primaryLight,
            border: `2px solid ${COLORS.primarySoft}`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            alignSelf: "center",
            marginBottom: 16,
          }}
        >
          <Icon name="location" size={36} color={COLORS.primary} />
        </div>

        <div style={{ ...TYPO.h3, fontSize: 20, color: COLORS.textPrimary, textAlign: "center", marginBottom: 8, fontWeight: 700 }}>
          Cho phép theo dõi vị trí?
        </div>
        <div style={{ ...TYPO.body, color: COLORS.textSecondary, textAlign: "center", lineHeight: "22px", marginBottom: 20, padding: "0 8px" }}>
          Phụ huynh <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{parentName || "này"}</span> muốn xem vị trí của bạn trong
          lúc làm việc <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{taskTitle || ""}</span> để an tâm.
        </div>

        <div style={{ background: COLORS.background, borderRadius: 14, padding: 14, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {features.map((f) => (
            <div key={f.icon} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: COLORS.primaryLight,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={f.icon} size={14} color={COLORS.primary} />
              </div>
              <span style={{ ...TYPO.bodySmall, color: COLORS.textPrimary, flex: 1 }}>
                {f.pre}
                <span style={{ fontWeight: 700, color: COLORS.textPrimary }}>{f.bold}</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <Touchable
            onPress={() => handleChoice(false)}
            disabled={submitting}
            activeOpacity={0.85}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              background: COLORS.background,
              border: `1.5px solid ${COLORS.border}`,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <span style={{ color: COLORS.textSecondary, ...TYPO.button, fontSize: 14 }}>Không, cảm ơn</span>
          </Touchable>
          <Touchable
            onPress={() => handleChoice(true)}
            disabled={submitting}
            activeOpacity={0.85}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              background: COLORS.primary,
              boxShadow: SHADOWS.large,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <Spinner size={16} color="#fff" />
            ) : (
              <>
                <Icon name="location" size={16} color="#fff" />
                <span style={{ color: "#fff", ...TYPO.button, fontSize: 14 }}>Đồng ý & nhận việc</span>
              </>
            )}
          </Touchable>
        </div>

        <div style={{ ...TYPO.caption, color: COLORS.textMuted, textAlign: "center", lineHeight: "16px" }}>
          Bạn có thể rút lại đồng ý bất cứ lúc nào từ banner "Đang chia sẻ vị trí".
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MyJobsScreen chính
   ══════════════════════════════════════════════════════════════════ */
/* CROSS-REVIEW FIX (7-b): bell dark 42×42 với badge số unread + icon filled khi có thông báo (như RN NotificationBell dark) */
const MyJobsBell: React.FC = () => {
  const nav = useNav();
  const { unread } = useNotifications();
  return (
    <Touchable
      onPress={() => nav.navigate("Notifications")}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        background: COLORS.background,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      }}
    >
      <Icon name={unread > 0 ? "notifications" : "notifications-outline"} size={22} color={COLORS.textPrimary} />
      {unread > 0 && (
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
      )}
    </Touchable>
  );
};

const MyJobsScreen: React.FC<{ initialTab?: string; highlightBookingId?: string | number }> = ({
  initialTab,
  highlightBookingId: highlightParam,
}) => {
  const nav = useNav();

  // Task C (2026-09-14): onboarding gate — skills/lịch rảnh thiếu → banner
  const [onboardingReady, setOnboardingReady] = useState(true);
  const [onboardingMsg, setOnboardingMsg] = useState("");

  // Confirmation Jump: initialTab + highlightBookingId từ BookingDetailScreen
  const [activeTab, setActiveTab] = useState(() => TAB_KEY_ALIASES[initialTab as string] || "awaiting");
  const [highlightId, setHighlightId] = useState<string | null>(() =>
    highlightParam ? String(highlightParam) : null
  );

  const [items, setItems] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState("all"); // all | done | cancelled | compensation
  const [isLoading, setIsLoading] = useState(true);

  // ── Countdown thời gian thực: 1 interval duy nhất cho toàn màn ──
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t); // tránh memory leak / warning unmounted
  }, []);

  // Highlight card 2 giây khi được điều hướng từ BookingDetail
  useEffect(() => {
    if (!highlightId) return undefined;
    const t = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightId]);

  // ── Tracking state (legacy Task — TaskApplication) ──
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [consentTask, setConsentTask] = useState<any>(null);
  const [consentMap, setConsentMap] = useState<Record<string, any>>({}); // {task_id: 'granted'|'denied'|'revoked'|null}
  const [trackingTaskId, setTrackingTaskId] = useState<number | null>(null);

  // ── SOS state (legacy Task) ──
  const [sosModal, setSosModal] = useState<{ taskId: any; taskTitle: string } | null>(null);
  const [sosMessage, setSosMessage] = useState("");
  const [sosAlertsMap, setSosAlertsMap] = useState<Record<string, any[]>>({});
  const [sosLoading, setSosLoading] = useState(false);

  // ── Commit / Reject state (Booking Flow 1) ──
  const [committingId, setCommittingId] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("school_schedule");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  // ── Đổi giờ (Step 9 Rule 3) ──
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const tomorrowStr = () => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  };
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleFrom, setRescheduleFrom] = useState("");
  const [rescheduleTo, setRescheduleTo] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  // ── Toạ độ thiết bị (tính khoảng cách gần đúng tới địa điểm job) ──
  // RN: expo-location; web: navigator.geolocation (yêu cầu quyền khi vào màn)
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let mounted = true;
    try {
      if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mounted && pos?.coords?.latitude != null) {
            setDeviceCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        () => {},
        { timeout: 8000 }
      );
    } catch {
      /* môi trường không có geolocation */
    }
    return () => {
      mounted = false;
    };
  }, []);

  // ── Fetch dữ liệu: 2 nguồn (Booking Flow 1 + legacy TaskApplication) ──
  const fetchJobs = useCallback(async () => {
    try {
      const fetchedAtSec = Math.floor(Date.now() / 1000);
      const combined: any[] = [];

      // 1. Booking hệ thống ghép cặp Flow 1 — GIỮ TẤT CẢ trạng thái
      const bookingTaskIds = new Set<string>(); // N-003: task mirror của booking — lọc legacy trùng
      try {
        const bRes: any = await getBookings({ role: "carepartner" });
        const bookingsList = bRes?.results ?? bRes ?? [];
        bookingsList.forEach((b: any) => {
          if (b.task_id != null && b.task_id !== "") bookingTaskIds.add(String(b.task_id));
          combined.push({
            id: `booking_${b.id}`,
            kind: "booking",
            bookingId: b.id,
            taskId: b.task_id || null, // CARE DIARY NÂNG CẤP: dẫn đến CareDiaryForm sau khi kết thúc ca
            status: b.status,
            status_label_vi: b.status_label_vi || "",
            title: b.job_title || "Công việc ghép cặp",
            category_name_vi: b.category_name_vi || "",
            job_type: b.job_type || "",
            address: b.job_address || b.location_info?.address || "Địa điểm theo thỏa thuận",
            location_info: b.location_info || null,
            first_slot: b.first_slot || null,
            parent_name: b.parent_name || b.parent_info?.full_name || "Phụ huynh",
            parent_info: b.parent_info || null,
            total_value_vnd: b.total_value_vnd || 0,
            payout_vnd: b.carepartner_payout_vnd != null ? b.carepartner_payout_vnd : Math.round((b.total_value_vnd || 0) * 0.8),
            compensation_vnd: b.compensation_vnd || 0,
            seconds_left: typeof b.seconds_left === "number" ? b.seconds_left : 0,
            ended_at: b.ended_at || null,
            cancelled_at: b.cancelled_at || null,
            fetchedAtSec,
          });
        });
      } catch (e) {
        console.warn("Lỗi tải bookings:", e);
      }

      // 2. Việc legacy (Task/TaskApplication) — giữ tương thích ngược.
      try {
        const res: any = await getMyJobsAsWorker();
        const appsList = res ?? [];
        (Array.isArray(appsList) ? appsList : appsList?.results ?? []).forEach((a: any) => {
          if (a.status === "pending") return; // theo yêu cầu: bỏ ứng tuyển chờ duyệt
          if (a.task_id != null && bookingTaskIds.has(String(a.task_id))) return; // trùng mirror Flow 1
          combined.push({
            ...a,
            id: `legacy_${a.task_id || a.task || a.id}`,
            kind: "legacy",
            taskId: a.task_id || a.task,
            status: a.status,
            task_title: a.task_title || "Công việc",
            task_price: a.task_price || 0,
            fetchedAtSec,
          });
        });
      } catch (e) {
        console.warn("Lỗi tải applications:", e);
      }

      setItems(combined);

      // ⚡ Auto-stop tracking nếu task legacy đã completed/cancelled
      const currentTrackingTaskId = webGetCurrentTaskId();
      if (currentTrackingTaskId) {
        const trackingItem = combined.find((a) => a.kind === "legacy" && a.taskId === currentTrackingTaskId);
        if (trackingItem) {
          const st = trackingItem.task_status;
          if (st && st !== "in_progress") {
            await webStopTracking();
            setTrackingTaskId(null);
            showAlert(
              "ⓘ Theo dõi vị trí đã dừng",
              `Công việc "${trackingItem.task_title}" đã ${st === "completed" ? "hoàn thành" : "bị hủy"}. Theo dõi vị trí đã tự động dừng.`
            );
          }
        }
      }

      // Check consent cho task legacy được accept
      const acceptedLegacy = combined.filter((a) => a.kind === "legacy" && a.status === "accepted" && a.taskId);
      const consents: Record<string, any> = {};
      await Promise.all(
        acceptedLegacy.map(async (app) => {
          try {
            const r: any = await checkConsent(app.taskId);
            const c = r?.consent?.consent || (r?.has_consent ? null : "pending");
            consents[app.taskId] = c;
          } catch {
            consents[app.taskId] = null;
          }
        })
      );
      setConsentMap(consents);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Task C: kiểm tra worker đã khai skill + lịch rảnh chưa (onboarding gate)
  useEffect(() => {
    let mounted = true;
    getOnboardingStatus()
      .then((resp: any) => {
        if (!mounted) return;
        setOnboardingReady(!!resp?.ready_for_matching);
        setOnboardingMsg(resp?.message_vi || "");
      })
      .catch(() => {
        /* pending/mạng lỗi — ẩn banner */
      });
    return () => {
      mounted = false;
    };
  }, []);

  // ═══════════ PHÂN TAB & SẮP XẾP ═══════════
  const tabOf = useCallback((item: any): string => {
    if (item.kind === "booking") {
      if (BOOKING_AWAITING.includes(item.status)) return "awaiting";
      if (BOOKING_UPCOMING.includes(item.status)) return "upcoming";
      if (BOOKING_COMPLETED.includes(item.status)) return "completed";
      if (BOOKING_ENDED.includes(item.status)) return "history";
      return "history"; // trạng thái lạ → audit log cho an toàn
    }
    // legacy
    if (item.status === "rejected") return "history";
    if (item.task_status === "completed") return "completed";
    return "upcoming";
  }, []);

  const startTs = (item: any) => {
    const fs = item.first_slot;
    if (fs?.date) {
      const t = new Date(`${fs.date}T${String(fs.time_from || "00:00").slice(0, 8)}`).getTime();
      if (!isNaN(t)) return t;
    }
    const st = item.task_scheduled_time ? new Date(item.task_scheduled_time).getTime() : NaN;
    return isNaN(st) ? 0 : st;
  };

  const endTs = (item: any) => {
    const src =
      item.ended_at ||
      item.cancelled_at ||
      (item.first_slot?.date ? `${item.first_slot.date}T${String(item.first_slot.time_from || "00:00").slice(0, 8)}` : null);
    const t = src ? new Date(src).getTime() : NaN;
    return isNaN(t) ? 0 : t;
  };

  // Thời gian còn lại của cửa sổ cam kết (giây) — suy từ snapshot khi fetch
  const remainingSec = (item: any) => {
    if (item.kind !== "booking" || item.status !== "awaiting_commitment") return 0;
    return Math.max(0, (item.seconds_left || 0) - (nowSec - (item.fetchedAtSec || nowSec)));
  };

  const buildTab2List = useCallback((arr: any[]) => {
    // in_progress luôn ở đầu danh sách (việc đang xảy ra cần chú ý trước)
    const rank = (i: any) => {
      if (i.kind === "booking" && i.status === "in_progress") return 0;
      if (i.kind === "booking") return 1;
      return 2; // legacy
    };
    return [...arr].sort((a, b) => rank(a) - rank(b) || startTs(a) - startTs(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = (() => {
    const match = (i: any) => {
      const t = tabOf(i);
      if (activeTab === "history") {
        // Tab 4 = audit log: MỌI thứ đã kết thúc (gồm cả completed)
        if (t === "history" || t === "completed") {
          if (historyFilter === "done") return t === "completed" || ["completed", "awaiting_review"].includes(i.status);
          if (historyFilter === "cancelled") {
            return (
              [
                "cancelled_by_carepartner",
                "cancelled_by_parent",
                "declined_in_window",
                "expired_no_response",
                "no_show",
                "no_show_unconfirmed",
              ].includes(i.status) || i.status === "rejected"
            );
          }
          if (historyFilter === "compensation") return (i.compensation_vnd || 0) > 0;
          return true;
        }
        return false;
      }
      return t === activeTab;
    };
    const out = items.filter(match);
    if (activeTab === "upcoming") return buildTab2List(out);
    if (activeTab === "history") return [...out].sort((a, b) => endTs(b) - endTs(a)); // mới kết thúc trước
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })();

  // Badge số đếm 4 tab — cập nhật NGAY khi state items đổi (không đợi refetch)
  const badgeCounts = (() => {
    const c: Record<string, number> = { awaiting: 0, upcoming: 0, completed: 0, history: 0 };
    items.forEach((i) => {
      const t = tabOf(i);
      if (t === "completed") {
        c.completed += 1;
        c.history += 1;
      } else if (t === "history") c.history += 1;
      else c[t] += 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })();

  const totalEarned = items
    .filter((i) => (i.kind === "booking" ? i.status === "completed" : i.task_status === "completed"))
    .reduce((sum, i) => sum + parseFloat((i.kind === "booking" ? i.payout_vnd : i.task_price) || 0), 0);

  // Tự scroll tới card được highlight (Confirmation Jump — RN scrollToIndex)
  useEffect(() => {
    if (!highlightId || isLoading || activeTab !== "upcoming") return undefined;
    const t = setTimeout(() => {
      try {
        document.getElementById(`booking-card-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* element biến mất giữa chừng — bỏ qua */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [highlightId, isLoading, activeTab]);

  // ═══════════ HẾT HẠN CAM KẾT: vô hiệu hoá nút + tự đồng bộ 4s sau ═══════════
  const expiryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const expiryRefetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    items
      .filter(
        (i) =>
          i.kind === "booking" && i.status === "awaiting_commitment" && remainingSec(i) <= 0 && !expiryRefetchedRef.current.has(String(i.bookingId))
      )
      .forEach((i) => {
        expiryRefetchedRef.current.add(String(i.bookingId));
        const t = setTimeout(() => {
          // Backend đã tự huỷ đơn khi hết hạn (lazy_commit_check) — đồng bộ lại
          expiryRefetchedRef.current.delete(String(i.bookingId));
          fetchJobs();
        }, 4000);
        expiryTimersRef.current.push(t);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, nowSec, fetchJobs]);
  useEffect(
    () => () => {
      expiryTimersRef.current.forEach(clearTimeout);
      expiryTimersRef.current = [];
    },
    []
  );

  // ═══════════ XÁC NHẬN CAM KẾT (Tab 1 → Tab 2) ═══════════
  const handleCommit = async (item: any) => {
    if (committingId) return;
    setCommittingId(item.bookingId);
    try {
      await commitBooking(item.bookingId);
      // Cập nhật cục bộ NGAY (không đợi refetch toàn bộ): card chuyển tab 2
      setItems((prev) =>
        prev.map((i) =>
          i.kind === "booking" && String(i.bookingId) === String(item.bookingId)
            ? { ...i, status: "committed", status_label_vi: "Đã cam kết", seconds_left: 0 }
            : i
        )
      );
      setActiveTab("upcoming"); // tab active tự đổi sang "Sắp làm"
      showAlert("Thành công", "Đã cam kết nhận đơn! Ca làm đã chuyển sang mục Sắp làm.");
    } catch (e: any) {
      // Card giữ nguyên ở Tab 1 (không optimistic-update kẹt)
      showAlert("Không thể xác nhận", e?.response?.data?.detail || "Không thể xác nhận lúc này, vui lòng thử lại.");
    } finally {
      setCommittingId(null);
    }
  };

  // ═══════════ TỪ CHỐI NHẬN ĐƠN (modal lý do) ═══════════
  const openRejectModal = (item: any) => {
    setRejectReason("school_schedule");
    setRejectNote("");
    setRejectTarget(item);
  };

  const submitReject = async () => {
    if (!rejectTarget || rejectLoading) return;
    const reason = CANCEL_REASONS.find((r) => r.code === rejectReason);
    if (reason?.forceMajeure && rejectNote.trim().length > 0 && rejectNote.trim().length < 20) {
      showAlert("Lý do bất khả kháng", "Cần ghi chú ít nhất 20 ký tự để minh bạch với phụ huynh.");
      return;
    }
    setRejectLoading(true);
    try {
      await cancelBooking(rejectTarget.bookingId, {
        reason_code: rejectReason,
        note: rejectNote.trim(),
        evidence: [],
      });
      const rejectedId = String(rejectTarget.bookingId);
      setItems((prev) =>
        prev.map((i) =>
          i.kind === "booking" && String(i.bookingId) === rejectedId
            ? { ...i, status: "cancelled_by_carepartner", status_label_vi: "Bạn đã từ chối nhận ca" }
            : i
        )
      );
      setRejectTarget(null);
      setRejectNote("");
      showAlert(
        "Đã từ chối nhận đơn",
        "Hệ thống đã mở lại ca cho sinh viên khác mà không trừ điểm ELO. Bạn có thể xem lại đơn trong tab Lịch sử."
      );
    } catch (e: any) {
      showAlert("Không thể từ chối", e?.response?.data?.detail || "Không thể từ chối lúc này, vui lòng thử lại.");
    } finally {
      setRejectLoading(false);
    }
  };

  // ═══════════ ĐỔI GIỜ (Tab 2 — committed) ═══════════
  const openRescheduleModal = (item: any) => {
    setRescheduleDate(tomorrowStr());
    setRescheduleFrom("17:00");
    setRescheduleTo("19:00");
    setRescheduleReason("");
    setRescheduleTarget(item);
  };

  const submitReschedule = async () => {
    if (!rescheduleTarget || rescheduleLoading) return;
    if (!rescheduleDate || !rescheduleFrom || !rescheduleTo) {
      showAlert("Thiếu thông tin", "Vui lòng nhập ngày và giờ mới (ví dụ 2026-09-20, 17:00 - 19:00).");
      return;
    }
    setRescheduleLoading(true);
    try {
      await requestReschedule(rescheduleTarget.bookingId, {
        date: rescheduleDate,
        time_from: rescheduleFrom,
        time_to: rescheduleTo,
        reason: rescheduleReason.trim(),
      });
      setRescheduleTarget(null);
      showAlert("Đã gửi yêu cầu", "Phụ huynh sẽ nhận được yêu cầu đổi giờ của bạn và phản hồi trong thời hạn quy định.");
      fetchJobs();
    } catch (e: any) {
      showAlert("Không gửi được yêu cầu", e?.response?.data?.detail || "Không gửi được yêu cầu đổi giờ, vui lòng thử lại.");
    } finally {
      setRescheduleLoading(false);
    }
  };

  // ═══════════ KẾT THÚC CA (booking in_progress) ═══════════
  const [completingId, setCompletingId] = useState<any>(null);
  const handleComplete = async (item: any) => {
    if (completingId) return;
    setCompletingId(item.bookingId);
    try {
      await completeBooking(item.bookingId);
      setItems((prev) =>
        prev.map((i) =>
          i.kind === "booking" && String(i.bookingId) === String(item.bookingId)
            ? { ...i, status: "awaiting_review", status_label_vi: "Chờ phụ huynh đánh giá" }
            : i
        )
      );
      setActiveTab("completed");
      // CARE DIARY NÂNG CẤP — Post-Job Trigger: ngay sau khi hoàn thành ca,
      // mời CarePartner viết nhật ký đánh giá. RN Alert 2 nút → window.confirm
      // (OK = "Viết nhật ký ngay", Cancel = "Để sau" — không chặn luồng).
      if (item.taskId) {
        const goDiary = window.confirm(
          "Đã hoàn thành ca làm\n\nBạn đã hoàn thành ca làm! Vui lòng dành 2 phút viết Nhật ký đánh giá buổi học/chăm sóc để gửi phụ huynh.\n\n(OK = Viết nhật ký ngay · Cancel = Để sau)"
        );
        if (goDiary) {
          nav.navigate("CareDiaryForm", {
            taskId: item.taskId,
            taskTitle: item.title,
          });
        }
      } else {
        // Fallback: booking thiếu task mirror → giữ alert cũ, không kẹt UX.
        showAlert("Đã hoàn thành ca làm", "Tiền công sẽ được giải ngân qua Escrow sau khi ca được xác nhận.");
      }
    } catch (e: any) {
      showAlert("Không hoàn thành được", e?.response?.data?.detail || "Không kết thúc được ca lúc này, vui lòng thử lại.");
    } finally {
      setCompletingId(null);
    }
  };

  // ═══════════ TRACKING (legacy Task) ═══════════
  const handleOpenConsent = (app: any) => {
    setConsentTask(app);
    setConsentModalVisible(true);
  };

  const handleConsentChoice = async (granted: boolean) => {
    setConsentModalVisible(false);
    if (!consentTask) return;
    const taskId = consentTask.taskId;
    setConsentMap((prev) => ({ ...prev, [taskId]: granted ? "granted" : "denied" }));
    if (granted) {
      const ok = await webStartTracking(taskId);
      if (ok) {
        setTrackingTaskId(taskId);
        showAlert("✅ Đã bật chia sẻ vị trí", "Phụ huynh sẽ thấy vị trí của bạn khi đang làm việc.");
      } else {
        showAlert("⚠️ Không thể bật", "Không có quyền truy cập vị trí. Vui lòng cấp quyền trong Settings.");
      }
    }
    setConsentTask(null);
  };

  const fetchSOSAlerts = async (taskId: any) => {
    try {
      const r: any = await getSOSAlerts(taskId);
      setSosAlertsMap((prev) => ({ ...prev, [taskId]: r || [] }));
    } catch (e) {
      console.error("fetchSOSAlerts error:", e);
    }
  };

  const handleTriggerSOS = async () => {
    if (!sosModal?.taskId) return;
    setSosLoading(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        // RN: LocationService.getCurrentLocation(); web: geolocation 1 lần
        if (webLastCoords.latitude != null) {
          lat = webLastCoords.latitude;
          lng = webLastCoords.longitude;
        } else if (typeof navigator !== "undefined" && navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                resolve();
              },
              () => resolve(),
              { timeout: 4000 }
            );
          });
        }
      } catch {
        /* ignore */
      }
      await triggerSOS({
        task_id: sosModal.taskId,
        latitude: lat,
        longitude: lng,
        message: sosMessage.trim(),
      });
      showAlert("🆘 Đã gửi SOS", "Phụ huynh đã nhận được cảnh báo khẩn cấp.");
      setSosModal(null);
      setSosMessage("");
      fetchSOSAlerts(sosModal.taskId);
    } catch (e: any) {
      showAlert("Lỗi", e?.response?.data?.error || "Gửi SOS thất bại.");
    } finally {
      setSosLoading(false);
    }
  };

  // ═══════════ CARD RENDERER helpers ═══════════
  const openMaps = (item: any) => {
    const loc = item.location_info || {};
    let url;
    if (loc.latitude != null && loc.longitude != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address || "")}`;
    }
    openURL(url, () => showAlert("Lỗi", "Không mở được bản đồ."));
  };

  const slotTimeText = (item: any) => {
    const fs = item.first_slot;
    if (!fs) return "Chưa có lịch cụ thể";
    const parts: string[] = [];
    if (fs.date_vi) parts.push(fs.date_vi);
    else if (fs.date) parts.push(fs.date);
    if (fs.time_from || fs.time_to)
      parts.push(`${String(fs.time_from || "").slice(0, 5)} - ${String(fs.time_to || "").slice(0, 5)}`);
    if (fs.day_of_week_vi) parts.unshift(fs.day_of_week_vi);
    return parts.join(" · ") || "Chưa có lịch cụ thể";
  };

  const distanceText = (item: any) => {
    const loc = item.location_info || {};
    if (!deviceCoords || loc.latitude == null || loc.longitude == null) return "";
    const km = haversineKm(deviceCoords.lat, deviceCoords.lng, loc.latitude, loc.longitude);
    return `· cách bạn ~${km.toFixed(1)} km`;
  };

  const renderItem = (item: any) => {
    const st = STATUS_STYLE[item.status] || STATUS_STYLE.rejected;
    const isHighlighted = item.kind === "booking" && highlightId && String(item.bookingId) === String(highlightId);
    const distance = distanceText(item);

    const cardBase: React.CSSProperties = {
      background: COLORS.surface,
      borderRadius: SIZES.radiusMd,
      padding: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      boxShadow: SHADOWS.cardHover,
      cursor: "pointer",
    };

    // ═══ TAB 1 — ĐƠN CHỜ XÁC NHẬN ═══
    if (item.kind === "booking" && item.status === "awaiting_commitment") {
      const remaining = remainingSec(item);
      const expired = remaining <= 0;
      const urgent = !expired && remaining < URGENT_THRESHOLD_SEC;
      const isCommitting = String(committingId) === String(item.bookingId);
      return (
        <Touchable
          key={String(item.id)}
          id={`booking-card-${item.bookingId}`} /* CROSS-REVIEW FIX (7-b): scroll highlight cần element id */
          activeOpacity={0.95}
          onPress={() => nav.navigate("BookingDetail", { bookingId: item.bookingId })}
          style={{
            ...cardBase,
            borderLeft: "4px solid #F59E0B", // styles.cardAwaiting
            // styles.cardHighlighted: nền #FFF8F3 + viền primary (borderLeft 4 giữ như RN)
            ...(isHighlighted
              ? { background: "#FFF8F3", border: `2px solid ${COLORS.primary}`, borderLeft: "4px solid #F59E0B" }
              : {}),
          }}
        >
          {/* Countdown */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              padding: "7px 10px",
              borderRadius: SIZES.radiusSm,
              background: expired ? COLORS.errorBg : urgent ? COLORS.errorBg : COLORS.warningBg,
            }}
          >
            <Icon name={expired ? "alert-circle" : ic("hourglass")} size={15} color={expired ? COLORS.error : urgent ? COLORS.error : "#B45309"} />
            {expired ? (
              <span style={{ ...TYPO.caption, fontWeight: 800, flex: 1, color: COLORS.error }}>Đã hết hạn xác nhận</span>
            ) : (
              <span style={{ ...TYPO.caption, fontWeight: 800, flex: 1, color: urgent ? COLORS.error : "#B45309" }}>
                Còn {formatCountdown(remaining)} để xác nhận
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: st.bg,
                boxShadow: SHADOWS.small,
                flexShrink: 0,
              }}
            >
              <Icon name={ic(st.icon)} size={20} color={st.color} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div
                  style={{
                    borderRadius: SIZES.radiusXs,
                    padding: "3px 8px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    background: st.bg,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: st.color }} />
                  <span style={{ ...TYPO.overline, color: st.color }}>{item.status_label_vi || st.label}</span>
                </div>
                <span style={{ ...TYPO.h4, fontWeight: 900, color: COLORS.primary }}>{fmtVnd(item.payout_vnd)}</span>
              </div>
              <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700, ...clamp(1) }}>{item.title}</div>
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name={ic("book-outline")} size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>
                  {item.category_name_vi || "Dịch vụ chăm sóc"} · {slotTimeText(item)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="location-outline" size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>
                  {item.address} {distance}
                </span>
              </div>
            </div>
          </div>

          {/* Phụ huynh + badge xác minh + escrow */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              background: COLORS.primaryLight,
              borderRadius: SIZES.radiusSm,
              padding: 10,
              boxShadow: SHADOWS.small,
              border: `1px solid ${COLORS.primarySoft}`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: COLORS.primary,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: SHADOWS.small,
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#fff", ...TYPO.buttonSmall }}>{item.parent_name?.[0]?.toUpperCase() || "P"}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...TYPO.overline, color: COLORS.textMuted, fontWeight: 600 }}>Phụ huynh</div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700 }}>{item.parent_name}</span>
                {item.parent_info?.is_verified ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                      background: "#CFFAFE",
                      borderRadius: 8,
                      padding: "2px 6px",
                    }}
                  >
                    <Icon name="shield-checkmark" size={10} color="#0E7490" />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#0E7490" }}>CCCD đã xác minh</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                background: "#FEF3C7",
                borderRadius: 8,
                padding: "3px 6px",
                border: "1px solid #FDE68A",
                flexShrink: 0,
              }}
            >
              <Icon name={ic("lock-closed")} size={11} color="#B45309" />
              <span style={{ fontSize: 9, fontWeight: 800, color: "#B45309" }}>MoMo Escrow bảo đảm</span>
            </div>
          </div>

          <div style={{ ...TYPO.bodySmall, color: COLORS.textSecondary }}>
            Thu nhập ròng dự kiến: <span style={{ ...TYPO.caption, color: COLORS.primary, fontWeight: 800 }}>{fmtVnd(item.payout_vnd)}</span>
          </div>

          {/* 2 nút hành động */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Touchable
              // CROSS-REVIEW FIX (7-b): thiếu stopPropagation — click bọt lên card onPress → navigate('BookingDetail')
              // chạy cùng lúc → MyJobs unmount (RootNavigator chỉ mount route top) → modal Từ chối không bao giờ mở (RN: touchable con không kích hoạt cha).
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                openRejectModal(item);
              }}
              disabled={expired || isCommitting}
              activeOpacity={0.85}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "11px 0",
                borderRadius: SIZES.radiusSm,
                background: "#F1F5F9",
                border: "1px solid #E2E8F0",
                opacity: expired ? 0.5 : 1,
              }}
            >
              <Icon name={ic("close-circle-outline")} size={16} color="#475569" />
              <span style={{ ...TYPO.buttonSmall, color: "#475569" }}>Từ chối</span>
            </Touchable>
            <Touchable
              // CROSS-REVIEW FIX (7-b): thiếu stopPropagation — commit xong bị navigate sang BookingDetail thay vì ở lại chuyển tab "Sắp làm" như RN.
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                handleCommit(item);
              }}
              disabled={expired || isCommitting}
              activeOpacity={0.85}
              style={{
                flex: 1.6,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "11px 0",
                borderRadius: SIZES.radiusSm,
                background: COLORS.primary,
                boxShadow: SHADOWS.small,
                opacity: expired || isCommitting ? 0.55 : 1,
              }}
            >
              {isCommitting ? (
                <Spinner size={16} color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={16} color="#fff" />
                  <span style={{ ...TYPO.buttonSmall, color: "#fff", fontWeight: 800 }}>Xác nhận cam kết</span>
                </>
              )}
            </Touchable>
          </div>
        </Touchable>
      );
    }

    // ═══ TAB 2 — SẮP LÀM (committed | in_progress) ═══
    if (item.kind === "booking" && ["committed", "in_progress", "reschedule_requested", "suspected_no_show"].includes(item.status)) {
      const isInProgress = item.status === "in_progress";
      const isCompleting = String(completingId) === String(item.bookingId);
      const phone = item.parent_info?.phone || "";
      return (
        <Touchable
          key={String(item.id)}
          id={`booking-card-${item.bookingId}`} /* CROSS-REVIEW FIX (7-b): scroll highlight cần element id */
          activeOpacity={0.95}
          onPress={() => nav.navigate("BookingDetail", { bookingId: item.bookingId })}
          style={{
            ...cardBase,
            borderLeft: `4px solid ${isInProgress ? "#0284C7" : COLORS.primary}`,
            ...(isInProgress ? { border: "1.5px solid #7DD3FC", borderLeft: "4px solid #0284C7" } : {}),
            ...(isHighlighted
              ? {
                  background: "#FFF8F3",
                  border: `2px solid ${COLORS.primary}`,
                  borderLeft: `4px solid ${isInProgress ? "#0284C7" : COLORS.primary}`,
                }
              : {}),
          }}
        >
          {isInProgress && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                background: "#ECFDF5",
                borderRadius: SIZES.radiusSm,
                padding: "8px 10px",
                border: "1.5px solid #6EE7B7",
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 5, background: "#10B981", flexShrink: 0 }} />
              <span style={{ ...TYPO.caption, color: "#065F46", flex: 1 }}>Ca đang diễn ra — chúc bạn làm việc thuận lợi!</span>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: st.bg,
                boxShadow: SHADOWS.small,
                flexShrink: 0,
              }}
            >
              <Icon name={ic(st.icon)} size={20} color={st.color} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div
                  style={{
                    borderRadius: SIZES.radiusXs,
                    padding: "3px 8px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    background: st.bg,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: st.color }} />
                  <span style={{ ...TYPO.overline, color: st.color }}>{item.status_label_vi || st.label}</span>
                </div>
                <span style={{ ...TYPO.h4, fontWeight: 900, color: COLORS.primary }}>{fmtVnd(item.payout_vnd)}</span>
              </div>
              <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700, ...clamp(1) }}>{item.title}</div>
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="time-outline" size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>{slotTimeText(item)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="location-outline" size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1, ...clamp(1) }}>
                  {item.address} {distance}
                </span>
              </div>
            </div>
          </div>

          {/* Liên hệ phụ huynh — số thật sau khi cam kết */}
          {item.parent_info && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                background: COLORS.primaryLight,
                borderRadius: SIZES.radiusSm,
                padding: 10,
                boxShadow: SHADOWS.small,
                border: `1px solid ${COLORS.primarySoft}`,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  background: COLORS.primary,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: SHADOWS.small,
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "#fff", ...TYPO.buttonSmall }}>{item.parent_name?.[0]?.toUpperCase() || "P"}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...TYPO.overline, color: COLORS.textMuted, fontWeight: 600 }}>Phụ huynh</div>
                <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700 }}>{item.parent_name}</div>
                {phone ? <div style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, fontWeight: 700 }}>{phone}</div> : null}
              </div>
              {phone ? (
                <div style={{ display: "flex", flexDirection: "row", gap: 8, flexShrink: 0 }}>
                  <Touchable
                    onPress={(e?: any) => {
                      e?.stopPropagation?.();
                      openURL(`tel:${phone}`);
                    }}
                    activeOpacity={0.85}
                    style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#ECFDF5" }}
                  >
                    <Icon name={ic("call")} size={16} color={COLORS.success} />
                  </Touchable>
                  <Touchable
                    onPress={(e?: any) => {
                      e?.stopPropagation?.();
                      openURL(`sms:${phone}`);
                    }}
                    activeOpacity={0.85}
                    style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#EFF6FF" }}
                  >
                    <Icon name={ic("chatbubble")} size={16} color="#2563EB" />
                  </Touchable>
                </div>
              ) : null}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {!isInProgress && (
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  openRescheduleModal(item);
                }}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 0",
                  borderRadius: SIZES.radiusSm,
                  background: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                }}
              >
                <Icon name={ic("swap-horizontal")} size={15} color="#475569" />
                <span style={{ ...TYPO.buttonSmall, color: "#475569", fontSize: 12 }}>Báo bận / Đổi giờ</span>
              </Touchable>
            )}
            <Touchable
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                nav.navigate("BookingDetail", { bookingId: item.bookingId });
              }}
              activeOpacity={0.85}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: SIZES.radiusSm,
                background: COLORS.primaryLight,
                border: `1px solid ${COLORS.primarySoft}`,
              }}
            >
              <Icon name="document-text-outline" size={15} color={COLORS.primary} />
              <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontSize: 12 }}>Xem chi tiết ca làm</span>
            </Touchable>
          </div>
          {isInProgress && (
            <Touchable
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                handleComplete(item);
              }}
              disabled={isCompleting}
              activeOpacity={0.85}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "11px 0",
                borderRadius: SIZES.radiusSm,
                background: "#0E9F6E",
                boxShadow: SHADOWS.small,
                marginTop: 8,
                opacity: isCompleting ? 0.55 : 1,
              }}
            >
              {isCompleting ? (
                <Spinner size={16} color="#fff" />
              ) : (
                <>
                  <Icon name={ic("checkmark-done")} size={16} color="#fff" />
                  <span style={{ ...TYPO.buttonSmall, color: "#fff", fontWeight: 800 }}>Kết thúc ca & nhận tiền</span>
                </>
              )}
            </Touchable>
          )}
        </Touchable>
      );
    }

    // ═══ TAB 3 — ĐÃ HOÀN THÀNH (booking) ═══
    if (item.kind === "booking" && ["completed", "awaiting_review"].includes(item.status)) {
      return (
        <Touchable
          key={String(item.id)}
          activeOpacity={0.95}
          onPress={() => nav.navigate("BookingDetail", { bookingId: item.bookingId })}
          style={{ ...cardBase, borderLeft: `4px solid ${COLORS.primary}` }}
        >
          <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: st.bg,
                boxShadow: SHADOWS.small,
                flexShrink: 0,
              }}
            >
              <Icon name={ic(st.icon)} size={20} color={st.color} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <div
                  style={{
                    borderRadius: SIZES.radiusXs,
                    padding: "3px 8px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    background: st.bg,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: st.color }} />
                  <span style={{ ...TYPO.overline, color: st.color }}>{item.status_label_vi || st.label}</span>
                </div>
                <span style={{ ...TYPO.h4, fontWeight: 900, color: COLORS.success }}>{fmtVnd(item.payout_vnd)}</span>
              </div>
              <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700, ...clamp(1) }}>{item.title}</div>
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="time-outline" size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>
                  {item.ended_at ? `Hoàn thành lúc ${fmtDateTime(item.ended_at)}` : slotTimeText(item)}
                </span>
              </div>
              {/* Đánh giá: booking payload chưa có review → hiển thị rõ, không để trống */}
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="star-outline" size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>Phụ huynh chưa đánh giá</span>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              background: COLORS.successBg,
              borderRadius: SIZES.radiusSm,
              padding: "8px 10px",
              border: "1px solid #bbf7d0",
            }}
          >
            <Icon name="wallet" size={13} color={COLORS.successDeep || COLORS.success} />
            <span style={{ ...TYPO.caption, color: COLORS.successDeep || COLORS.success }}>
              Tiền đã vào ví CarePartner · {fmtVnd(item.payout_vnd)}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Touchable
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                nav.navigate("BookingDetail", { bookingId: item.bookingId });
              }}
              activeOpacity={0.85}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: SIZES.radiusSm,
                background: COLORS.primaryLight,
                border: `1px solid ${COLORS.primarySoft}`,
              }}
            >
              <Icon name="receipt-outline" size={15} color={COLORS.primary} />
              <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontSize: 12 }}>Xem biên lai ca làm</span>
            </Touchable>
          </div>
        </Touchable>
      );
    }

    // ═══ TAB 4 / legacy — LỊCH SỬ (audit log) ═══
    const isLegacy = item.kind === "legacy";
    return (
      <Touchable
        key={String(item.id)}
        activeOpacity={0.95}
        onPress={() => {
          if (!isLegacy) nav.navigate("BookingDetail", { bookingId: item.bookingId });
          else if (item.taskId) nav.navigate("TaskDetail", { taskId: item.taskId });
        }}
        style={{ ...cardBase, borderLeft: `4px solid ${COLORS.primary}` }}
      >
        <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: st.bg,
              boxShadow: SHADOWS.small,
              flexShrink: 0,
            }}
          >
            <Icon name={ic(st.icon)} size={20} color={st.color} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <div
                style={{
                  borderRadius: SIZES.radiusXs,
                  padding: "3px 8px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  background: st.bg,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: 3, background: st.color }} />
                <span style={{ ...TYPO.overline, color: st.color }}>{item.status_label_vi || st.label}</span>
              </div>
              <span style={{ ...TYPO.h4, fontWeight: 900, color: COLORS.primary }}>
                {(item.compensation_vnd || 0) > 0
                  ? `+${fmtVnd(item.compensation_vnd)}`
                  : fmtVnd(item.kind === "booking" ? item.payout_vnd : item.task_price)}
              </span>
            </div>
            <div style={{ ...TYPO.h5, color: COLORS.textPrimary, fontWeight: 700, ...clamp(1) }}>
              {item.kind === "booking" ? item.title : item.task_title}
            </div>
            <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Icon name="time-outline" size={13} color={COLORS.textMuted} />
              <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>
                {item.kind === "booking"
                  ? item.cancelled_at
                    ? `${item.status_label_vi || st.label} · ${fmtDateTime(item.cancelled_at)}`
                    : slotTimeText(item)
                  : item.task_scheduled_time
                  ? new Date(item.task_scheduled_time).toLocaleString("vi-VN")
                  : "Chưa có"}
              </span>
            </div>
            {item.kind === "booking" && (item.ended_at || item.cancelled_at) ? (
              <div style={{ display: "flex", flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Icon name="flag-outline" size={13} color={COLORS.textMuted} />
                <span style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, flex: 1 }}>
                  Kết thúc: {fmtDateTime(item.ended_at || item.cancelled_at)}
                </span>
              </div>
            ) : null}
            {(item.compensation_vnd || 0) > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  background: "#FEF3C7",
                  borderRadius: 8,
                  padding: "3px 8px",
                  alignSelf: "flex-start",
                  border: "1px solid #FDE68A",
                }}
              >
                <Icon name={ic("cash")} size={12} color="#B45309" />
                <span style={{ fontSize: 10, fontWeight: 800, color: "#B45309" }}>Bồi thường: +{fmtVnd(item.compensation_vnd)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Kháng cáo ELO cho các đơn bị hủy / no-show */}
        {item.kind === "booking" &&
          ["cancelled_by_carepartner", "no_show", "no_show_unconfirmed", "suspected_no_show"].includes(item.status) && (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  nav.navigate("Appeal", { bookingId: item.bookingId });
                }}
                activeOpacity={0.85}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 12px",
                  borderRadius: SIZES.radiusSm,
                  background: "#FEF3C7",
                  border: "1px solid #FDE68A",
                }}
              >
                <Icon name="megaphone-outline" size={14} color="#B45309" />
                <span style={{ ...TYPO.caption, color: "#B45309", fontWeight: 700 }}>Kháng cáo ELO</span>
              </Touchable>
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  nav.navigate("BookingDetail", { bookingId: item.bookingId });
                }}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 0",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.primaryLight,
                  border: `1px solid ${COLORS.primarySoft}`,
                }}
              >
                <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontSize: 12 }}>Chi tiết</span>
              </Touchable>
            </div>
          )}

        {/* Việc legacy ĐANG HOẠT ĐỘNG (Sắp làm): nhật ký + chat + tracking + SOS */}
        {isLegacy && item.status === "accepted" && item.task_status !== "completed" && (
          <>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  nav.navigate("CareDiaryForm", { taskId: item.taskId, taskTitle: item.task_title });
                }}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 0",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.primaryLight,
                  border: `1px solid ${COLORS.primarySoft}`,
                }}
              >
                <Icon name={ic("book-outline")} size={15} color={COLORS.primary} />
                <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontSize: 12 }}>Ghi nhật ký chăm sóc</span>
              </Touchable>
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  nav.navigate("Chat", { taskId: item.taskId, taskTitle: item.task_title });
                }}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px 0",
                  borderRadius: SIZES.radiusSm,
                  background: "#3B82F6",
                }}
              >
                <Icon name={ic("chatbubble-outline")} size={15} color="#fff" />
                <span style={{ ...TYPO.buttonSmall, color: "#fff", fontSize: 12 }}>Nhắn tin với phụ huynh</span>
              </Touchable>
            </div>
            {trackingTaskId === item.taskId ? (
              <ActiveTrackingBanner
                taskId={item.taskId}
                taskTitle={item.task_title}
                onStopped={() => {
                  setTrackingTaskId(null);
                  setConsentMap((prev) => ({ ...prev, [item.taskId]: "revoked" }));
                }}
              />
            ) : consentMap[item.taskId] === "granted" ? (
              <Touchable
                onPress={async (e?: any) => {
                  e?.stopPropagation?.();
                  const ok = await webStartTracking(item.taskId);
                  if (ok) setTrackingTaskId(item.taskId);
                  else showAlert("⚠️ Không thể bật", "Không có quyền truy cập vị trí.");
                }}
                activeOpacity={0.85}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 0",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.primaryLight,
                  border: `1px solid ${COLORS.primarySoft}`,
                }}
              >
                <Icon name={ic("play-circle")} size={16} color={COLORS.success} />
                <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontWeight: 700 }}>Bắt đầu chia sẻ vị trí</span>
              </Touchable>
            ) : (
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  handleOpenConsent(item);
                }}
                activeOpacity={0.85}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 0",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.primaryLight,
                  border: `1px solid ${COLORS.primarySoft}`,
                }}
              >
                <Icon name="location-outline" size={16} color={COLORS.primary} />
                <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontWeight: 700 }}>Đồng ý chia sẻ vị trí</span>
              </Touchable>
            )}
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Touchable
                onPress={(e?: any) => {
                  e?.stopPropagation?.();
                  setSosModal({ taskId: item.taskId, taskTitle: item.task_title });
                  fetchSOSAlerts(item.taskId);
                }}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: COLORS.error,
                  borderRadius: SIZES.radiusSm,
                  padding: "10px 0",
                  boxShadow: SHADOWS.small,
                }}
              >
                <Icon name="warning" size={16} color="#fff" />
                <span style={{ color: "#fff", ...TYPO.buttonSmall, fontWeight: 800 }}>SOS khẩn cấp</span>
              </Touchable>
              {(sosAlertsMap[item.taskId] || []).filter((a) => a.status === "active").length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    background: COLORS.errorBg,
                    borderRadius: 10,
                    padding: "4px 8px",
                    border: "1px solid #fecaca",
                  }}
                >
                  <Icon name="alert-circle" size={11} color={COLORS.error} />
                  <span style={{ ...TYPO.overline, color: COLORS.error, fontWeight: 800, fontSize: 9 }}>
                    {(sosAlertsMap[item.taskId] || []).filter((a) => a.status === "active").length} SOS active
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Việc legacy hoàn thành: nhật ký + chat 24h */}
        {isLegacy && item.task_status === "completed" && (
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Touchable
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                nav.navigate("CareDiaryForm", { taskId: item.taskId, taskTitle: item.task_title });
              }}
              activeOpacity={0.85}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: SIZES.radiusSm,
                background: COLORS.primaryLight,
                border: `1px solid ${COLORS.primarySoft}`,
              }}
            >
              <Icon name={ic("book-outline")} size={15} color={COLORS.primary} />
              <span style={{ ...TYPO.buttonSmall, color: COLORS.primary, fontSize: 12 }}>Ghi nhật ký chăm sóc</span>
            </Touchable>
            <Touchable
              onPress={(e?: any) => {
                e?.stopPropagation?.();
                nav.navigate("Chat", { taskId: item.taskId, taskTitle: item.task_title });
              }}
              activeOpacity={0.85}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 0",
                borderRadius: SIZES.radiusSm,
                background: "#3B82F6",
              }}
            >
              <Icon name={ic("chatbubble-outline")} size={15} color="#fff" />
              <span style={{ ...TYPO.buttonSmall, color: "#fff", fontSize: 12 }}>Chat (24h)</span>
            </Touchable>
          </div>
        )}
      </Touchable>
    );
  };

  const emptyStates: Record<string, { icon: string; title: string; text: string }> = {
    awaiting: {
      icon: "hourglass-outline",
      title: "Không có đơn nào chờ xác nhận",
      text: "Khi phụ huynh chọn bạn cho một ca làm mới, đơn sẽ xuất hiện tại đây kèm thời gian đếm ngược để bạn xác nhận.",
    },
    upcoming: {
      icon: "briefcase-outline",
      title: "Chưa có ca làm sắp tới",
      text: "Khi bạn bấm Xác nhận các đơn ở tab Chờ xác nhận, ca làm sẽ xuất hiện tại đây.",
    },
    completed: {
      icon: "checkmark-done-outline",
      title: "Chưa có ca nào hoàn thành",
      text: "Các ca đã hoàn thành cùng thu nhập thực nhận sẽ được lưu tại đây.",
    },
    history: {
      icon: "time-outline",
      title: "Chưa có lịch sử công việc",
      text: "Toàn bộ các ca đã hoàn thành, đã hủy hoặc đã từ chối sẽ hiển thị tại đây.",
    },
  };

  const HISTORY_FILTERS = [
    { key: "all", label: "Tất cả" },
    { key: "done", label: "Hoàn thành" },
    { key: "cancelled", label: "Đã hủy" },
    { key: "compensation", label: "Bồi thường" },
  ];

  return (
    <Screen bg={COLORS.background} scroll={false}>
      {/* Placeholder màu = COLORS.textMuted như RN placeholderTextColor */}
      <style>{`.edc-sos-input::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>
      {/* RN StatusBar dark-content + NotificationBell dark được port tại header */}
      <div style={{ background: COLORS.surface, flexShrink: 0 }}>
        <StatusBarSpacer />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 20px 14px",
          }}
        >
        <div style={{ ...TYPO.h1, fontSize: 24, color: COLORS.textPrimary }}>Việc của tôi</div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: SIZES.sm }}>
          {/* NotificationBell dark — 42×42 nền background + icon tối (port styles.bellBtnDark) */}
          <MyJobsBell />
          {totalEarned > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 6,
                alignItems: "center",
                background: COLORS.successBg,
                borderRadius: SIZES.radiusXl,
                padding: "7px 14px",
                border: "1px solid #bbf7d0",
                boxShadow: SHADOWS.small,
              }}
            >
              <Icon name="wallet-outline" size={14} color={COLORS.success} />
              <span style={{ ...TYPO.buttonSmall, color: COLORS.success }}>{Math.round(totalEarned).toLocaleString("vi-VN")}đ</span>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Task C — banner onboarding khi thiếu skill / lịch rảnh */}
      {!onboardingReady && !!onboardingMsg && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 10,
            margin: "12px 16px 0",
            padding: 12,
            borderRadius: 14,
            background: "#FEF3C7",
            border: "1px solid #FDE68A",
            flexShrink: 0,
          }}
        >
          <Icon name="warning" size={18} color="#B45309" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#B45309" }}>Hoàn thiện hồ sơ để nhận việc</div>
            <div style={{ marginTop: 2, fontSize: 12, color: "#92400E", lineHeight: "17px" }}>{onboardingMsg}</div>
            <Touchable
              onPress={() => nav.navigate("MatchingAvailability")}
              activeOpacity={0.8}
              style={{ marginTop: 8, alignSelf: "flex-start", background: "#F26522", borderRadius: 10, padding: "7px 14px" }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Khai ngay</span>
            </Touchable>
          </div>
        </div>
      )}

      {/* 4 pill tab vòng đời — active nền #F26522 chữ trắng (Stitch) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          background: COLORS.surface,
          padding: "0 10px 12px",
          gap: 6,
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = badgeCounts[tab.key] || 0;
          return (
            <Touchable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                padding: "9px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 4,
                borderRadius: 999,
                background: isActive ? COLORS.primary : COLORS.background,
                border: "1px solid transparent",
                boxShadow: isActive ? SHADOWS.small : undefined,
              }}
            >
              <Icon name={ic(tab.icon)} size={14} color={isActive ? "#fff" : COLORS.textMuted} />
              <span
                style={{
                  ...TYPO.caption,
                  fontSize: 11,
                  color: isActive ? "#fff" : COLORS.textMuted,
                  fontWeight: isActive ? 800 : TYPO.caption.fontWeight,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {tab.label}
              </span>
              <div
                style={{
                  minWidth: 17,
                  height: 17,
                  borderRadius: 9,
                  padding: "0 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isActive ? "#fff" : "#E2E8F0",
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 800, color: isActive ? COLORS.primary : "#64748B" }}>{count}</span>
              </div>
            </Touchable>
          );
        })}
      </div>

      {/* Chip lọc nhanh — chỉ tab Lịch sử */}
      {activeTab === "history" && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 8,
            padding: "10px 16px 0",
            flexShrink: 0,
          }}
        >
          {HISTORY_FILTERS.map((f) => {
            const on = historyFilter === f.key;
            return (
              <Touchable
                key={f.key}
                onPress={() => setHistoryFilter(f.key)}
                activeOpacity={0.8}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: on ? COLORS.primaryLight : COLORS.surface,
                  border: `1px solid ${on ? COLORS.primarySoft : COLORS.border}`,
                }}
              >
                <span style={{ ...TYPO.overline, color: on ? COLORS.primary : COLORS.textSecondary }}>{f.label}</span>
              </Touchable>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <Spinner size={22} color={COLORS.primary} />
        </div>
      ) : (
        /* FlatList — RN contentContainerStyle {padding: SIZES.md, gap: 12, paddingBottom: 110} → pb 84 */
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
          <div style={{ padding: 16, paddingBottom: 84, display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12, padding: "60px 30px 0" }}>
                <Icon name={ic(emptyStates[activeTab].icon)} size={40} color={COLORS.primary} />
                <div style={{ ...TYPO.h4, color: COLORS.textPrimary, textAlign: "center" }}>{emptyStates[activeTab].title}</div>
                <div style={{ ...TYPO.bodySmall, color: COLORS.textMuted, textAlign: "center" }}>{emptyStates[activeTab].text}</div>
              </div>
            ) : (
              filtered.map((item) => renderItem(item))
            )}
          </div>
        </div>
      )}

      {/* Tracking Consent Modal (legacy Task) */}
      <TrackingConsentModal
        visible={consentModalVisible}
        taskId={consentTask?.taskId}
        parentName={consentTask?.parent_username}
        taskTitle={consentTask?.task_title}
        onConsent={handleConsentChoice}
        onClose={() => setConsentModalVisible(false)}
      />

      {/* SOS Modal (legacy Task) — bổ sung hàng hotline theo Task 5-d */}
      {sosModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            padding: 24,
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: COLORS.surface,
              borderRadius: SIZES.radiusLg,
              padding: 20,
              boxShadow: SHADOWS.large,
              width: "100%",
              maxWidth: 420,
              animation: "edc-fade-in-up 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Icon name="warning" size={28} color={COLORS.error} />
              <span style={{ ...TYPO.h4, color: COLORS.error, fontWeight: 800 }}>SOS Khẩn cấp</span>
            </div>
            <div style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, marginBottom: 12 }}>
              Gửi SOS cho phụ huynh về tình huống khẩn cấp. Vị trí hiện tại của bạn sẽ được gửi kèm (nếu đang bật tracking).
            </div>
            {sosModal.taskTitle ? (
              <div
                style={{
                  ...TYPO.bodySmall,
                  color: COLORS.textPrimary,
                  fontWeight: 700,
                  background: COLORS.background,
                  padding: 8,
                  borderRadius: SIZES.radiusSm,
                  marginBottom: 12,
                }}
              >
                📋 {sosModal.taskTitle}
              </div>
            ) : null}
            <div style={{ ...TYPO.buttonSmall, color: COLORS.textSecondary, marginBottom: 4 }}>Tin nhắn (tuỳ chọn):</div>
            <textarea
              className="edc-sos-input"
              value={sosMessage}
              onChange={(e) => setSosMessage(e.target.value)}
              placeholder="VD: Gặp sự cố an toàn, cần phụ huynh liên hệ ngay..."
              maxLength={500}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: SIZES.radiusSm,
                padding: "10px 12px",
                ...TYPO.body,
                color: COLORS.textPrimary,
                minHeight: 80,
                resize: "none",
                outline: "none",
                width: "100%",
                fontFamily: TYPO.body.fontFamily,
              }}
            />
            <div style={{ display: "flex", flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <Touchable
                onPress={() => setSosModal(null)}
                style={{ padding: "10px 16px", borderRadius: SIZES.radiusSm, background: COLORS.background }}
              >
                <span style={{ ...TYPO.button, color: COLORS.textSecondary }}>Huỷ</span>
              </Touchable>
              <Touchable
                onPress={handleTriggerSOS}
                disabled={sosLoading}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 20px",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.error,
                  boxShadow: SHADOWS.small,
                  opacity: sosLoading ? 0.6 : 1,
                }}
              >
                {sosLoading ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <>
                    <Icon name="send" size={14} color="#fff" />
                    <span style={{ ...TYPO.button, color: "#fff", fontWeight: 800 }}>Gửi SOS</span>
                  </>
                )}
              </Touchable>
            </div>
            {/* Hotline khẩn cấp 24/7 (Task 5-d) */}
            <Touchable
              onPress={() => openURL(`tel:${SUPPORT_HOTLINE}`)}
              activeOpacity={0.7}
              style={{
                marginTop: 14,
                alignSelf: "center",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name={ic("call")} size={14} color={COLORS.error} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.error, textDecoration: "underline" }}>
                Hotline hỗ trợ khẩn cấp 24/7 ({SUPPORT_HOTLINE})
              </span>
            </Touchable>
          </div>
        </div>
      )}

      {/* Modal lý do từ chối (Tab 1) */}
      {rejectTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              background: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "20px 20px 30px",
              animation: "edc-fade-in-up 0.25s ease-out",
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ ...TYPO.h4, color: COLORS.textPrimary, fontWeight: 800 }}>Chọn lý do từ chối đơn</span>
              <Touchable onPress={() => setRejectTarget(null)}>
                <Icon name="close" size={18} color="#64748B" />
              </Touchable>
            </div>
            <div style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, marginBottom: 12 }}>
              Đơn sẽ được hệ thống chuyển tự động cho bạn khác. Vì từ chối trước hạn quy định, bạn{" "}
              <span style={{ color: COLORS.success, fontWeight: 700 }}>không bị trừ điểm uy tín ELO</span>.
            </div>
            <div style={{ maxHeight: 230, overflowY: "auto" }}>
              {CANCEL_REASONS.map((r) => {
                const on = rejectReason === r.code;
                return (
                  <Touchable
                    key={r.code}
                    onPress={() => setRejectReason(r.code)}
                    activeOpacity={0.8}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      border: `1px solid ${on ? COLORS.primary : COLORS.border}`,
                      borderRadius: SIZES.radiusSm,
                      padding: "11px 12px",
                      marginBottom: 8,
                      background: on ? COLORS.primaryLight : "#fff",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        border: `2px solid ${on ? COLORS.primary : "#CBD5E1"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {on && <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.primary }} />}
                    </div>
                    <span style={{ ...TYPO.bodySmall, color: on ? COLORS.primary : COLORS.textPrimary, flex: 1, fontWeight: on ? 700 : 500 }}>
                      {r.label}
                    </span>
                  </Touchable>
                );
              })}
            </div>
            <textarea
              className="edc-sos-input"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Ghi chú thêm (bắt buộc ≥ 20 ký tự với lý do bất khả kháng)..."
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: SIZES.radiusSm,
                padding: "10px 12px",
                ...TYPO.body,
                color: COLORS.textPrimary,
                minHeight: 70,
                resize: "none",
                outline: "none",
                width: "100%",
                marginTop: 4,
                fontFamily: TYPO.body.fontFamily,
              }}
            />
            <div style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Touchable
                onPress={() => setRejectTarget(null)}
                style={{ flex: 1, padding: "12px 0", borderRadius: SIZES.radiusSm, background: COLORS.background, alignItems: "center", display: "flex", justifyContent: "center" }}
              >
                <span style={{ ...TYPO.button, color: COLORS.textSecondary }}>Quay lại</span>
              </Touchable>
              <Touchable
                onPress={submitReject}
                disabled={rejectLoading}
                style={{
                  flex: 1.4,
                  padding: "12px 0",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.primary,
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "center",
                  boxShadow: SHADOWS.small,
                  opacity: rejectLoading ? 0.6 : 1,
                }}
              >
                {rejectLoading ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <span style={{ ...TYPO.button, color: "#fff", fontWeight: 800 }}>Xác nhận từ chối</span>
                )}
              </Touchable>
            </div>
          </div>
        </div>
      )}

      {/* Modal báo bận / đổi giờ (Tab 2) */}
      {rescheduleTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              background: COLORS.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: "20px 20px 30px",
              animation: "edc-fade-in-up 0.25s ease-out",
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ ...TYPO.h4, color: COLORS.textPrimary, fontWeight: 800 }}>Báo bận / Xin đổi giờ</span>
              <Touchable onPress={() => setRescheduleTarget(null)}>
                <Icon name="close" size={18} color="#64748B" />
              </Touchable>
            </div>
            <div style={{ ...TYPO.bodySmall, color: COLORS.textSecondary, marginBottom: 12 }}>
              Phụ huynh sẽ nhận được yêu cầu và phản hồi trong thời hạn quy định (tối đa 2 lần/đơn).
            </div>
            <div style={{ ...TYPO.caption, color: COLORS.textSecondary, marginTop: 10, marginBottom: 4 }}>Ngày mới (YYYY-MM-DD)</div>
            <input
              className="edc-sos-input"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              placeholder="2026-09-20"
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: SIZES.radiusSm,
                padding: "10px 12px",
                ...TYPO.body,
                color: COLORS.textPrimary,
                outline: "none",
                width: "100%",
                fontFamily: TYPO.body.fontFamily,
                background: "transparent",
              }}
            />
            <div style={{ display: "flex", flexDirection: "row", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...TYPO.caption, color: COLORS.textSecondary, marginTop: 10, marginBottom: 4 }}>Từ (HH:MM)</div>
                <input
                  className="edc-sos-input"
                  value={rescheduleFrom}
                  onChange={(e) => setRescheduleFrom(e.target.value)}
                  placeholder="17:00"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: SIZES.radiusSm,
                    padding: "10px 12px",
                    ...TYPO.body,
                    color: COLORS.textPrimary,
                    outline: "none",
                    width: "100%",
                    fontFamily: TYPO.body.fontFamily,
                    background: "transparent",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...TYPO.caption, color: COLORS.textSecondary, marginTop: 10, marginBottom: 4 }}>Đến (HH:MM)</div>
                <input
                  className="edc-sos-input"
                  value={rescheduleTo}
                  onChange={(e) => setRescheduleTo(e.target.value)}
                  placeholder="19:00"
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: SIZES.radiusSm,
                    padding: "10px 12px",
                    ...TYPO.body,
                    color: COLORS.textPrimary,
                    outline: "none",
                    width: "100%",
                    fontFamily: TYPO.body.fontFamily,
                    background: "transparent",
                  }}
                />
              </div>
            </div>
            <div style={{ ...TYPO.caption, color: COLORS.textSecondary, marginTop: 10, marginBottom: 4 }}>Lý do</div>
            <textarea
              className="edc-sos-input"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="VD: Trùng lịch học đột xuất, mong phụ huynh thông cảm..."
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: SIZES.radiusSm,
                padding: "10px 12px",
                ...TYPO.body,
                color: COLORS.textPrimary,
                minHeight: 70,
                resize: "none",
                outline: "none",
                width: "100%",
                fontFamily: TYPO.body.fontFamily,
              }}
            />
            <div style={{ display: "flex", flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Touchable
                onPress={() => setRescheduleTarget(null)}
                style={{ flex: 1, padding: "12px 0", borderRadius: SIZES.radiusSm, background: COLORS.background, alignItems: "center", display: "flex", justifyContent: "center" }}
              >
                <span style={{ ...TYPO.button, color: COLORS.textSecondary }}>Quay lại</span>
              </Touchable>
              <Touchable
                onPress={submitReschedule}
                disabled={rescheduleLoading}
                style={{
                  flex: 1.4,
                  padding: "12px 0",
                  borderRadius: SIZES.radiusSm,
                  background: COLORS.primary,
                  alignItems: "center",
                  display: "flex",
                  justifyContent: "center",
                  boxShadow: SHADOWS.small,
                  opacity: rescheduleLoading ? 0.6 : 1,
                }}
              >
                {rescheduleLoading ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <span style={{ ...TYPO.button, color: "#fff", fontWeight: 800 }}>Gửi yêu cầu</span>
                )}
              </Touchable>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
};

export default MyJobsScreen;
