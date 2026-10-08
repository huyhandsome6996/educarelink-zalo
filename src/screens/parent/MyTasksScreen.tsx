/**
 * MyTasksScreen — port CHÍNH XÁC mobile/src/screens/Parent/MyTasksScreen.js (2108 dòng).
 * Tab "Công việc" của Phụ huynh — bản thiết kế Stitch với 4 tab vòng đời độc lập:
 *   TAB 1 "Chờ xác nhận": đơn open (đang tìm ứng viên) + awaiting_commitment (timer 60m).
 *   TAB 2 "Sắp làm":      booking committed — đếm ngược đến ca, gọi điện, xem chi tiết.
 *   TAB 3 "Đang làm":     booking in_progress — giám sát GPS thật, chat, SOS, nghiệm thu.
 *   TAB 4 "Lịch sử":      completed/cancelled — Care Diary, đánh giá, MoMo Escrow, đặt lại.
 * Dữ liệu: getMyTasksAsParent() + getBookings({role:'parent'}) fetch song song (allSettled)
 * + getCandidates() cho từng open task. KHÔNG polling — refetch khi focus + nút thử lại
 * (RN dùng useFocusEffect + RefreshControl; web không có pull-to-refresh — đã ghi parity map).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web; dữ liệu tự mới khi focus lại tab.
 * - Alert.alert 2 nút (Đóng / Hủy đơn, Nghiệm thu ngay…) → window.confirm 2 nút.
 * - Linking.openURL('tel:…') → window.location.href = 'tel:…'.
 * - Animated.loop PingDot → CSS keyframe edc-pulse (có sẵn trong app.css).
 * - Icon thiếu glyph trong bộ 159 (search-outline, close-circle-outline, book-outline,
 *   alarm-outline, call, repeat, radio, radio-off) → map sang glyph Ionicons gần nhất
 *   cùng nghĩa (ic() bên dưới) vì không được sửa ionicons.ts.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen, NotificationBell } from "@/components/ui";
import { SHADOWS, ANIM } from "@/theme";
import { useNav } from "@/navigation/router";
import { getMyTasksAsParent, getCandidates, updateTaskStatus } from "@/api/tasks";
import { getBookings, cancelBookingByParent, completeBooking } from "@/api/matching";
import { checkConsent, getLiveLocation } from "@/api/tracking";

// === DESIGN TOKENS (Bản thiết kế Stitch HTML — giữ NGUYÊN giá trị từ RN) ===
const STITCH = {
  surface: "#FAF8FF",
  canvas: "#F8FAFC",
  cardSurface: "#FFFFFF",
  cardBorder: "#EAEDFF",
  borderSubtle: "#E2E8F0",
  onSurface: "#131B2E",
  onSurfaceVariant: "#594138",
  slateText: "#475569",
  slateMuted: "#94A3B8",
  primaryContainer: "#F26522", // EduCareLink Brand Orange
  primaryLight: "#FFF7ED",
  onPrimary: "#FFFFFF",
  secondary: "#006C49", // Trust Emerald Green
  secondaryContainer: "#7EF6BE",
  secondaryLight: "#ECFDF5",
  onSecondaryContainer: "#00714C",
  tertiaryContainer: "#CA8100", // Amber
  amberLight: "#FFFBEB",
  amberBorder: "#FDE68A",
  amberDark: "#92400E",
  skyActive: "#0284C7",
  skyLight: "#E0F2FE",
  skyBorder: "#BAE6FD",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#93000A",
  alertCrimson: "#EF4444",
  inverseSurface: "#283044",
  inverseOnSurface: "#EEF0FF",
};

// Hotline hỗ trợ — port mobile/src/config/appConfig.js (SUPPORT_HOTLINE)
const SUPPORT_HOTLINE = "0862427404";

// === 4 TABS CHUẨN VÒNG ĐỜI (Stitch Segmented Control) — đúng thứ tự RN ===
const TABS: Array<{ key: TabKey; label: string; icon: string; live?: boolean }> = [
  { key: "pending", label: "Chờ xác nhận", icon: "hourglass-outline" },
  { key: "upcoming", label: "Sắp làm", icon: "calendar-outline" },
  { key: "in_progress", label: "Đang làm", icon: "navigate-outline", live: true },
  { key: "history", label: "Lịch sử", icon: "time-outline" },
];

type TabKey = "pending" | "upcoming" | "in_progress" | "history";

const CANCEL_REASON_LABELS: Record<string, string> = {
  school_schedule: "Trùng lịch học đột xuất",
  health: "Sức khỏe không tốt",
  family_emergency: "Việc gia đình khẩn cấp",
  accident: "Tai nạn / sự cố di chuyển",
  wrong_job_info: "Thông tin công việc không đúng mô tả",
  transport: "Không thể di chuyển",
  personal: "Lý do cá nhân",
  other: "Lý do khác",
  no_show: "CarePartner không đến làm",
};

const PENDING_BOOKING_STATUSES = ["awaiting_commitment", "reschedule_requested", "suspected_no_show"];
const UPCOMING_BOOKING_STATUSES = ["committed"];
const IN_PROGRESS_BOOKING_STATUSES = ["in_progress"];
const HISTORY_BOOKING_STATUSES = [
  "completed",
  "no_show",
  "no_show_unconfirmed",
  "cancelled_by_parent",
  "cancelled_by_carepartner",
  "declined_in_window",
  "expired_no_response",
  "disputed",
];

const money = (v?: number | null) => `${Number(v || 0).toLocaleString("vi-VN")}đ`;

const fmtEnd = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
};

// Chuẩn bị đếm ngược "X phút Y giây"
const fmtViCountdown = (totalSec: number) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} phút ${String(s).padStart(2, "0")} giây`;
};

// Tính tiến độ ca thực tế (phút) từ started_at + khung giờ slot.
// Trả về null khi không đủ dữ liệu — UI ẩn thanh tiến độ thay vì bịa số.
const computeShiftProgress = (booking: Booking): { elapsed: number; total: number } | null => {
  const slot = booking?.first_slot;
  if (!booking?.started_at || !slot?.time_from || !slot?.time_to || !slot?.date) return null;
  try {
    const [fh, fm] = String(slot.time_from).split(":").map(Number);
    const [th, tm] = String(slot.time_to).split(":").map(Number);
    const totalMin = Math.max(1, th * 60 + tm - (fh * 60 + fm));
    const startMs = new Date(`${slot.date}T${String(slot.time_from).slice(0, 5)}:00+07:00`).getTime();
    const startedMs = new Date(booking.started_at).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(startedMs)) return null;
    const anchor = Math.max(startMs, startedMs); // ca bắt đầu đúng giờ hoặc muộn hơn
    const elapsedMin = Math.floor((Date.now() - anchor) / 60000);
    return { elapsed: Math.max(0, elapsedMin), total: totalMin };
  } catch (_) {
    return null;
  }
};

// Đếm ngược đến mốc thời gian ISO
function useCountdownTo(targetIso: string | null): number | null {
  const [secs, setSecs] = useState<number | null>(() => {
    if (!targetIso) return null;
    return Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!targetIso) return undefined;
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [targetIso]);
  return secs;
}

/** Chèm vị trí tel: như Linking.openURL của RN */
const openTel = (phone: string) => {
  try {
    window.location.href = `tel:${phone}`;
  } catch { /* ignore */ }
};

/** Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      "search-outline": "search",
      "close-circle-outline": "close-circle",
      "book-outline": "book",
      "alarm-outline": "time-outline",
      call: "call-outline",
      repeat: "sync-outline",
      radio: "radio-outline",
      "radio-off": "notifications-off-outline",
      "add-circle-outline": "add-circle",
      "folder-open-outline": "document-text-outline",
    } as Record<string, string>
  )[name] ?? name;

// Chấm tròn nhấp nháy phát xung (Radar Ping) — RN Animated.loop → CSS edc-pulse
function PingDot({ color = STITCH.secondary, size = 8 }: { color?: string; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          background: color,
          animation: "edc-pulse 1.8s ease-in-out infinite",
        }}
      />
      <span style={{ width: size, height: size, borderRadius: size / 2, background: color }} />
    </span>
  );
}

// Status Pill — map đầy đủ status của 4 tab
function StatusPill({
  bg,
  border,
  color,
  icon,
  live,
  children,
}: {
  bg: string;
  border?: string;
  color: string;
  icon?: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...S.statusPill,
        background: bg,
        border: `1px solid ${border || bg}`,
      }}
    >
      {live ? <PingDot color={color} size={6} /> : icon ? <Icon name={ic(icon)} size={12} color={color} /> : null}
      <span style={{ ...S.statusPillText, color }}>{children}</span>
    </div>
  );
}

// Spotlight Sinh viên đã chọn (Avatar thật hoặc ký tự đầu)
function StudentSpotlight({ info, compact }: { info?: CarePartnerInfo | null; compact?: boolean }) {
  const name = info?.full_name || "CarePartner";
  const initial = (name || "S").trim().charAt(0).toUpperCase();
  const rating = info?.rating_avg || 0;
  const jobsDone = info?.jobs_completed || 0;
  const avatarUrl = info?.avatar_url || "";

  return (
    <div style={S.spotlightRow}>
      <div style={S.avatarWrap}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} style={S.avatarImg} />
        ) : (
          <div style={S.avatarPlaceholder}>
            <span style={S.avatarInitial}>{initial}</span>
          </div>
        )}
        <div style={S.verifiedBadge}>
          <Icon name="checkmark-circle" size={14} color={STITCH.secondary} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.spotlightName, ...clamp(1) }}>{name}</div>
        {!!info?.school && (
          <div style={{ ...S.spotlightSchool, ...clamp(1) }}>
            {info.school}
            {info?.major ? ` · ${info.major}` : ""}
          </div>
        )}
        {!compact && (
          <div style={S.chipRow}>
            <div style={S.starChip}>
              <Icon name="star" size={11} color={STITCH.tertiaryContainer} />
              <span style={S.starChipText}>{rating > 0 ? `${rating} (${jobsDone} ca)` : "Sinh viên mới"}</span>
            </div>
            <div style={S.cccdChip}>
              <Icon name="shield-checkmark-outline" size={11} color={STITCH.secondary} />
              <span style={S.cccdChipText}>CCCD gắn chip</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD — TAB 1: CARD 1A (AWAITING COMMITMENT — ĐÃ CHỌN SINH VIÊN)
// ═══════════════════════════════════════════════════════════════
function AwaitingBookingCard({
  booking,
  onOpenDetail,
  onCancel,
  actionLoading,
}: {
  booking: Booking;
  onOpenDetail: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  actionLoading: string | null;
}) {
  const [secs, setSecs] = useState(Number(booking.seconds_left) || 0);
  useEffect(() => {
    setSecs(Number(booking.seconds_left) || 0);
  }, [booking.seconds_left]);
  const hasTime = secs > 0;
  useEffect(() => {
    if (!hasTime) return undefined;
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [hasTime]);

  const isCancelling = actionLoading === `booking-cancel-${booking.id}`;
  const slot = booking.first_slot;
  const addr = booking.job_address || booking.location_info?.address || "";

  return (
    <div style={{ ...S.card, borderTop: `4px solid ${STITCH.tertiaryContainer}` }}>
      {/* Header Row */}
      <div style={S.cardHeader}>
        <StatusPill bg={STITCH.amberLight} border={STITCH.amberBorder} color={STITCH.amberDark} icon="hourglass-outline">
          Chờ sinh viên xác nhận
        </StatusPill>
        <span style={S.cardPrice}>{money(booking.total_value_vnd)}</span>
      </div>

      {/* Countdown Ribbon (Stitch Ribbon) — timer 1s */}
      <div style={S.countdownRibbon}>
        <div style={S.countdownLeft}>
          <Icon name="time" size={15} color={STITCH.tertiaryContainer} />
          <div style={S.countdownText}>
            Thời hạn xác nhận:{" "}
            <span style={S.countdownBold}>{secs > 0 ? fmtViCountdown(secs) : "Đang xử lý mở lại đơn..."}</span>
          </div>
        </div>
        <div style={S.escrowBadge}>
          <Icon name="checkmark-circle" size={13} color={STITCH.secondary} />
          <span style={S.escrowBadgeText}>Ký quỹ an toàn</span>
        </div>
      </div>

      {/* Spotlight Sinh viên đã chọn */}
      <StudentSpotlight info={booking.carepartner_info} />

      {/* Thông tin ca học */}
      <div style={S.jobBriefBox}>
        <div style={{ ...S.jobBriefTitle, ...clamp(2) }}>{booking.job_title || "Công việc gia sư & chăm sóc"}</div>
        {!!slot?.date && (
          <div style={S.metaRow}>
            <Icon name="calendar-outline" size={14} color={STITCH.primaryContainer} />
            <span style={S.metaText}>
              {slot.time_from?.slice(0, 5) || "--:--"} – {slot.time_to?.slice(0, 5) || "--:--"}{" "}
              {slot.day_of_week_vi ? `${slot.day_of_week_vi}` : ""} ({slot.date_vi || slot.date})
            </span>
          </div>
        )}
        {!!addr && (
          <div style={S.metaRow}>
            <Icon name="location-outline" size={14} color={STITCH.secondary} />
            <span style={{ ...S.metaText, ...clamp(1) }}>{addr}</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div style={S.cardActionsRow}>
        <Touchable onPress={() => onOpenDetail(booking)} activeOpacity={0.85} style={S.btnInverse}>
          <span style={S.btnInverseText}>Xem hồ sơ chi tiết</span>
        </Touchable>
        <Touchable onPress={() => onCancel(booking)} disabled={isCancelling} activeOpacity={0.85} style={S.btnDangerSubtle}>
          {isCancelling ? (
            <Spinner size={14} color={STITCH.onErrorContainer} />
          ) : (
            <span style={S.btnDangerSubtleText}>Đổi người khác</span>
          )}
        </Touchable>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD — TAB 1: CARD 1B (ĐƠN MỚI ĐĂNG ĐANG TÌM ỨNG VIÊN)
// ═══════════════════════════════════════════════════════════════
function OpenTaskCard({
  task,
  onCancelTask,
  candidateCount,
  isCancelling,
}: {
  task: ParentTask;
  onCancelTask: (t: ParentTask) => void;
  candidateCount?: number;
  isCancelling: boolean;
}) {
  const nav = useNav();
  return (
    <div style={{ ...S.card, borderTop: "4px solid #FFB95F" }}>
      <div style={S.cardHeader}>
        <StatusPill bg="#E2E7FF" border="#DAE2FD" color={STITCH.onSurface} icon="search-outline">
          Đang tìm sinh viên phù hợp
        </StatusPill>
        <span style={S.cardPrice}>{money(task.price)}</span>
      </div>

      <div style={{ margin: "6px 0", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ ...S.jobBriefTitle, ...clamp(2) }}>{task.title}</div>
        <div style={S.metaRow}>
          <Icon name="calendar-outline" size={14} color={STITCH.primaryContainer} />
          <span style={S.metaText}>
            {task.scheduled_time
              ? new Date(task.scheduled_time).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </span>
        </div>
      </div>

      {/* AI Matching Prompt Banner — SỐ ỨNG VIÊN THẬT từ getCandidates (Blocker B) */}
      <div style={S.aiPromptBanner}>
        <Icon name="sparkles" size={16} color={STITCH.primaryContainer} />
        <span style={S.aiPromptText}>
          <b>
            {candidateCount && candidateCount > 0
              ? `Đã có ${candidateCount} sinh viên gần nhà`
              : "Chưa có sinh viên nào gần nhà"}
          </b>{" "}
          (bán kính &lt; 2km)
          {candidateCount && candidateCount > 0
            ? " nộp hồ sơ xét duyệt trực tiếp."
            : " — hệ thống đang tiếp tục tìm kiếm."}
        </span>
      </div>

      <div style={S.cardActionsRow}>
        {/* RN: navigation.navigate('SmartMatches', { taskId: task.id, taskTitle: task.title }) */}
        <Touchable
          onPress={() => nav.navigate("SmartMatches", { taskId: task.id, taskTitle: task.title })}
          activeOpacity={0.88}
          style={S.btnPrimaryAction}
        >
          <span style={S.btnPrimaryActionText}>Xem danh sách ứng viên để chọn ngay</span>
          <Icon name="arrow-forward" size={15} color="#FFFFFF" />
        </Touchable>
        <Touchable
          onPress={() => onCancelTask(task)}
          disabled={isCancelling}
          activeOpacity={0.8}
          style={S.btnCancelText}
        >
          {isCancelling ? (
            <Spinner size={14} color={STITCH.slateMuted} />
          ) : (
            <span style={S.btnCancelTextLabel}>Hủy việc</span>
          )}
        </Touchable>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD — TAB 2: SẮP LÀM (COMMITTED — ĐÃ CAM KẾT NHẬN VIỆC)
// ═══════════════════════════════════════════════════════════════
function CommittedBookingCard({ booking, onOpenDetail }: { booking: Booking; onOpenDetail: (b: Booking) => void }) {
  const slot = booking.first_slot;
  const targetIso = useMemo(() => {
    if (!slot?.date) return null;
    try {
      const time = slot.time_from || "00:00";
      return new Date(`${slot.date}T${time}:00+07:00`).toISOString();
    } catch (_) {
      return null;
    }
  }, [slot?.date, slot?.time_from]);

  const secsToStart = useCountdownTo(targetIso);
  const phone = booking.carepartner_info?.phone || "";

  const startLabel = (() => {
    if (!slot?.date) return "Ca làm theo thỏa thuận";
    if (secsToStart === null) return "Ca làm sắp diễn ra";
    if (secsToStart <= 0) return "Ca làm có thể bắt đầu";
    const h = Math.floor(secsToStart / 3600);
    const m = Math.floor((secsToStart % 3600) / 60);
    if (h >= 1) return `Bắt đầu lúc ${slot.time_from?.slice(0, 5) || "18:00"} (Còn ${h} tiếng ${m} phút)`;
    return `Bắt đầu lúc ${slot.time_from?.slice(0, 5) || "18:00"} (Còn ${m} phút)`;
  })();

  const addr = booking.job_address || booking.location_info?.address || "";

  return (
    <div style={{ ...S.card, borderTop: `4px solid ${STITCH.secondary}` }}>
      {/* Header */}
      <div style={S.cardHeader}>
        <StatusPill bg="#ECFDF5" border="#A7F3D0" color="#006C49" icon="checkmark-circle">
          Sinh viên đã cam kết nhận việc
        </StatusPill>
        <span style={S.badgeOrderCode}>Mã: #{String(booking.id || "").slice(0, 7)}</span>
      </div>

      {/* Countdown Highlight Box */}
      <div style={S.upcomingHighlightBox}>
        <Icon name={ic("alarm-outline")} size={17} color={STITCH.secondary} />
        <span style={S.upcomingHighlightText}>{startLabel}</span>
      </div>

      {/* Student Detail */}
      <StudentSpotlight info={booking.carepartner_info} />

      {/* Shift Overview */}
      <div style={S.jobBriefBox}>
        <div style={S.jobBriefTitle}>{booking.job_title || "Gia sư & Kèm học tại nhà"}</div>
        <div style={S.metaRow}>
          <Icon name="location-outline" size={14} color={STITCH.secondary} />
          <span style={{ ...S.metaText, ...clamp(1) }}>{addr || "Địa chỉ gia đình"}</span>
        </div>
      </div>

      {/* Direct Contact (Gọi trực tiếp — trước giờ làm) */}
      <Touchable
        onPress={() => {
          if (phone) openTel(phone);
        }}
        activeOpacity={0.85}
        style={S.contactBtn}
      >
        <Icon name={ic("call")} size={16} color={STITCH.primaryContainer} />
        <span style={S.contactBtnText}>{phone ? `Gọi ${phone}` : "Gọi trực tiếp cho sinh viên"}</span>
      </Touchable>

      {/* View Detail Link */}
      <Touchable onPress={() => onOpenDetail(booking)} activeOpacity={0.85} style={S.btnSecondaryFull}>
        <span style={S.btnSecondaryFullText}>Xem lộ trình & chi tiết ca</span>
      </Touchable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD — TAB 3: ĐANG LÀM (IN-PROGRESS — GIÁM SÁT + CHAT + NGHIỆM THU)
// GPS hiển thị trạng thái THẬT từ API tracking (nếu có) hoặc
// "Chưa có tín hiệu" trung thực. Progress chỉ tính từ dữ liệu thật.
// ═══════════════════════════════════════════════════════════════
function InProgressBookingCard({
  booking,
  onOpenDetail,
  onComplete,
  actionLoading,
}: {
  booking: Booking;
  onOpenDetail: (b: Booking) => void;
  onComplete: (b: Booking) => void;
  actionLoading: string | null;
}) {
  const nav = useNav();
  const isCompleting = actionLoading === `booking-complete-${booking.id}`;
  const slot = booking.first_slot;
  const timeWindow =
    slot?.time_from && slot?.time_to ? `${slot.time_from.slice(0, 5)} – ${slot.time_to.slice(0, 5)}` : "";
  // Tiến độ thực — thiếu dữ liệu → null → ẩn thanh (không bịa %)
  const progress = computeShiftProgress(booking);
  // GPS thật: poll 1 lần khi mount nếu có Task mirror (tracking gắn Task)
  const gpsState = useBookingGpsStatus(booking.task_id);

  return (
    <div style={{ ...S.card, borderTop: `4px solid ${STITCH.skyActive}` }}>
      {/* Live Header — khung giờ THẬT từ first_slot (Blocker B) */}
      <div style={S.cardHeader}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <PingDot color={STITCH.secondary} size={8} />
          <span style={{ ...S.liveHeaderText, ...clamp(1) }}>ĐANG LÀM VIỆC{timeWindow ? ` (${timeWindow})` : ""}</span>
        </div>
        {progress && <span style={S.progressTimeText}>Đã làm {progress.elapsed}/{progress.total} phút</span>}
      </div>

      {/* Progress Bar — chỉ render khi tính được từ dữ liệu thật */}
      {progress && (
        <div style={S.progressBarTrack}>
          <div
            style={{
              ...S.progressBarFill,
              width: `${Math.min(100, Math.round((progress.elapsed / progress.total) * 100))}%`,
            }}
          />
        </div>
      )}

      {/* Live GPS & Geofence status — dữ liệu THẬT từ API tracking */}
      <div style={S.radarCard}>
        <div style={S.radarHeaderRow}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name="shield-checkmark" size={16} color={STITCH.secondary} />
            <span style={S.radarTitle}>Giám sát vị trí trực tiếp</span>
          </div>
          <span style={S.radarRadius}>{gpsState.lastFixAt ? `Cập nhật ${gpsState.agoText}` : "Chưa có tín hiệu"}</span>
        </div>

        <div style={S.radarFooterRow}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon
              name={gpsState.status === "live" ? ic("radio") : ic("radio-off")}
              size={13}
              color={gpsState.status === "live" ? STITCH.secondary : STITCH.slateMuted}
            />
            <span style={S.radarFooterText}>
              {gpsState.status === "live"
                ? "Đang chia sẻ vị trí GPS trực tiếp"
                : gpsState.status === "denied"
                ? "CarePartner chưa đồng ý chia sẻ vị trí"
                : "Chưa có tín hiệu GPS từ ca làm"}
            </span>
          </div>
        </div>
      </div>

      {/* Student On-site Info */}
      <StudentSpotlight info={booking.carepartner_info} compact />

      {/* Chat trực tiếp với CarePartner — mở chat NGAY trong ca (taskId = Task mirror).
          Ẩn khi chưa có Task mirror. */}
      {booking.task_id && (
        <Touchable
          onPress={() => nav.navigate("Chat", { taskId: booking.task_id, taskTitle: booking.job_title })}
          activeOpacity={0.85}
          style={S.chatShiftBtn}
        >
          <Icon name="chatbubble-ellipses" size={16} color={STITCH.skyActive} />
          <span style={S.chatShiftBtnText}>Nhắn tin với Carepartner</span>
        </Touchable>
      )}

      {/* SOS Hotline Button */}
      <Touchable onPress={() => openTel(SUPPORT_HOTLINE)} activeOpacity={0.85} style={S.sosButton}>
        <Icon name="warning" size={16} color={STITCH.alertCrimson} />
        <span style={S.sosButtonText}>Hotline hỗ trợ khẩn cấp 24/7 ({SUPPORT_HOTLINE})</span>
      </Touchable>

      {/* Completion Button */}
      <Touchable onPress={() => onComplete(booking)} disabled={isCompleting} activeOpacity={0.88} style={S.completeShiftBtn}>
        {isCompleting ? (
          <Spinner size={16} color="#FFFFFF" />
        ) : (
          <>
            <Icon name="checkmark-circle" size={18} color="#FFFFFF" />
            <span style={S.completeShiftBtnText}>Nghiệm thu & Hoàn thành ca</span>
          </>
        )}
      </Touchable>
    </div>
  );
}

// Hook trạng thái GPS thật cho thẻ in_progress (poll 1 lần khi mount —
// không spam API). Mọi lỗi mạng → 'unknown' ("Chưa có tín hiệu") trung thực.
function useBookingGpsStatus(taskId?: number | string) {
  const [state, setState] = useState<{ status: string; lastFixAt: string | null; agoText: string }>({
    status: "unknown",
    lastFixAt: null,
    agoText: "",
  });
  useEffect(() => {
    let mounted = true;
    if (!taskId) return undefined;
    (async () => {
      try {
        const consent = (await checkConsent(taskId)) as any;
        if (!mounted) return;
        if (!consent?.granted && !consent?.is_granted) {
          setState({ status: "denied", lastFixAt: null, agoText: "" });
          return;
        }
        try {
          const loc = (await getLiveLocation(taskId)) as any;
          if (!mounted) return;
          const fixAt = loc?.recorded_at || loc?.updated_at || loc?.timestamp || null;
          const sec = fixAt
            ? Math.max(0, Math.floor((Date.now() - new Date(fixAt).getTime()) / 1000))
            : null;
          setState({
            status: sec === null ? "live" : "live",
            lastFixAt: fixAt,
            agoText:
              sec === null
                ? "vừa xong"
                : sec < 60
                ? `${sec}s trước`
                : `${Math.floor(sec / 60)} phút trước`,
          });
        } catch (_) {
          if (mounted) setState({ status: "unknown", lastFixAt: null, agoText: "" });
        }
      } catch (_) {
        if (mounted) setState({ status: "unknown", lastFixAt: null, agoText: "" });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [taskId]);
  return state;
}

// ═══════════════════════════════════════════════════════════════
// CARD — TAB 4: LỊCH SỬ (HISTORY — COMPLETED / ARCHIVED)
// Ngày kết thúc từ ended_at thật ('—' khi thiếu); đánh giá HIỂN THỊ
// RATING THẬT từ booking.review, chưa đánh giá → CTA.
// ═══════════════════════════════════════════════════════════════
function HistoryBookingCard({ booking, onOpenDetail }: { booking: Booking; onOpenDetail: (b: Booking) => void }) {
  const nav = useNav();
  const isCompleted = booking.status === "completed";
  const cpName = booking.carepartner_info?.full_name || "sinh viên";
  const payout = booking.carepartner_payout_vnd ?? Math.round((booking.total_value_vnd || 0) * 0.8);
  const review = booking.review || null;

  if (!isCompleted) {
    const reason = CANCEL_REASON_LABELS[booking.cancel_reason_code || ""] || booking.cancel_reason_code;
    return (
      <div style={{ ...S.card, borderTop: `4px solid ${STITCH.slateMuted}` }}>
        <div style={S.cardHeader}>
          <StatusPill bg="#F1F5F9" border="#E2E8F0" color="#64748B" icon="close-circle-outline">
            {booking.status_label_vi || "Đã kết thúc"}
          </StatusPill>
          <span style={{ ...S.cardPrice, color: STITCH.slateText }}>{money(booking.total_value_vnd)}</span>
        </div>
        <div style={S.jobBriefTitle}>{booking.job_title}</div>
        {!!booking.compensation_vnd && booking.compensation_vnd > 0 ? (
          <div style={S.refundBox}>
            <Icon name="gift-outline" size={14} color="#B45309" />
            <span style={S.refundBoxText}>Đã đền bù {money(booking.compensation_vnd)} credit vào ví của bạn.</span>
          </div>
        ) : !!reason ? (
          <span style={S.cancelReasonText}>Lý do: {reason}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ ...S.card, borderTop: `4px solid ${STITCH.secondary}` }}>
      {/* Header — ngày kết thúc THẬT từ ended_at, thiếu → '—' (Blocker B) */}
      <div style={S.cardHeader}>
        <StatusPill bg="#ECFDF5" border="#A7F3D0" color="#006C49" icon="shield-checkmark">
          Đã giải ngân {money(payout)} MoMo Escrow
        </StatusPill>
        <span style={S.historyDateText}>{fmtEnd(booking.ended_at) || "—"}</span>
      </div>

      <div style={{ margin: "6px 0" }}>
        <div style={S.jobBriefTitle}>
          {cpName} · {booking.job_title || "Kèm bé học"}
        </div>
      </div>

      {/* Care Diary — chỉ hiện LINK khi ca có Task mirror; KHÔNG bịa trích dẫn */}
      {booking.task_id && (
        <div style={S.careDiaryBox}>
          <div style={S.careDiaryHeader}>
            <span style={S.careDiaryTitle}>Nhật ký buổi học (Care Diary)</span>
            <Touchable onPress={() => nav.navigate("CareDiaryDetail", { taskId: booking.task_id })} activeOpacity={0.8}>
              <span style={S.careDiaryLink}>Xem toàn bộ ↗</span>
            </Touchable>
          </div>
        </div>
      )}

      {/* Review — rating THẬT từ API; chưa đánh giá → CTA; không Task mirror → trung thực */}
      <div style={S.reviewPromptRow}>
        {review ? (
          <div
            style={{
              ...S.reviewedBtn,
              background: STITCH.amberLight,
              borderWidth: 1,
              border: `1px solid ${STITCH.amberBorder}`,
            }}
          >
            <Icon name="star" size={15} color={STITCH.tertiaryContainer} />
            <span style={{ ...S.reviewedBtnText, color: STITCH.amberDark }}>Bạn đã đánh giá {review.rating} sao</span>
          </div>
        ) : booking.task_id ? (
          <Touchable
            onPress={() => nav.navigate("Review", { taskId: booking.task_id, revieweeId: booking.carepartner_id })}
            activeOpacity={0.85}
            style={S.reviewedBtn}
          >
            <Icon name="star-outline" size={15} color="#FFFFFF" />
            <span style={S.reviewedBtnText}>Đánh giá Carepartner</span>
          </Touchable>
        ) : (
          <span style={S.cancelReasonText}>Chưa có đánh giá cho ca này</span>
        )}
      </div>

      {/* Chat (24h) — cửa sổ chat mở đến 24h sau ca hoàn thành */}
      {booking.task_id && (
        <Touchable
          onPress={() => nav.navigate("Chat", { taskId: booking.task_id, taskTitle: booking.job_title })}
          activeOpacity={0.85}
          style={S.chatShiftBtn}
        >
          <Icon name="chatbubble-ellipses" size={16} color={STITCH.skyActive} />
          <span style={S.chatShiftBtnText}>Chat (24h)</span>
        </Touchable>
      )}

      {/* Re-book Button */}
      <Touchable onPress={() => nav.navigate("JobTypeSelect")} activeOpacity={0.88} style={S.rebookBtn}>
        <Icon name={ic("repeat")} size={16} color="#FFFFFF" />
        <span style={S.rebookBtnText}>Đặt lại sinh viên này cho tuần sau</span>
      </Touchable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CARD — LEGACY core.Task (luồng cũ — phục hồi N-003)
// in_progress: nút chat trực tiếp; completed: "Chat (24h)".
// ═══════════════════════════════════════════════════════════════
function LegacyTaskCard({
  task,
  candidateCount,
  isCancelling,
  onCancelTask,
}: {
  task: ParentTask;
  candidateCount?: number;
  isCancelling: boolean;
  onCancelTask: (t: ParentTask) => void;
}) {
  const nav = useNav();
  const isInProgress = task.status === "in_progress";
  const price = task.price != null ? `${Number(task.price).toLocaleString("vi-VN")}đ` : "";

  return (
    <div style={{ ...S.card, borderTop: `4px solid ${isInProgress ? STITCH.skyActive : STITCH.slateMuted}` }}>
      <div style={S.cardHeader}>
        <StatusPill
          bg={isInProgress ? STITCH.skyLight : "#F1F5F9"}
          border={isInProgress ? STITCH.skyBorder : "#E2E8F0"}
          color={isInProgress ? STITCH.skyActive : "#64748B"}
          icon={isInProgress ? "navigate-outline" : "checkmark-circle-outline"}
        >
          {isInProgress ? "Đang thực hiện" : "Đã hoàn thành"}
        </StatusPill>
        {!!price && <span style={S.cardPrice}>{price}</span>}
      </div>

      <div style={{ ...S.jobBriefTitle, ...clamp(2) }}>{task.title}</div>
      {!!task.scheduled_time && (
        <div style={S.metaRow}>
          <Icon name="calendar-outline" size={14} color={STITCH.primaryContainer} />
          <span style={S.metaText}>
            {new Date(task.scheduled_time).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
      {!!task.location && (
        <div style={S.metaRow}>
          <Icon name="location-outline" size={14} color={STITCH.secondary} />
          <span style={{ ...S.metaText, ...clamp(1) }}>{task.location}</span>
        </div>
      )}

      {/* Hành động theo trạng thái — giữ nguyên nghĩa chat của bản main */}
      {task.status === "in_progress" && (
        <Touchable
          onPress={() => nav.navigate("Chat", { taskId: task.id, taskTitle: task.title })}
          activeOpacity={0.85}
          style={S.chatShiftBtn}
        >
          <Icon name="chatbubble-ellipses" size={16} color={STITCH.skyActive} />
          <span style={S.chatShiftBtnText}>Nhắn tin với Carepartner</span>
        </Touchable>
      )}
      {task.status === "completed" && (
        <Touchable
          onPress={() => nav.navigate("Chat", { taskId: task.id, taskTitle: task.title })}
          activeOpacity={0.85}
          style={S.chatShiftBtn}
        >
          <Icon name="chatbubble-ellipses" size={16} color={STITCH.skyActive} />
          <span style={S.chatShiftBtnText}>Chat (24h)</span>
        </Touchable>
      )}
      {task.status === "cancelled" && (
        <div style={S.cardActionsRow}>
          <Touchable
            onPress={() => onCancelTask(task)}
            disabled={isCancelling}
            activeOpacity={0.8}
            style={S.btnCancelText}
          >
            {isCancelling ? (
              <Spinner size={14} color={STITCH.slateMuted} />
            ) : (
              <span style={S.btnCancelTextLabel}>Xoá khỏi danh sách</span>
            )}
          </Touchable>
        </div>
      )}
      {/* candidateCount: chỉ dùng cho open task — legacy card không hiển thị banner AI bịa số */}
      {!!(task.status === "open" && candidateCount && candidateCount > 0) && (
        <span style={S.cancelReasonText}>{candidateCount} ứng viên đã nộp hồ sơ</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN: MyTasksScreen
// ═══════════════════════════════════════════════════════════════
const MyTasksScreen: React.FC = () => {
  const nav = useNav();

  // RN Animated.timing fade 250ms → CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const [tasks, setTasks] = useState<ParentTask[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [candidateCounts, setCandidateCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState("");
  const loadingRef = useRef(isLoading);
  loadingRef.current = isLoading;

  // Fetch song song 2 nguồn (Promise.allSettled — tự viết settle vì tsconfig lib ES2017)
  const fetchAllData = useCallback(async ({ silent }: { silent?: boolean } = {}) => {
    if (!silent) setIsLoading(true);
    setLoadError("");
    const settle = <T,>(p: Promise<T>): Promise<{ ok: boolean; v?: T }> =>
      p.then((v) => ({ ok: true, v })).catch(() => ({ ok: false as const, v: undefined }));

    const [tasksRes, bookingsRes] = await Promise.all([
      settle(getMyTasksAsParent() as Promise<ParentTask[]>),
      settle(getBookings({ role: "parent" }) as Promise<any>),
    ]);

    let nextTasks: ParentTask[] = [];
    if (tasksRes.ok) {
      nextTasks = Array.isArray(tasksRes.v) ? tasksRes.v : [];
      setTasks(nextTasks);
    }
    let nextBookings: Booking[] = [];
    if (bookingsRes.ok) {
      const d = bookingsRes.v;
      nextBookings = Array.isArray(d) ? d : Array.isArray(d?.results) ? d.results : [];
      setBookings(nextBookings);
    }
    if (!tasksRes.ok && !bookingsRes.ok) {
      setLoadError("Không tải được danh sách việc. Vui lòng thử lại.");
    }
    setIsLoading(false);
    setRefreshing(false);

    // Đếm ứng viên cho open task
    const openTasks = nextTasks.filter((t) => t.status === "open");
    openTasks.forEach(async (t) => {
      try {
        const candList = (await getCandidates(t.id as any)) as any;
        const list = Array.isArray(candList) ? candList : [];
        setCandidateCounts((prev) => ({ ...prev, [String(t.id)]: list.length }));
      } catch (_) {
        /* RN: bỏ qua lỗi đếm ứng viên */
      }
    });
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // RN useFocusEffect: refetch silent mỗi lần màn nhận focus (và sau khi load xong).
  // Web: "focus" = MyTasks là route đang hiển thị (tính từ nav.state).
  const topRoute = nav.state.modal?.name ?? nav.state.stacks[nav.state.tab]?.slice(-1)[0]?.name;
  const isFocused = topRoute === "MyTasks";
  useEffect(() => {
    if (isFocused && !loadingRef.current) fetchAllData({ silent: true });
  }, [isFocused, isLoading, fetchAllData]);

  const onRefresh = useCallback(() => {
    // RN: RefreshControl pull-to-refresh — web không có; giữ logic refetch silent
    setRefreshing(true);
    fetchAllData({ silent: true });
  }, [fetchAllData]);

  // Phân loại dữ liệu theo 4 Tab chuẩn Stitch
  const itemsByTab = useMemo(() => {
    const pending: ListItem[] = [];
    const upcoming: ListItem[] = [];
    const in_progress: ListItem[] = [];
    const history: ListItem[] = [];

    // Task mirror (core) được backend tạo tự động khi booking bắt đầu (booking.task_id).
    // Task legacy trùng mirror lọc khỏi danh sách legacy để tránh HIỂN THỊ TRÙNG 2 thẻ.
    const bookingTaskIds = new Set(
      bookings.map((b) => (b.task_id != null ? String(b.task_id) : "")).filter(Boolean)
    );

    bookings.forEach((b) => {
      if (PENDING_BOOKING_STATUSES.includes(b.status || "")) {
        pending.push({ kind: "booking", data: b });
      } else if (UPCOMING_BOOKING_STATUSES.includes(b.status || "")) {
        upcoming.push({ kind: "booking", data: b });
      } else if (IN_PROGRESS_BOOKING_STATUSES.includes(b.status || "")) {
        in_progress.push({ kind: "booking", data: b });
      } else if (HISTORY_BOOKING_STATUSES.includes(b.status || "")) {
        history.push({ kind: "booking", data: b });
      }
    });

    tasks.forEach((t) => {
      if (bookingTaskIds.has(String(t.id))) return; // trùng ca booking Flow 1
      if (t.status === "open") {
        pending.push({ kind: "task", data: t });
      } else if (t.status === "in_progress") {
        in_progress.push({ kind: "task", data: t });
      } else if (["completed", "cancelled"].includes(t.status || "")) {
        history.push({ kind: "task", data: t });
      }
    });

    return { pending, upcoming, in_progress, history };
  }, [bookings, tasks]);

  // Hỗ trợ hiển thị số đếm cho các tab
  const tabCounts: Record<TabKey, number> = {
    pending: itemsByTab.pending.length,
    upcoming: itemsByTab.upcoming.length,
    in_progress: itemsByTab.in_progress.length,
    history: itemsByTab.history.length,
  };

  // Nếu người dùng chọn tab, lấy dữ liệu tab đó
  const filtered = itemsByTab[activeTab] || [];

  // Handlers
  const openBookingDetail = useCallback(
    (booking: Booking) => {
      nav.navigate("BookingDetail", { bookingId: booking.id, taskId: booking.task_id });
    },
    [nav]
  );

  const handleCancelBooking = useCallback(
    (booking: Booking) => {
      // RN Alert.alert 2 nút (Đóng / Hủy đơn) → window.confirm
      const ok = window.confirm(
        `Đổi người / Hủy đơn\n\nHủy đơn "${booking.job_title || "này"}"? Sinh viên đã chọn sẽ được thông báo, tiền ký quỹ MoMo Escrow được bảo toàn 100%.`
      );
      if (!ok) return;
      (async () => {
        setActionLoading(`booking-cancel-${booking.id}`);
        try {
          await cancelBookingByParent(String(booking.id ?? ""), "");
          showAlert("Thành công", "Đã hủy đơn. Bạn có thể chọn sinh viên khác cho công việc này.");
          await fetchAllData({ silent: true });
        } catch (e: any) {
          showAlert("Lỗi", e?.response?.data?.detail || "Thao tác thất bại.");
        } finally {
          setActionLoading(null);
        }
      })();
    },
    [fetchAllData]
  );

  const handleCompleteBooking = useCallback(
    (booking: Booking) => {
      const ok = window.confirm(
        "Nghiệm thu ca làm\n\nXác nhận ca học đã hoàn tất tốt đẹp? Tiền ký quỹ sẽ được giải ngân 80% cho sinh viên qua MoMo Escrow."
      );
      if (!ok) return;
      (async () => {
        setActionLoading(`booking-complete-${booking.id}`);
        try {
          await completeBooking(String(booking.id ?? ""));
          showAlert("Thành công", "Ca làm đã hoàn tất và giải ngân thành công.");
          await fetchAllData({ silent: true });
        } catch (e: any) {
          showAlert("Lỗi", e?.response?.data?.detail || "Thao tác thất bại.");
        } finally {
          setActionLoading(null);
        }
      })();
    },
    [fetchAllData]
  );

  const handleCancelTask = useCallback(
    (task: ParentTask) => {
      const ok = window.confirm(`Hủy việc\n\nBạn có chắc muốn hủy "${task.title}"?`);
      if (!ok) return;
      (async () => {
        setActionLoading(`${task.id}-cancelled`);
        try {
          await updateTaskStatus(task.id as any, "cancelled");
          await fetchAllData({ silent: true });
        } catch (_) {
          showAlert("Lỗi", "Không thể hủy việc.");
        } finally {
          setActionLoading(null);
        }
      })();
    },
    [fetchAllData]
  );

  const renderItem = (item: ListItem) => {
    if (item.kind === "booking") {
      const b = item.data;
      switch (b.status) {
        case "awaiting_commitment":
          return (
            <AwaitingBookingCard
              key={`booking-${b.id}`}
              booking={b}
              onOpenDetail={openBookingDetail}
              onCancel={handleCancelBooking}
              actionLoading={actionLoading}
            />
          );
        case "committed":
          return <CommittedBookingCard key={`booking-${b.id}`} booking={b} onOpenDetail={openBookingDetail} />;
        case "in_progress":
          return (
            <InProgressBookingCard
              key={`booking-${b.id}`}
              booking={b}
              onOpenDetail={openBookingDetail}
              onComplete={handleCompleteBooking}
              actionLoading={actionLoading}
            />
          );
        default:
          return <HistoryBookingCard key={`booking-${b.id}`} booking={b} onOpenDetail={openBookingDetail} />;
      }
    }

    // item.kind === 'task' — luồng legacy (core.Task)
    const t = item.data;
    if (t.status === "open") {
      return (
        <OpenTaskCard
          key={`task-${t.id}`}
          task={t}
          onCancelTask={handleCancelTask}
          candidateCount={candidateCounts[String(t.id)]}
          isCancelling={actionLoading === `${t.id}-cancelled`}
        />
      );
    }
    // N-003 (Blocker A): in_progress / completed của task legacy PHẢI có thẻ riêng với nút chat
    return (
      <LegacyTaskCard
        key={`task-${t.id}`}
        task={t}
        candidateCount={candidateCounts[String(t.id)]}
        isCancelling={actionLoading === `${t.id}-cancelled`}
        onCancelTask={handleCancelTask}
      />
    );
  };

  const emptyByTab: Record<TabKey, { icon: string; title: string; text: string }> = {
    pending: {
      icon: "hourglass-outline",
      title: "Không có đơn nào đang chờ",
      text: "Khi bạn đăng việc mới hoặc lựa chọn sinh viên, đơn sẽ xuất hiện tại đây.",
    },
    upcoming: {
      icon: "calendar-outline",
      title: "Chưa có ca làm nào sắp tới",
      text: "Khi sinh viên bấm xác nhận nhận việc, ca làm sẽ tự động chuyển vào đây.",
    },
    in_progress: {
      icon: "navigate-outline",
      title: "Không có ca làm đang diễn ra",
      text: "Các ca học trong khung giờ thực hiện sẽ được kích hoạt radar giám sát an toàn tại đây.",
    },
    history: {
      icon: "time-outline",
      title: "Chưa có lịch sử hoàn thành",
      text: "Các ca làm kết thúc sẽ được lưu trữ tại đây kèm đánh giá và hóa đơn MoMo.",
    },
  };

  return (
    <Screen bg={STITCH.canvas} scroll={false}>
      <StatusBarSpacer />
      <div
        style={{
          opacity: faded ? 1 : 0,
          transition: `opacity ${ANIM.timingNormal}ms`,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* TOP HEADER (Stitch Top Header) */}
        <div style={{ ...S.header, paddingTop: 12 }}>
          <div style={S.headerLeftWrap}>
            <div style={S.logoBadge}>
              <Icon name="shield-checkmark" size={18} color="#FFFFFF" />
            </div>
            <div>
              <div style={S.topBrandText}>Việc Của Tôi</div>
              <div style={S.subBrandText}>EduCareLink • Phụ huynh</div>
            </div>
          </div>
          <div style={S.headerRightWrap}>
            {/* Lịch sử nhật ký chăm sóc — entry point cho CareDiaryHistoryScreen */}
            <Touchable
              onPress={() => nav.navigate("CareDiaryHistory")}
              activeOpacity={0.85}
              style={S.diaryHistoryBtn}
            >
              <Icon name={ic("book-outline")} size={17} color={STITCH.primaryContainer} />
            </Touchable>
            <NotificationBell variant="plain" />
            <Touchable onPress={() => nav.navigate("JobTypeSelect")} activeOpacity={0.88} style={S.postJobBtn}>
              <Icon name="add" size={16} color="#FFFFFF" />
              <span style={S.postJobBtnText}>Đăng việc mới</span>
            </Touchable>
          </div>
        </div>

        {/* Sub-header Banner */}
        <div style={S.subBanner}>
          <div style={S.subBannerTitle}>Việc của tôi</div>
          <div style={S.subBannerDesc}>Quản lý và giám sát toàn bộ ca học & coi trẻ của gia đình</div>
        </div>

        {/* 4-TAB SEGMENTED CONTROLLER */}
        <div style={S.tabContainer}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            const count = tabCounts[tab.key] || 0;
            return (
              <Touchable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
                style={{ ...S.tabBtn, ...(active ? S.tabBtnActive : {}) }}
              >
                {tab.live && (
                  <span style={{ marginRight: 2 }}>
                    <PingDot color={active ? STITCH.primaryContainer : STITCH.secondary} size={6} />
                  </span>
                )}
                <Icon name={ic(tab.icon)} size={13} color={active ? STITCH.primaryContainer : STITCH.slateMuted} />
                <span
                  style={{
                    ...S.tabBtnText,
                    ...(active ? S.tabBtnTextActive : {}),
                    ...clamp(1),
                  }}
                >
                  {tab.label} ({count})
                </span>
              </Touchable>
            );
          })}
        </div>

        {/* BODY CONTENT */}
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
            <Spinner size={30} color={STITCH.primaryContainer} />
          </div>
        ) : loadError ? (
          <div style={S.centerBox}>
            <Icon name="cloud-offline-outline" size={44} color={STITCH.slateMuted} />
            <span style={S.errorMsg}>{loadError}</span>
            <Touchable onPress={() => fetchAllData()} activeOpacity={0.85} style={S.retryBtn}>
              <span style={S.retryBtnText}>Thử lại</span>
            </Touchable>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "16px 16px 120px", // RN paddingBottom 36 + chừa chỗ cho TabBar fixed 84
            }}
          >
            {filtered.length === 0 ? (
              <div style={S.emptyWrap}>
                <div style={S.emptyIconWrap}>
                  <Icon
                    name={ic(emptyByTab[activeTab]?.icon || "folder-open-outline")}
                    size={34}
                    color={STITCH.primaryContainer}
                  />
                </div>
                <div style={S.emptyTitle}>{emptyByTab[activeTab]?.title}</div>
                <div style={S.emptyDesc}>{emptyByTab[activeTab]?.text}</div>
                {activeTab === "pending" && (
                  <Touchable
                    onPress={() => nav.navigate("JobTypeSelect")}
                    activeOpacity={0.88}
                    style={S.emptyPostBtn}
                  >
                    <Icon name="add-circle" size={17} color="#FFFFFF" />
                    <span style={S.emptyPostBtnText}>Đăng việc mới ngay</span>
                  </Touchable>
                )}
              </div>
            ) : (
              filtered.map((item) => renderItem(item))
            )}
          </div>
        )}
      </div>
    </Screen>
  );
};

/* ============ Helpers style ============ */
/** numberOfLines của RN Text → CSS clamp/ellipsis */
const clamp = (n: number): React.CSSProperties =>
  n === 1
    ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
    : { display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties;

// ═══════════════════════════════════════════════════════════════
// STYLESHEET (Mapping toàn bộ Stitch Tailwind tokens — 1:1 với RN)
// ═══════════════════════════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  // === TOP HEADER ===
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 16px 10px",
    background: STITCH.canvas,
  },
  headerLeftWrap: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: STITCH.primaryContainer,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    boxShadow: SHADOWS.small,
  },
  topBrandText: { fontSize: 15, fontWeight: 700, color: STITCH.onSurface, lineHeight: "19px" },
  subBrandText: { fontSize: 10, fontWeight: 600, color: STITCH.slateText },
  headerRightWrap: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  diaryHistoryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    background: STITCH.primaryLight,
    border: `1px solid ${STITCH.amberBorder}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  postJobBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: STITCH.primaryContainer,
    padding: "7px 11px",
    borderRadius: 999,
    boxShadow: SHADOWS.small,
  },
  postJobBtnText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: 700 },

  // === SUB-BANNER ===
  subBanner: { padding: "0 16px 10px" },
  subBannerTitle: { fontSize: 22, fontWeight: 800, color: STITCH.onSurface, letterSpacing: "-0.3px" },
  subBannerDesc: { fontSize: 11.5, color: STITCH.slateText, marginTop: 2 },

  // === 4-TAB SEGMENTED CONTROLLER ===
  tabContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#EAEFFF",
    borderRadius: 14,
    padding: 3.5,
    margin: "0 16px 8px",
  },
  tabBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 0",
    borderRadius: 10,
    gap: 3,
    minWidth: 0,
  },
  tabBtnActive: { background: "#FFFFFF", boxShadow: SHADOWS.small },
  tabBtnText: { fontSize: 11, fontWeight: 600, color: STITCH.slateText },
  tabBtnTextActive: { color: STITCH.primaryContainer, fontWeight: 800 },

  // === CARD CORE ===
  card: {
    background: STITCH.cardSurface,
    border: `1px solid ${STITCH.cardBorder}`,
    borderTop: `4px solid ${STITCH.cardBorder}`,
    borderRadius: 18,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  cardHeader: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardPrice: { fontSize: 16, fontWeight: 800, color: STITCH.onSurface },
  badgeOrderCode: { fontSize: 11, color: STITCH.slateMuted, fontWeight: 600 },

  // === STATUS PILL ===
  statusPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: "3.5px 9px",
    borderRadius: 999,
  },
  statusPillText: { fontSize: 10.5, fontWeight: 700 },

  // === COUNTDOWN RIBBON (Tab 1 Card 1A) ===
  countdownRibbon: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    background: STITCH.amberLight,
    border: `1px solid ${STITCH.amberBorder}`,
    borderRadius: 11,
    padding: "7px 10px",
  },
  countdownLeft: { display: "flex", flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 },
  countdownText: { fontSize: 11, color: STITCH.amberDark },
  countdownBold: { fontWeight: 800, color: STITCH.amberDark },
  escrowBadge: { display: "flex", flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0 },
  escrowBadgeText: { fontSize: 10.5, fontWeight: 700, color: STITCH.secondary },

  // === STUDENT SPOTLIGHT ROW ===
  spotlightRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    background: "#F8FAFC",
    borderRadius: 12,
    padding: 8,
  },
  avatarWrap: { width: 44, height: 44, position: "relative", flexShrink: 0 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, objectFit: "cover" },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: "#FFEDD5",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 16, fontWeight: 800, color: STITCH.primaryContainer },
  verifiedBadge: { position: "absolute", bottom: -2, right: -2, background: "#FFFFFF", borderRadius: 7 },
  spotlightName: { fontSize: 14, fontWeight: 700, color: STITCH.onSurface },
  spotlightSchool: { fontSize: 11, color: STITCH.slateText, marginTop: 1 },
  chipRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  starChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    background: "#FFFBEB",
    padding: "2px 6px",
    borderRadius: 999,
  },
  starChipText: { fontSize: 10, fontWeight: 700, color: STITCH.amberDark },
  cccdChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    background: "#ECFDF5",
    padding: "2px 6px",
    borderRadius: 999,
  },
  cccdChipText: { fontSize: 10, fontWeight: 700, color: STITCH.secondary },

  // === JOB BRIEF BOX ===
  jobBriefBox: {
    background: "#F8FAFC",
    borderRadius: 11,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  jobBriefTitle: { fontSize: 13.5, fontWeight: 700, color: STITCH.onSurface },
  metaRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11.5, color: STITCH.slateText },

  // === ACTIONS ===
  cardActionsRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  btnInverse: {
    flex: 1,
    background: STITCH.inverseSurface,
    padding: "10px 0",
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  btnInverseText: { color: STITCH.inverseOnSurface, fontSize: 12, fontWeight: 700 },
  btnDangerSubtle: {
    background: STITCH.errorContainer,
    padding: "10px 12px",
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDangerSubtleText: { color: STITCH.onErrorContainer, fontSize: 12, fontWeight: 700 },

  // === AI PROMPT BANNER (Tab 1 Card 1B) ===
  aiPromptBanner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: STITCH.primaryLight,
    border: "1px solid #FED7AA",
    padding: 9,
    borderRadius: 10,
  },
  aiPromptText: { flex: 1, fontSize: 11, color: "#9A3412", lineHeight: "16px" },
  btnPrimaryAction: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: STITCH.primaryContainer,
    padding: "10px 0",
    borderRadius: 11,
    boxShadow: SHADOWS.small,
  },
  btnPrimaryActionText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: 700 },
  btnCancelText: { padding: "10px 8px" },
  btnCancelTextLabel: { fontSize: 11.5, color: STITCH.slateMuted, fontWeight: 600 },

  // === TAB 2 (UPCOMING) SPECIFIC ===
  upcomingHighlightBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: "#ECFDF5",
    borderRadius: 10,
    padding: 8,
  },
  upcomingHighlightText: { fontSize: 11.5, fontWeight: 700, color: STITCH.secondary },
  contactBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    background: "#F1F5F9",
    padding: "9px 0",
    borderRadius: 10,
  },
  contactBtnText: { fontSize: 11.5, fontWeight: 700, color: STITCH.onSurface },
  btnSecondaryFull: {
    background: "#F8FAFC",
    border: `1px solid ${STITCH.borderSubtle}`,
    padding: "9px 0",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryFullText: { fontSize: 11.5, fontWeight: 700, color: STITCH.slateText },

  // === TAB 3 (IN-PROGRESS) SPECIFIC ===
  liveHeaderText: { fontSize: 11.5, fontWeight: 800, color: STITCH.secondary, letterSpacing: "0.2px" },
  progressTimeText: { fontSize: 11, color: STITCH.slateText },
  progressBarTrack: {
    width: "100%",
    height: 6,
    background: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", background: STITCH.secondary, borderRadius: 999 },
  radarCard: {
    background: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  radarHeaderRow: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  radarTitle: { fontSize: 12, fontWeight: 700, color: STITCH.onSurface },
  radarRadius: { fontSize: 10.5, color: STITCH.slateText },
  radarFooterRow: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  radarFooterText: { fontSize: 10, color: STITCH.slateText },
  sosButton: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 10,
    padding: "8px 0",
  },
  sosButtonText: { color: STITCH.alertCrimson, fontSize: 11, fontWeight: 700 },
  chatShiftBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: STITCH.skyLight,
    border: `1px solid ${STITCH.skyBorder}`,
    borderRadius: 12,
    padding: "11px 0",
  },
  chatShiftBtnText: { color: STITCH.skyActive, fontSize: 12.5, fontWeight: 800 },
  completeShiftBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: STITCH.secondary,
    padding: "11px 0",
    borderRadius: 12,
    boxShadow: SHADOWS.medium,
  },
  completeShiftBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: 800 },

  // === TAB 4 (HISTORY) SPECIFIC ===
  historyDateText: { fontSize: 11, color: STITCH.slateMuted },
  refundBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: STITCH.amberLight,
    padding: 8,
    borderRadius: 8,
  },
  refundBoxText: { fontSize: 11, color: STITCH.amberDark, fontWeight: 600 },
  cancelReasonText: { fontSize: 11, color: STITCH.slateText },
  careDiaryBox: { background: "#F8FAFC", borderRadius: 10, padding: 9, display: "flex", flexDirection: "column", gap: 4 },
  careDiaryHeader: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  careDiaryTitle: { fontSize: 11.5, fontWeight: 700, color: STITCH.onSurface },
  careDiaryLink: { fontSize: 11, fontWeight: 700, color: STITCH.primaryContainer },
  reviewPromptRow: { display: "flex", flexDirection: "row", gap: 8 },
  reviewedBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    background: "#F1F5F9",
    padding: "9px 0",
    borderRadius: 10,
  },
  reviewedBtnText: { fontSize: 11.5, fontWeight: 700, color: STITCH.onSurface },
  rebookBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: STITCH.primaryContainer,
    padding: "10px 0",
    borderRadius: 11,
    boxShadow: SHADOWS.small,
  },
  rebookBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: 800 },

  // === EMPTY / ERROR ===
  centerBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 30px 0",
    gap: 10,
  },
  errorMsg: { fontSize: 12, color: STITCH.slateText, textAlign: "center" },
  retryBtn: {
    background: STITCH.primaryContainer,
    padding: "8px 18px",
    borderRadius: 10,
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: 700 },
  emptyWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 30px 0",
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: STITCH.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: 800, color: STITCH.onSurface, textAlign: "center" },
  emptyDesc: { fontSize: 11.5, color: STITCH.slateText, textAlign: "center", lineHeight: "17px" },
  emptyPostBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: STITCH.primaryContainer,
    padding: "10px 16px",
    borderRadius: 12,
    marginTop: 8,
  },
  emptyPostBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: 800 },
};

/* ============ Types dữ liệu API (shape từ backend, dùng đúng field RN đọc) ============ */
interface TaskSlot {
  date?: string;
  date_vi?: string;
  day_of_week_vi?: string;
  time_from?: string;
  time_to?: string;
}
interface CarePartnerInfo {
  full_name?: string;
  school?: string;
  major?: string;
  rating_avg?: number;
  jobs_completed?: number;
  avatar_url?: string;
  phone?: string;
}
interface Booking {
  id?: string;
  status?: string;
  status_label_vi?: string;
  total_value_vnd?: number;
  carepartner_payout_vnd?: number;
  compensation_vnd?: number;
  seconds_left?: number;
  job_title?: string;
  job_address?: string;
  location_info?: { address?: string };
  first_slot?: TaskSlot;
  carepartner_info?: CarePartnerInfo;
  carepartner_id?: number | string;
  task_id?: number | string;
  ended_at?: string;
  cancel_reason_code?: string;
  review?: { rating?: number } | null;
  started_at?: string;
}
interface ParentTask {
  id?: number | string;
  title?: string;
  status?: string;
  price?: number;
  scheduled_time?: string;
  location?: string;
}
type ListItem = { kind: "booking"; data: Booking } | { kind: "task"; data: ParentTask };

export default MyTasksScreen;
