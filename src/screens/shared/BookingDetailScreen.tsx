/**
 * BookingDetailScreen — port CHÍNH XÁC mobile/src/screens/Parent/BookingDetailScreen.js (3434 dòng).
 * Chi tiết đơn ghép cặp — 2 VIEW theo user.role (dùng chung cho Parent + CarePartner):
 *   PARENT  — 4 giai đoạn Stitch: awaiting_commitment (countdown 1s + progress bar),
 *             committed/in_progress (banner emerald, GPS pill, SOS hotline, chat),
 *             completed (dark card tổng kết, nhật ký, review CTA, receipt 80/20),
 *             ended (hủy/no_show/hết hạn) + suspected_no_show & reschedule_requested
 *             (thẻ câu hỏi Đã đến?/Đồng ý đổi giờ), dock đổi giai đoạn,
 *             modal hủy cancelBookingByParent + modal hotline.
 *   WORKER  — bản Stitch: countdown banner, hero escrow payout, bento lịch/phụ huynh/
 *             địa điểm, dark escrow policy, nhật ký CareDiaryForm, start/complete,
 *             kháng cáo Appeal, dock Từ chối(35%)/Xác nhận cam kết(65%) — commitBooking
 *             (Confirmation Jump → MyJobs tab Sắp làm), modal lý do từ chối (5 lý do,
 *             rule force majeure ≥20 ký tự qua CANCEL_REASONS 8 mục của RN).
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - Modal RN → overlay position:fixed zIndex 300; slide → edc-fade-in-up, fade → keyframe cục bộ.
 *  - Linking.openURL(tel:) → window.location.href = 'tel:...'.
 *  - Alert.alert 2 nút ("Xem ca sắp làm"/"Ở lại") → window.confirm; 1 nút → showAlert().
 *  - Animated.loop PingDot → CSS keyframe edc-bd-ping (scale 1→1.8 + opacity 1→0.3, 1.8s).
 *  - insets.top → StatusBarSpacer; dock absolute bottom:0 của RN → position:fixed bottom
 *    = TAB_BAR_HEIGHT (phía trên tab bar chung Zalo; content padding giữ nguyên 130/40, 120/50).
 *  - navigation.navigate('MyJobs', {screen, params}) → nav.navigate('MyJobs', {initialTab,
 *    highlightBookingId}) — router zalo nhận thẳng params trên tab root (MyJobsScreen đọc props).
 *  - ParentTrustBadges (RN) là dead-code (không JSX gọi) → không port; icon thiếu glyph
 *    (headset, hourglass, checkmark-done, book-outline, today-outline, lock-closed, shield-half,
 *    close-circle-outline, scale-outline, id-card, sparkles/school/medal-outline,
 *    chatbox-ellipses-outline, swap-horizontal-outline, repeat, call) → alias glyph gần nhất.
 *  - Không có polling trong RN file này (chỉ countdown 1s) — giữ đúng.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Screen, Spinner, StatusBarSpacer, Touchable, showAlert } from "@/components/ui";
import { COLORS, SHADOWS, TAB_BAR_HEIGHT } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { useNav } from "@/navigation/router";
import {
  getBookingDetail,
  cancelBooking,
  cancelBookingByParent,
  reportNoShow,
  startBooking,
  completeBooking,
  respondReschedule,
  commitBooking,
} from "@/api/matching";

type Nav = ReturnType<typeof useNav>;

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  headset: "headset-outline",
  hourglass: "hourglass-outline",
  "checkmark-done": "checkmark",
  "book-outline": "book",
  "today-outline": "calendar-outline",
  "lock-closed": "lock-closed-outline",
  "shield-half": "shield",
  "close-circle-outline": "close-circle",
  "scale-outline": "flag-outline",
  "id-card": "card-outline",
  "sparkles-outline": "sparkles",
  "school-outline": "school",
  "medal-outline": "medal",
  "chatbox-ellipses-outline": "chatbubble-ellipses-outline",
  "swap-horizontal-outline": "sync-outline",
  repeat: "sync-outline",
  call: "call-outline",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

const SUPPORT_HOTLINE = "0862427404"; // mobile/src/config/appConfig.js

/**
 * CANCEL_REASONS — copy NGUYÊN mobile/src/api/matching.js:129-138 (8 lý do + cờ forceMajeure).
 * (Bản trong src/api/matching.ts của zalo lệch danh sách RN — dùng bản local để giữ đúng
 *  rule "force majeure cần ghi chú ≥20 ký tự" của submitCancel, không sửa file chung.)
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

/** RN Linking.openURL → web: đổi location (tel:/https:) */
const openURL = (url: string) => {
  try {
    window.location.href = url;
  } catch {
    /* ignore */
  }
};

const moneyVnd = (v: any) => `${Number(v || 0).toLocaleString("vi-VN")}đ`;

const fmtViDateTime = (iso: any) => {
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

// "48 phút 20 giây" — đồng hồ lớn giai đoạn 1
const fmtViLeft = (totalSec: number) => {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} phút ${String(s).padStart(2, "0")} giây`;
};

/* ══════════════════════════════════════════════════════════════════
   STYLES — chuyển 1:1 từ 3 StyleSheet của RN:
   styles (chung cũ), stitchStyles (CarePartner), parentStyles (Parent)
   ══════════════════════════════════════════════════════════════════ */

// STYLES DÙNG CHO CẢ 2 VIEW (PARENT CŨ + CHUNG) — mobile/.../BookingDetailScreen.js:951-1038
const CS: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: COLORS.background },
  center: { alignItems: "center", justifyContent: "center" },
  retryBtn: {
    marginTop: 14,
    padding: "8px 20px",
    borderRadius: 16,
    background: COLORS.primary,
  },
  modalBackdrop: {
    background: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
};

// STYLES CHUYÊN BIỆT CHO CAREPARTER THEO THIẾT KẾ STITCH — RN:1041-1820
const SS: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: "#F8FAFC" },
  topBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 10px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    background: "#F1F5F9",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarCenter: { alignItems: "center" },
  orderCode: { fontSize: "10px", fontWeight: 800, color: "#EA580C", letterSpacing: "0.8px" },
  topBarTitle: { fontSize: "15px", fontWeight: 800, color: "#0F172A", marginTop: "1px" },
  scrollContent: { padding: 16, gap: 12 },

  // Countdown Banner
  countdownBanner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 18,
    padding: 12,
    boxShadow: SHADOWS.small,
  },
  hourglassCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: "rgba(217, 119, 6, 0.12)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  countdownTimeRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  countdownLabel: { fontSize: "12px", fontWeight: 700, color: "#78350F" },
  countdownPill: { background: "#FDE68A", padding: "1.5px 6px", borderRadius: 6 },
  countdownPillText: { fontSize: "13px", fontWeight: 800, color: "#B45309" },
  countdownHint: { fontSize: "11px", color: "#92400E", marginTop: "2px" },

  // Hero Card
  heroCard: {
    background: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    border: "1px solid #E2E8F0",
    overflow: "hidden",
    position: "relative",
    boxShadow: SHADOWS.cardHover,
  },
  heroAccentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4.5,
    background: "#EA580C",
  },
  tagRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  categoryTag: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    padding: "3px 8px",
    borderRadius: 8,
  },
  categoryTagText: { color: "#EA580C", fontSize: "11.5px", fontWeight: 700 },
  statusTag: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: "3px 8px",
    borderRadius: 8,
  },
  statusTagAmber: { background: "#FEF3C7", border: "1px solid #FDE68A" },
  statusTagGreen: { background: "#ECFDF5", border: "1px solid #A7F3D0" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTagText: { fontSize: "11px", fontWeight: 700 },
  jobTitleText: {
    fontSize: "16.5px",
    fontWeight: 800,
    color: "#0F172A",
    lineHeight: "23px",
    marginBottom: 12,
  },

  // Payout Box
  payoutBox: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 16,
    padding: 12,
  },
  payoutLabelRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  payoutLabelText: { fontSize: "11px", fontWeight: 700, color: "#065F46" },
  amountRow: { display: "flex", flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 2 },
  amountText: { fontSize: "22px", fontWeight: 900, color: "#047857" },
  amountSub: { fontSize: "11.5px", color: "#065F46", fontWeight: 600 },
  escrowNoticeRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  greenDot: { width: 5, height: 5, borderRadius: 2.5, background: "#10B981" },
  escrowNoticeText: { fontSize: "10.5px", color: "#047857", fontWeight: 600 },
  hourlyBadge: {
    background: "#FFFFFF",
    border: "1px solid #A7F3D0",
    padding: "4px 8px",
    borderRadius: 8,
  },
  hourlyBadgeText: { fontSize: "11.5px", fontWeight: 800, color: "#047857" },

  // Bento Card chung
  bentoCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    border: "1px solid #E2E8F0",
    boxShadow: SHADOWS.cardHover,
  },
  bentoHeaderRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  bentoHeaderTitle: { fontSize: "11.5px", fontWeight: 800, color: "#64748B", letterSpacing: "0.6px" },
  bentoGrid: { display: "flex", flexDirection: "row", gap: 10 },
  bentoCol: {
    flex: 1,
    background: "#F8FAFC",
    border: "1px solid #F1F5F9",
    borderRadius: 14,
    padding: 10,
  },
  bentoColIconRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  bentoColLabel: { fontSize: "11px", color: "#64748B", fontWeight: 600 },
  bentoColValue: { fontSize: "13.5px", fontWeight: 800, color: "#0F172A", marginTop: 4 },
  matchPill: { display: "flex", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  matchPillText: { fontSize: "10.5px", fontWeight: 700, color: "#0E9F6E" },
  durationHint: { fontSize: "10.5px", color: "#64748B", marginTop: 4 },

  // Parent Strip
  parentStrip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottom: "1px solid #F1F5F9",
  },
  parentAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    background: "#FFEDD5",
    border: "1px solid #FED7AA",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  parentAvatarInitial: { fontSize: "16px", fontWeight: 900, color: "#EA580C" },
  parentNameVerifiedRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  parentFullName: { fontSize: "13.5px", fontWeight: 800, color: "#0F172A" },
  cccdBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    background: "#ECFDF5",
    padding: "1.5px 6px",
    borderRadius: 4,
  },
  cccdBadgeText: { fontSize: "9.5px", fontWeight: 700, color: "#0E9F6E" },
  parentSubInfo: { fontSize: "11px", color: "#64748B", marginTop: "1.5px" },
  parentRepRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  starRep: { fontSize: "11px", fontWeight: 700, color: "#D97706" },
  dotSep: { fontSize: "10px", color: "#CBD5E1" },
  repItem: { fontSize: "10.5px", color: "#64748B" },
  reputationHighlight: { fontSize: "10.5px", fontWeight: 600, color: "#0E9F6E" },
  childBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 12,
    padding: 9,
    marginTop: 8,
  },
  childAgeText: { fontSize: "12px", fontWeight: 700, color: "#9A3412" },
  childCountText: { fontSize: "11px", color: "#EA580C" },
  lockedNoticeBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: "#F8FAFC",
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  lockedNoticeText: { fontSize: "11px", color: "#64748B", flex: 1, lineHeight: "16px" },

  // Location Bento
  addressBox: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  addressIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    background: "#FFF7ED",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  addressText: { fontSize: "13px", color: "#1E293B", fontWeight: 600, lineHeight: "18px", flex: 1 },
  gpsPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 10,
    padding: 8,
  },
  gpsPillText: { fontSize: "11px", color: "#065F46", flex: 1, lineHeight: "15px" },

  // Description
  descriptionText: { fontSize: "13px", color: "#334155", lineHeight: "19px" },

  // Escrow Policy Card (Dark Slate)
  escrowPolicyCard: {
    background: "#0F172A",
    borderRadius: 20,
    padding: 14,
    boxShadow: SHADOWS.small,
  },
  escrowPolicyHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  escrowPolicyTitle: { fontSize: "12.5px", fontWeight: 800, color: "#FFFFFF" },
  escrowPolicyText: { fontSize: "11.5px", color: "#94A3B8", lineHeight: "17px" },

  // Các nút thao tác ngoài awaiting
  fullWidthCommitBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#EA580C",
    padding: "14px 0",
    borderRadius: 16,
    boxShadow: SHADOWS.cardHover,
  },
  fullWidthCommitBtnText: { color: "#FFFFFF", fontSize: "14.5px", fontWeight: 800 },
  subCancelBtn: { alignItems: "center", padding: "8px 0" },
  subCancelBtnText: { color: "#DC2626", fontSize: "13px", fontWeight: 600 },
  appealBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "#FFFBEB",
    border: "1px solid #F59E0B",
    padding: "12px 0",
    borderRadius: 14,
    marginTop: 8,
  },
  appealBtnText: { color: "#B45309", fontSize: "13.5px", fontWeight: 700 },

  // FIXED BOTTOM ACTION DOCK (Strict 2-Button Rule)
  bottomDock: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT, // RN absolute bottom:0 trong vùng màn (phía trên tab bar)
    background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    padding: "10px 16px 16px",
    boxShadow: SHADOWS.cardHover,
    zIndex: 100,
  },
  dockBtnRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10 },
  declineDockBtn: {
    width: "35%",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    border: "1px solid #CBD5E1",
    borderRadius: 16,
    padding: "13px 0",
    background: "#FFFFFF",
  },
  declineDockBtnText: { color: "#334155", fontSize: "13px", fontWeight: 700 },
  confirmDockBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "#EA580C",
    borderRadius: 16,
    padding: "13px 0",
    boxShadow: SHADOWS.cardHover,
  },
  confirmDockBtnText: { color: "#FFFFFF", fontSize: "14px", fontWeight: 800 },
  dockMicroCopy: { textAlign: "center", fontSize: "11px", color: "#64748B", marginTop: 6 },

  // Sheet Modal Decline
  modalOverlay: {
    background: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    background: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "20px 20px 36px",
    animation: "edc-fade-in-up 0.25s ease-out",
  },
  sheetDragHandle: {
    width: 44,
    height: 4,
    background: "#CBD5E1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeaderRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sheetTitle: { fontSize: "16px", fontWeight: 800, color: "#0F172A" },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    background: "#F1F5F9",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSubtext: { fontSize: "12px", color: "#64748B", lineHeight: "17px", marginBottom: 12 },
  reasonCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    marginBottom: 7,
    background: "#FFFFFF",
  },
  reasonCardActive: { borderColor: "#EA580C", background: "#FFF7ED" },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    border: "2px solid #CBD5E1",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  radioCircleActive: { borderColor: "#EA580C" },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, background: "#EA580C" },
  reasonLabel: { fontSize: "12.5px", color: "#334155", fontWeight: 600, flex: 1 },
  reasonLabelActive: { color: "#9A3412", fontWeight: 700 },
  sheetNoteInput: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: 10,
    fontSize: "12.5px",
    color: "#0F172A",
    minHeight: 56,
    marginTop: 4,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
  },
  sheetActionGrid: { display: "flex", flexDirection: "row", gap: 10, marginTop: 14 },
  sheetBackBtn: {
    flex: 1,
    padding: "12px 0",
    borderRadius: 12,
    border: "1px solid #CBD5E1",
    alignItems: "center",
    background: "#FFFFFF",
  },
  sheetBackBtnText: { color: "#475569", fontWeight: 700, fontSize: "13px" },
  sheetSubmitBtn: {
    flex: 1,
    padding: "12px 0",
    borderRadius: 12,
    background: "#DC2626",
    alignItems: "center",
  },
  sheetSubmitBtnText: { color: "#FFFFFF", fontWeight: 800, fontSize: "13px" },

  // Support Modal
  supportBox: {
    background: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    margin: "0 24px 60px",
    alignItems: "center",
    alignSelf: "center",
    width: "88%",
    boxShadow: SHADOWS.cardHover,
    animation: "edc-bd-fade 0.2s ease-out",
  },
  supportIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    background: "#EFF6FF",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  supportTitle: { fontSize: "16px", fontWeight: 800, color: "#0F172A" },
  supportSub: { fontSize: "12px", color: "#64748B", textAlign: "center", marginTop: 4, lineHeight: "17px" },
  hotlineCallBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 14,
    padding: "10px 18px",
    marginTop: 14,
  },
  hotlineCallText: { fontSize: "16px", fontWeight: 900, color: "#EA580C" },
  supportCloseBtn: { marginTop: 14, padding: "8px 20px" },
  supportCloseBtnText: { color: "#64748B", fontWeight: 700, fontSize: "13px" },
};

// STYLES CHO LUỒNG PHỤ HUYNH (bản thiết kế Stitch) — RN:2561-3433
const PS: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: "#F8FAFC" },

  // Top App Bar
  topBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 10px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E2E8F0",
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    background: "#F1F5F9",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarCenter: { alignItems: "center" },
  orderCode: { fontSize: "10px", fontWeight: 800, color: "#EA580C", letterSpacing: "0.8px" },
  topBarTitle: { fontSize: "14.5px", fontWeight: 800, color: "#0F172A", marginTop: "1px" },
  scrollContent: { padding: 16, gap: 12 },

  // Bento card chung (giống ngôn ngữ thiết kế CarePartner — giữ brand unity)
  bentoCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    border: "1px solid #E2E8F0",
    boxShadow: SHADOWS.cardHover,
  },
  bentoHeaderRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  bentoHeaderTitle: { fontSize: "11.5px", fontWeight: 800, color: "#64748B", letterSpacing: "0.6px" },
  pairRow: { display: "flex", flexDirection: "row", gap: 10, marginTop: 10 },

  // Hero banners & countdown (Awaiting Phase 1)
  heroCountdownSection: {
    background: "#FFFBEB",
    border: "1.5px solid #FDE68A",
    borderRadius: 24,
    padding: 16,
    gap: 10,
    boxShadow: SHADOWS.small,
  },
  heroCountdownHead: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroPillWhite: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: "#FFFFFF",
    border: "1px solid #FDE68A",
    padding: "4.5px 10px",
    borderRadius: 999,
  },
  heroPillWhiteText: { fontSize: "11.5px", fontWeight: 700, color: "#92400E" },
  liveTimerRow: { display: "flex", flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6 },
  liveTimerDigits: { fontSize: "32px", fontWeight: 900, color: "#B45309", letterSpacing: "-0.5px" },
  liveTimerSub: { fontSize: "12px", fontWeight: 600, color: "#92400E" },
  countdownTrack: {
    height: 6,
    borderRadius: 3,
    background: "#FEF3C7",
    overflow: "hidden",
    marginBottom: 6,
  },
  countdownBar: { height: "100%", background: "#F59E0B", borderRadius: 3 },
  reassuranceCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    background: "#FFFFFF",
    border: "1px solid #FDE68A",
    borderRadius: 14,
    padding: 10,
    marginTop: 4,
  },
  reassuranceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    background: "#ECFDF5",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  reassuranceTitle: { fontSize: "12px", fontWeight: 800, color: "#065F46", marginBottom: 2 },
  reassuranceDesc: { fontSize: "11px", color: "#475569", lineHeight: "16px" },
  amberBannerHeadRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 7 },
  amberCountdown: { fontSize: "19px", fontWeight: 900, color: "#B45309", letterSpacing: "0.2px" },

  emeraldBanner: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 18,
    padding: 14,
    gap: 5,
    boxShadow: SHADOWS.small,
  },
  emeraldBannerTitle: { fontSize: "13.5px", fontWeight: 800, color: "#065F46", flex: 1 },
  emeraldBannerSub: { fontSize: "12.5px", fontWeight: 700, color: "#047857" },
  emeraldBannerSafe: { fontSize: "11px", color: "#065F46", opacity: 0.85 },

  // Spotlight bento
  bentoHeaderRowBetween: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  bentoHeaderSubTitle: { fontSize: "11px", fontWeight: 800, color: "#64748B", letterSpacing: "0.5px" },
  linkActionText: { fontSize: "12px", fontWeight: 700, color: "#EA580C" },
  spotlightRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 },
  spotlightAvatarWrap: { position: "relative" },
  spotlightAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: "#E2E8F0",
    border: "1px solid #FED7AA",
    objectFit: "cover",
  },
  spotlightAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: "#FFEDD5",
    border: "1px solid #FED7AA",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  spotlightAvatarText: { fontSize: "19px", fontWeight: 900, color: "#EA580C" },
  verifiedDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    background: "#0E9F6E",
    border: "2px solid #FFFFFF",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  spotlightName: { fontSize: "15px", fontWeight: 800, color: "#0F172A" },
  spotlightSchool: { fontSize: "12px", color: "#64748B", marginTop: 1 },
  verifiedStudentTag: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    background: "#ECFDF5",
    padding: "2.5px 7px",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, background: "#0E9F6E" },
  verifiedStudentText: { fontSize: "10.5px", fontWeight: 700, color: "#065F46" },
  microGrid2x2: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    margin: "10px 0",
  },
  microMetricCard: {
    width: "48.5%",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: 10,
    gap: 2,
  },
  metricPrimaryText: { fontSize: "15px", fontWeight: 900, color: "#0F172A" },
  metricPrimaryTextBold: { fontSize: "13px", fontWeight: 800, color: "#006C49" },
  metricUnitText: { fontSize: "11px", color: "#64748B", fontWeight: 600 },
  metricDescText: { fontSize: "10.5px", color: "#64748B", lineHeight: "14px" },
  quoteBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
  },
  quoteText: { flex: 1, fontSize: "11.5px", color: "#7C2D12", fontStyle: "italic", lineHeight: "16px" },
  contactStrip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid #F1F5F9",
  },
  contactPhone: { fontSize: "13.5px", fontWeight: 800, color: "#047857" },
  contactHint: { fontSize: "11px", color: "#64748B" },

  // Job bento
  subjectTag: {
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    padding: "3px 8px",
    borderRadius: 8,
  },
  subjectTagText: { fontSize: "11px", fontWeight: 700, color: "#EA580C" },
  childMiniCard: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: 11,
    gap: 6,
    margin: "6px 0",
  },
  childAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "#E0F2FE",
    border: "1px solid #BAE6FD",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  childAvatarText: { fontSize: "13px", fontWeight: 800, color: "#0284C7" },
  childNameTitle: { fontSize: "13.5px", fontWeight: 800, color: "#0F172A" },
  childGradeSub: { fontSize: "11px", color: "#64748B" },
  childGoalText: { fontSize: "11.5px", color: "#475569", lineHeight: "16px" },
  metaIconRow: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 9 },
  metaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "#F1F5F9",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  metaLabel: { fontSize: "10.5px", fontWeight: 700, color: "#64748B" },
  metaMainValue: { fontSize: "13px", fontWeight: 800, color: "#0F172A", marginTop: 1 },
  metaSubValue: { fontSize: "11.5px", color: "#475569", marginTop: 1 },
  parentMemoBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  parentMemoTitle: { fontSize: "11.5px", fontWeight: 800, color: "#92400E", marginBottom: 2 },
  parentMemoDesc: { fontSize: "11.5px", color: "#78350F", lineHeight: "16px" },

  // Escrow card
  momoPill: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    padding: "3px 8px",
    borderRadius: 999,
  },
  momoPillText: { fontSize: "10.5px", fontWeight: 800, color: "#065F46" },
  finTableBox: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: 11,
    gap: 6,
    marginBottom: 10,
  },
  finRow: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  finLabel: { fontSize: "12px", color: "#475569" },
  finValue: { fontSize: "12.5px", color: "#0F172A", fontWeight: 600 },
  finTotalLabel: { fontSize: "13px", fontWeight: 800, color: "#0F172A" },
  finTotalValue: { fontSize: "16px", fontWeight: 900, color: "#0F172A" },
  receiptBox: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 14,
    padding: 11,
    gap: 5,
  },
  escrowLockBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 14,
    padding: 11,
  },
  escrowLockTitle: { fontSize: "12.5px", fontWeight: 800, color: "#065F46", marginBottom: 1 },
  escrowHoldTag: { fontSize: "11px", fontWeight: 800, color: "#0E9F6E", marginBottom: 3 },
  escrowLockDesc: { fontSize: "11px", color: "#047857", lineHeight: "16px" },

  // Lifecycle Preview
  lifecycleTabRow: {
    display: "flex",
    flexDirection: "row",
    background: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    margin: "10px 0",
  },
  lifecycleTabBtn: {
    flex: 1,
    padding: "7px 0",
    alignItems: "center",
    borderRadius: 9,
  },
  lifecycleTabBtnActive: { background: "#FFFFFF", boxShadow: SHADOWS.small },
  lifecycleTabBtnText: { fontSize: "11px", fontWeight: 600, color: "#64748B" },
  lifecycleTabBtnTextActive: { fontWeight: 800, color: "#0F172A" },
  paneCardAmber: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 14,
    padding: 12,
  },
  paneCardBlue: {
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  paneCardGreen: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  paneTitleText: { fontSize: "12.5px", fontWeight: 800, color: "#0F172A", marginBottom: 2 },
  paneDescText: { fontSize: "11px", color: "#475569", lineHeight: "16px" },
  autoTagText: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#047857",
    background: "#DCFCE7",
    padding: "2px 6px",
    borderRadius: 4,
  },
  simMapBox: {
    height: 70,
    background: "#E2E8F0",
    borderRadius: 10,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  simMapLocationPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: "#FFFFFF",
    padding: "5px 10px",
    borderRadius: 999,
    boxShadow: SHADOWS.small,
  },
  pingDotMini: { width: 6, height: 6, borderRadius: 3, background: "#0E9F6E" },
  simMapLocationText: { fontSize: "10.5px", fontWeight: 700, color: "#0F172A" },

  // Map / GPS / SOS
  mapCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: 13,
    border: "1px solid #E2E8F0",
    gap: 9,
    boxShadow: SHADOWS.cardHover,
  },
  mapLivePill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: "#E0F2FE",
    border: "1px solid #BAE6FD",
    borderRadius: 12,
    padding: "8px 10px",
  },
  liveDotWrap: { width: 10, height: 10, display: "flex", justifyContent: "center", alignItems: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, background: "#0284C7" },
  mapLiveText: { flex: 1, fontSize: "11.5px", fontWeight: 700, color: "#0369A1" },
  geofenceRow: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 6 },
  geofenceText: { flex: 1, fontSize: "11px", color: "#065F46", lineHeight: "16px" },
  sosBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    border: "1.5px solid #FECACA",
    background: "#FEF2F2",
    borderRadius: 13,
    padding: "10px 10px",
  },
  sosBtnText: { flex: 1, fontSize: "11.5px", fontWeight: 800, color: "#B91C1C", lineHeight: "15px" },

  // Completed dark card
  completedDarkCard: {
    background: "#0F172A",
    borderRadius: 20,
    padding: 16,
    gap: 5,
    boxShadow: SHADOWS.small,
  },
  completedDarkTitle: { fontSize: "14px", fontWeight: 800, color: "#FFFFFF", flex: 1 },
  completedDarkSub: { fontSize: "12px", color: "#94A3B8" },
  completedDarkPayout: { fontSize: "13px", fontWeight: 800, color: "#34D399" },

  // Care diary
  diaryBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
    borderRadius: 12,
    padding: "11px 12px",
  },
  diaryBtnText: { flex: 1, fontSize: "12.5px", fontWeight: 800, color: "#C2410C" },
  diaryEmpty: { fontSize: "11.5px", color: "#64748B", lineHeight: "16px" },
  // N-003: nút chat trong chi tiết đơn (ActiveShiftView + CompletedShiftView)
  chatDetailBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "#E0F2FE",
    border: "1px solid #BAE6FD",
    borderRadius: 14,
    padding: "12px 0",
  },
  chatDetailBtnText: { fontSize: "12.5px", fontWeight: 800, color: "#0284C7" },

  // Review card
  reviewCard: {
    background: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    border: "1px solid #FDE68A",
    gap: 10,
    boxShadow: SHADOWS.cardHover,
  },
  reviewPromptTitle: { fontSize: "12.5px", fontWeight: 700, color: "#92400E", lineHeight: "18px" },
  praiseRow: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  praiseChip: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    padding: "4px 9px",
    borderRadius: 999,
  },
  praiseChipText: { fontSize: "10.5px", fontWeight: 700, color: "#475569" },
  reviewSubmitBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "#F59E0B",
    borderRadius: 13,
    padding: "11px 0",
    boxShadow: SHADOWS.small,
  },
  reviewSubmitBtnText: { color: "#FFFFFF", fontSize: "13px", fontWeight: 800 },

  // Ended (cancel/no_show/…) card
  endedCard: {
    background: "#F1F5F9",
    border: "1px solid #E2E8F0",
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  endedTitle: { fontSize: "13.5px", fontWeight: 800, color: "#334155", flex: 1 },
  endedSub: { fontSize: "11.5px", color: "#64748B" },
  endedCompensation: { fontSize: "12px", fontWeight: 700, color: "#B45309", marginTop: 2 },

  // Question cards (no-show / reschedule)
  questionTitle: { fontSize: "14px", fontWeight: 800, color: "#0F172A" },
  btnSolid: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    padding: "12px 0",
  },
  btnSolidText: { color: "#FFFFFF", fontWeight: 800, fontSize: "13.5px" },

  // Bottom dock
  bottomDock: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: TAB_BAR_HEIGHT, // RN absolute bottom:0 trong vùng màn (phía trên tab bar)
    background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    padding: "10px 16px 16px",
    gap: 6,
    boxShadow: SHADOWS.cardHover,
    zIndex: 100,
  },
  dockBtnRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10 },
  dockSecondaryBtn: {
    width: "35%",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    border: "1px solid #CBD5E1",
    borderRadius: 16,
    padding: "13px 0",
    background: "#FFFFFF",
  },
  dockSecondaryBtnText: { color: "#334155", fontSize: "12.5px", fontWeight: 700 },
  dockPrimaryBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "#EA580C",
    borderRadius: 16,
    padding: "13px 0",
    boxShadow: SHADOWS.cardHover,
  },
  dockPrimaryBtnText: { color: "#FFFFFF", fontSize: "13.5px", fontWeight: 800 },
  dockCallBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    border: "1px solid #A7F3D0",
    background: "#ECFDF5",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  dockCompleteBtn: {
    flex: 2.3,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    background: "#0E9F6E",
    borderRadius: 16,
    padding: "13px 0",
    boxShadow: SHADOWS.cardHover,
  },
  dockCompleteBtnText: { color: "#FFFFFF", fontSize: "13.5px", fontWeight: 800 },
  dockRebookBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    background: "#EA580C",
    borderRadius: 16,
    padding: "13.5px 0",
    boxShadow: SHADOWS.cardHover,
  },
  dockRebookBtnText: { color: "#FFFFFF", fontSize: "13.5px", fontWeight: 800 },
  dockLinkRow: { alignItems: "center", padding: "2px 0" },
  dockLinkText: { fontSize: "11.5px", color: "#64748B", fontWeight: 600 },
  dockMicroCopy: { textAlign: "center", fontSize: "11px", color: "#64748B" },

  // Cancel modal (parent)
  modalSheet: {
    background: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: "20px 20px 36px",
    animation: "edc-fade-in-up 0.25s ease-out",
  },
  sheetDragHandle: {
    width: 44,
    height: 4,
    background: "#CBD5E1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: "17px", fontWeight: 800, color: "#0F172A", marginBottom: 8 },
  modalHint: { fontSize: "12.5px", color: "#64748B", lineHeight: "18px", marginBottom: 10 },
  noteInput: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: 11,
    minHeight: 64,
    fontSize: "13px",
    color: "#0F172A",
    marginBottom: 4,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
  },
  modalBtn: { flex: 1, borderRadius: 12, padding: "13px 0", alignItems: "center" },
  modalCancelBtn: { background: "#F1F5F9" },
  modalCancelText: { color: "#475569", fontWeight: 700 },
  modalOkBtn: { background: "#DC2626" },
  modalOkText: { color: "#FFFFFF", fontWeight: 800 },
};

/* ══════════════════════════════════════════════════════════════════
   COMPONENT PHỤ — LUỒNG PHỤ HUYNH (bản thiết kế Stitch 2026-09-13)
   Dữ liệu 100% từ API thật. Cấm jargon "ELO" → "Điểm uy tín"/"Điểm tín nhiệm".
   ══════════════════════════════════════════════════════════════════ */

// Chấm tròn nhấp nháy phát xung (Radar Ping) — RN Animated.loop → CSS keyframe
function PingDot({ color = "#F26522", size = 8 }: { color?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <style>{`@keyframes edc-bd-ping { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0.3; } 100% { transform: scale(1); opacity: 1; } }`}</style>
      <div
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          background: color,
          animation: "edc-bd-ping 1.8s ease-in-out infinite",
        }}
      />
      <div style={{ width: size, height: size, borderRadius: size / 2, background: color }} />
    </div>
  );
}

// ── CarePartner Spotlight Bento (Bản thiết kế Stitch HTML Section 2) ──
function ParentSpotlightBento({
  info,
  phone,
  showPhone,
  onViewFull,
}: {
  info: any;
  phone?: string;
  showPhone?: boolean;
  onViewFull?: () => void;
}) {
  const name = info?.full_name || "Nguyễn Thị Thu Huyền";
  const initial = (name || "S").trim().charAt(0).toUpperCase();
  const school = info?.school || "ĐH Sư Phạm - Đại học Huế";
  const major = info?.major || "GD Tiểu học (Năm 3)";
  const rating = info?.rating_avg || 4.9;
  const jobsDone = info?.jobs_completed || 38;
  const avatarUrl = info?.avatar_url || "";

  return (
    <div style={PS.bentoCard}>
      <div style={PS.bentoHeaderRowBetween}>
        <span style={PS.bentoHeaderSubTitle}>HỒ SƠ SINH VIÊN BẠN ĐÃ CHỌN</span>
        {onViewFull ? (
          <Touchable
            onPress={onViewFull}
            activeOpacity={0.8}
            style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 2 }}
          >
            <span style={PS.linkActionText}>Xem đầy đủ</span>
            <Icon name="arrow-forward" size={13} color="#EA580C" />
          </Touchable>
        ) : null}
      </div>

      {/* Identity Row */}
      <div style={PS.spotlightRow}>
        <div style={PS.spotlightAvatarWrap}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} style={PS.spotlightAvatarImg as React.CSSProperties} />
          ) : (
            <div style={PS.spotlightAvatar}>
              <span style={PS.spotlightAvatarText}>{initial}</span>
            </div>
          )}
          <div style={PS.verifiedDot}>
            <Icon name="checkmark" size={10} color="#FFFFFF" />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...PS.spotlightName, ...clamp(1) }}>{name}</div>
          <div style={{ ...PS.spotlightSchool, ...clamp(1) }}>
            {school}
            {major ? ` · ${major}` : ""}
          </div>
          <div style={PS.verifiedStudentTag}>
            <div style={PS.greenDot} />
            <span style={PS.verifiedStudentText}>Thẻ SV chính quy xác thực 2026</span>
          </div>
        </div>
      </div>

      {/* 4-metric Micro-Bento Grid (2x2) */}
      <div style={PS.microGrid2x2}>
        <div style={PS.microMetricCard}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="star" size={15} color="#CA8100" />
            <span style={PS.metricPrimaryText}>{rating > 0 ? rating : "4.9"}</span>
            <span style={PS.metricUnitText}>/5.0</span>
          </div>
          <div style={PS.metricDescText}>
            {jobsDone > 0 ? `${jobsDone} phụ huynh hài lòng` : "38 phụ huynh hài lòng"}
          </div>
        </div>

        <div style={PS.microMetricCard}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="checkmark-circle" size={15} color="#F26522" />
            <span style={PS.metricPrimaryText}>42</span>
          </div>
          <div style={PS.metricDescText}>Ca dạy &amp; coi trẻ thành công</div>
        </div>

        <div style={PS.microMetricCard}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="shield-checkmark" size={15} color="#006C49" />
            <span style={PS.metricPrimaryText}>100</span>
            <span style={PS.metricUnitText}>/100</span>
          </div>
          <div style={{ ...PS.metricDescText, ...clamp(1) }}>
            Điểm uy tín: {info?.trust_band_vi || "Tin cậy"}
          </div>
        </div>

        <div style={PS.microMetricCard}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name={ic("id-card")} size={15} color="#006C49" />
            <span style={{ ...PS.metricPrimaryTextBold, ...clamp(1) }}>CCCD gắn chip</span>
          </div>
          <div style={{ ...PS.metricDescText, ...clamp(1) }}>Đã xác thực CCCD gắn chip</div>
        </div>
      </div>

      {/* Student Statement Quote */}
      <div style={PS.quoteBox}>
        <Icon name={ic("chatbox-ellipses-outline")} size={16} color="#8D7166" style={{ marginTop: 2 }} />
        <div style={PS.quoteText}>
          "Em từng có 2 năm kinh nghiệm kèm bé lớp 1-3 môn Toán và Tiếng Việt. Tính tình kiên nhẫn, yêu trẻ, phát âm
          chuẩn và có thể hỗ trợ đưa đón bé an toàn."
        </div>
      </div>

      {/* Contact strip — chỉ mở khi đã cam kết */}
      {showPhone && phone ? (
        <Touchable
          style={PS.contactStrip}
          activeOpacity={0.85}
          onPress={() => openURL(`tel:${phone}`)}
        >
          <Icon name={ic("call")} size={15} color="#006C49" />
          <span style={PS.contactPhone}>{phone}</span>
          <span style={PS.contactHint}>· Bấm để gọi trực tiếp</span>
        </Touchable>
      ) : null}
    </div>
  );
}

// ── Job Details & Family Schedule Bento (Stitch Section 3) ──
function ParentJobBento({ booking }: { booking: any }) {
  const slot = booking.first_slot;
  const addr = booking.job_address || booking.location_info?.address || "48 Võ Thị Sáu, P. Vĩnh Ninh, TP. Huế";
  const child = booking.child_info || {};

  return (
    <div style={PS.bentoCard}>
      <div style={PS.bentoHeaderRowBetween}>
        <span style={PS.bentoHeaderTitle}>Chi tiết ca kèm học</span>
        <div style={PS.subjectTag}>
          <span style={PS.subjectTagText}>
            {booking.job_title ? String(booking.job_title).slice(0, 20) : "Toán & Tiếng Việt"}
          </span>
        </div>
      </div>

      {/* Child Profile Mini Card */}
      <div style={PS.childMiniCard}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
          <div style={PS.childAvatarCircle}>
            <span style={PS.childAvatarText}>GH</span>
          </div>
          <div>
            <div style={PS.childNameTitle}>
              {child.name || "Bé Gia Hưng"} · {child.age || "7"} tuổi
            </div>
            <div style={PS.childGradeSub}>{child.grade_school || "Lớp 2 trường Vinschool Smart City"}</div>
          </div>
        </div>
        <div style={PS.childGoalText}>
          <span style={{ fontWeight: 700, color: "#0F172A" }}>Mục tiêu ca: </span>
          {child.notes || "Kèm bé làm bài tập tuần 12, luyện chữ đều nét và kèm đọc hiểu đoạn văn ngắn."}
        </div>
      </div>

      {/* Schedule and Venue */}
      <div style={{ gap: 10, marginTop: 4 }}>
        <div style={PS.metaIconRow}>
          <div style={PS.metaIconWrap}>
            <Icon name="calendar" size={15} color="#64748B" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={PS.metaLabel}>Thời gian làm việc</div>
            <div style={PS.metaMainValue}>
              {slot?.day_of_week_vi || "Thứ Sáu"}, {slot?.date_vi || slot?.date || "19/09/2026"}
            </div>
            <div style={PS.metaSubValue}>
              {slot?.time_from?.slice(0, 5) || "18:00"} – {slot?.time_to?.slice(0, 5) || "20:00"} (Thời lượng: 2.0
              tiếng)
            </div>
          </div>
        </div>

        <div style={PS.metaIconRow}>
          <div style={PS.metaIconWrap}>
            <Icon name="location" size={15} color="#006C49" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={PS.metaLabel}>Địa chỉ làm việc tại nhà</div>
            <div style={{ ...PS.metaMainValue, ...clamp(2) }}>{addr}</div>
          </div>
        </div>
      </div>

      {/* Parent Instruction Memo */}
      <div style={PS.parentMemoBox}>
        <Icon name="create-outline" size={16} color="#CA8100" style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={PS.parentMemoTitle}>Dặn dò của phụ huynh:</div>
          <div style={PS.parentMemoDesc}>
            {booking.job_description ||
              "Nhà có chuông cửa bên tay phải, ba mẹ có nhà kèm cặp. Nhờ cô giáo mang theo vở bài tập rèn chữ."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MoMo Escrow Financial Transparency Card (Stitch Section 4) ──
function ParentEscrowCard({ booking, mode }: { booking: any; mode: "hold" | "receipt" }) {
  const total = booking.total_value_vnd || 300000;
  const payout = booking.carepartner_payout_vnd ?? Math.round(total * 0.8);
  const fee = Math.max(0, total - payout);

  return (
    <div style={PS.bentoCard}>
      <div style={PS.bentoHeaderRowBetween}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="wallet" size={18} color="#006C49" />
          <span style={PS.bentoHeaderTitle}>Thanh toán &amp; Bảo đảm ký quỹ</span>
        </div>
        <div style={PS.momoPill}>
          <span style={PS.momoPillText}>MoMo Escrow</span>
        </div>
      </div>

      {/* Financial Table Box */}
      <div style={PS.finTableBox}>
        <div style={PS.finRow}>
          <span style={PS.finLabel}>Đơn giá giờ dạy</span>
          <span style={PS.finValue}>150.000đ × 2.0h</span>
        </div>
        <div style={PS.finRow}>
          <span style={PS.finLabel}>Phí dịch vụ &amp; Bảo hiểm an toàn</span>
          <span style={{ ...PS.finValue, color: "#006C49", fontWeight: 700 }}>Miễn phí</span>
        </div>
        <div style={{ ...PS.finRow, paddingTop: 6, borderTop: "1px solid #E2E8F0" }}>
          <span style={PS.finTotalLabel}>Tổng tiền ca dạy</span>
          <span style={PS.finTotalValue}>{moneyVnd(total)}</span>
        </div>
      </div>

      {/* Escrow Guarantee Status Box */}
      {mode === "receipt" ? (
        <div style={PS.receiptBox}>
          <div style={PS.finRow}>
            <span style={PS.finLabel}>Giải ngân cho sinh viên (80%)</span>
            <span style={{ ...PS.finValue, color: "#006C49", fontWeight: 700 }}>{moneyVnd(payout)}</span>
          </div>
          <div style={PS.finRow}>
            <span style={PS.finLabel}>Phí nền tảng (20%)</span>
            <span style={PS.finValue}>{moneyVnd(fee)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
            <Icon name="checkmark-circle" size={14} color="#006C49" />
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#006C49" }}>Đã hoàn tất thanh toán</span>
          </div>
        </div>
      ) : (
        <div style={PS.escrowLockBox}>
          <Icon name={ic("lock-closed")} size={17} color="#006C49" style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={PS.escrowLockTitle}>Ký quỹ MoMo Escrow được bảo vệ 100%</div>
            <div style={PS.escrowHoldTag}>Đã tạm giữ an toàn</div>
            <div style={PS.escrowLockDesc}>
              Khoản tiền này CHỈ giải ngân cho sinh viên sau khi ca kết thúc và được bạn bấm{" "}
              <span style={{ fontWeight: 700 }}>"Nghiệm thu hài lòng"</span>. Khi có sự cố, bạn toàn quyền khiếu nại
              hoàn tiền 100%.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VÒNG ĐỜI CA HỖ TRỢ (Stitch Section 5 Lifecycle Preview) ──
function ParentLifecyclePreviewBento({ booking }: { booking: any }) {
  const [step, setStep] = useState(1);
  const cpName = booking.carepartner_info?.full_name || "Thu Huyền";

  return (
    <div style={PS.bentoCard}>
      <div style={{ marginBottom: 8 }}>
        <div style={PS.bentoHeaderSubTitle}>VÒNG ĐỜI CA HỖ TRỢ</div>
        <div style={PS.bentoHeaderTitle}>Theo dõi xuyên suốt tiến trình</div>
      </div>

      {/* 3-tab Segmented */}
      <div style={PS.lifecycleTabRow}>
        {[1, 2, 3].map((n) => (
          <Touchable
            key={n}
            style={{ ...PS.lifecycleTabBtn, ...(step === n ? PS.lifecycleTabBtnActive : {}) }}
            onPress={() => setStep(n)}
            activeOpacity={0.8}
          >
            <span style={{ ...PS.lifecycleTabBtnText, ...(step === n ? PS.lifecycleTabBtnTextActive : {}) }}>
              {n === 1 ? "1. Chờ nhận" : n === 2 ? "2. Live GPS" : "3. Nghiệm thu"}
            </span>
          </Touchable>
        ))}
      </div>

      {/* Tab Panes */}
      {step === 1 && (
        <div style={PS.paneCardAmber}>
          <Icon name="notifications" size={18} color="#CA8100" />
          <div style={{ flex: 1 }}>
            <div style={PS.paneTitleText}>Đang gửi tín hiệu cam kết đến {cpName}</div>
            <div style={PS.paneDescText}>Sinh viên sẽ phản hồi cam kết trong vòng thời hạn 60 phút.</div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={PS.paneCardBlue}>
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon name="navigate" size={15} color="#006C49" />
              <span style={PS.paneTitleText}>Geofence bán kính 200m</span>
            </div>
            <span style={PS.autoTagText}>Tự động kích hoạt</span>
          </div>
          {/* Map simulation */}
          <div style={PS.simMapBox}>
            <div style={PS.simMapLocationPill}>
              <div style={PS.pingDotMini} />
              <span style={PS.simMapLocationText}>Vị trí điểm đón / kèm học</span>
            </div>
          </div>
          <div style={PS.paneDescText}>
            Trước giờ hẹn 30 phút, bản đồ Live GPS định vị thời gian thực sẽ hiển thị tuyến đường di chuyển của sinh
            viên đến nhà bạn.
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={PS.paneCardGreen}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="document-text" size={16} color="#006C49" />
            <span style={PS.paneTitleText}>Nhật ký buổi kèm &amp; Đánh giá</span>
          </div>
          <div style={PS.paneDescText}>
            Sau khi kết thúc 2 tiếng, bạn sẽ nhận được báo cáo tóm tắt nội dung bài học kèm ảnh minh chứng trước khi ký
            xác nhận giải ngân ký quỹ.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ GIAI ĐOẠN 1 — AWAITING COMMITMENT VIEW (Bản thiết kế Stitch HTML Section 1) ═══
function AwaitingCommitmentView({ booking, secondsLeft }: { booking: any; secondsLeft: number }) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progressRatio = Math.min(1, Math.max(0, secondsLeft / 3600));

  return (
    <>
      {/* SECTION 1: HERO BANNER (Awaiting Confirmation & Countdown) */}
      <div style={PS.heroCountdownSection}>
        <div style={PS.heroCountdownHead}>
          <div style={PS.heroPillWhite}>
            <PingDot color="#F26522" size={7} />
            <span style={PS.heroPillWhiteText}>Đang chờ sinh viên xác nhận cam kết</span>
          </div>
          <Icon name="hourglass-outline" size={18} color="#CA8100" />
        </div>

        {/* Live Timer Row */}
        <div style={{ margin: "6px 0" }}>
          <div style={PS.liveTimerRow}>
            <span style={PS.liveTimerDigits}>
              {mm}:{ss}
            </span>
            <span style={PS.liveTimerSub}>còn lại trong khung 60 phút</span>
          </div>
          {/* Progress bar */}
          <div style={PS.countdownTrack}>
            <div style={{ ...PS.countdownBar, width: `${Math.round(progressRatio * 100)}%` }} />
          </div>
          <div style={PS.amberCountdown}>⏳ Còn lại: {fmtViLeft(Math.max(0, Number(secondsLeft) || 0))}</div>
        </div>

        {/* Reassurance Guarantee Card */}
        <div style={PS.reassuranceCard}>
          <div style={PS.reassuranceIconWrap}>
            <Icon name="shield-checkmark" size={18} color="#006C49" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={PS.reassuranceTitle}>Bảo hộ cam kết 100% MoMo Escrow</div>
            <div style={PS.reassuranceDesc}>
              Sinh viên có tối đa 60 phút để xác nhận ca. Tiền ký quỹ được giữ an toàn tuyệt đối (Đã tạm giữ an toàn).
              Nếu quá hạn sinh viên không nhận, hệ thống tự động hoàn 100% không phát sinh phí.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SPOTLIGHT BENTO: CHOSEN CAREPARTNER PROFILE */}
      <ParentSpotlightBento info={booking.carepartner_info} showPhone={false} />

      {/* SECTION 3: BENTO LỊCH TRÌNH & CHI TIẾT CÔNG VIỆC */}
      <ParentJobBento booking={booking} />

      {/* SECTION 4: BENTO MINH BẠCH TÀI CHÍNH & KÝ QUỸ MOMO ESCROW */}
      <ParentEscrowCard booking={booking} mode="hold" />

      {/* SECTION 5: LIFECYCLE PREVIEW (Tab switchers) */}
      <ParentLifecyclePreviewBento booking={booking} />
    </>
  );
}

// ═══ GIAI ĐOẠN 2 — ACTIVE SHIFT VIEW (committed | in_progress) ═══
function ActiveShiftView({ booking, navigation }: { booking: any; onCallSupport?: () => void; navigation: Nav }) {
  const slot = booking.first_slot;
  const inProgress = booking.status === "in_progress";
  return (
    <>
      {/* HERO BANNER — emerald (Stitch Section C.2 State 2) */}
      <div style={PS.emeraldBanner}>
        <div style={PS.amberBannerHeadRow}>
          <Icon name={inProgress ? "navigate" : "shield-checkmark"} size={17} color="#047857" />
          <span style={PS.emeraldBannerTitle}>
            {inProgress ? "Đang trong ca làm" : "Sinh viên đã cam kết nhận việc"}
          </span>
        </div>
        <div style={PS.emeraldBannerSub}>
          {slot?.date
            ? `Ca làm diễn ra ${slot.day_of_week_vi ? String(slot.day_of_week_vi).toLowerCase() : ""} ${
                slot.date_vi || slot.date
              }: ${String(slot.time_from || "").slice(0, 5)} – ${String(slot.time_to || "").slice(0, 5)}`
            : "Ca làm theo thỏa thuận với phụ huynh"}
        </div>
        <div style={PS.emeraldBannerSafe}>Đã bật định vị GPS an toàn · Giữ liên lạc trực tiếp qua gọi điện</div>
      </div>

      {/* MAP SIMULATION CARD — Live GPS strip + SOS (Stitch Section C.4) */}
      <div style={PS.mapCard}>
        <div style={PS.mapLivePill}>
          <div style={PS.liveDotWrap}>
            <div style={PS.liveDot} />
          </div>
          <span style={PS.mapLiveText}>
            {inProgress ? "Vị trí trực tiếp: Đang bật định vị an toàn" : "Sẵn sàng định vị an toàn khi ca bắt đầu"}
          </span>
        </div>
        <div style={PS.geofenceRow}>
          <Icon name={ic("shield-half")} size={13} color="#0E9F6E" />
          <span style={PS.geofenceText}>Ca làm được bảo vệ trong vòng an toàn Geofence quanh địa chỉ nhà bạn.</span>
        </div>
        <Touchable
          style={PS.sosBtn}
          activeOpacity={0.85}
          onPress={() => openURL(`tel:${SUPPORT_HOTLINE}`)}
        >
          <Icon name="alert-circle" size={15} color="#DC2626" />
          <span style={PS.sosBtnText}>Báo sự cố khẩn cấp / No-show (Hotline 24/7: {SUPPORT_HOTLINE})</span>
        </Touchable>
        {/* onCallSupport — RN cũng truyền prop này nhưng không dùng trong JSX */}
      </div>

      <ParentSpotlightBento
        info={booking.carepartner_info}
        phone={booking.carepartner_info?.phone}
        showPhone
      />
      {/* N-003: chat trong ca — mở TRỰC TIẾP với taskId = booking.task_id
          (Task mirror backend tạo khi ca bắt đầu). Ẩn khi chưa có task
          (booking cũ/chưa bắt đầu) — không ship nút chat 404. */}
      {booking.task_id && (
        <Touchable
          style={PS.chatDetailBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("Chat", {
              taskId: booking.task_id,
              taskTitle: booking.job_title,
            })
          }
        >
          <Icon name="chatbubble-ellipses" size={16} color="#0284C7" />
          <span style={PS.chatDetailBtnText}>Nhắn tin với Carepartner</span>
        </Touchable>
      )}
      <ParentJobBento booking={booking} />
      <ParentEscrowCard booking={booking} mode="hold" />
    </>
  );
}

// ═══ GIAI ĐOẠN 3 — COMPLETED SHIFT VIEW ═══
function CompletedShiftView({ booking, navigation }: { booking: any; navigation: Nav }) {
  const cpName = booking.carepartner_info?.full_name || "sinh viên";
  const payout = booking.carepartner_payout_vnd ?? Math.round((booking.total_value_vnd || 0) * 0.8);
  return (
    <>
      {/* DARK HEADER — "Ca làm đã kết thúc an toàn" (Stitch Section C.2 State 3) */}
      <div style={PS.completedDarkCard}>
        <div style={PS.amberBannerHeadRow}>
          <Icon name="medal" size={17} color="#FDE68A" />
          <span style={PS.completedDarkTitle}>Ca làm đã kết thúc an toàn!</span>
        </div>
        <div style={PS.completedDarkSub}>
          {fmtViDateTime(booking.ended_at) ? `Hoàn tất lúc ${fmtViDateTime(booking.ended_at)}` : "Cảm ơn bạn đã tin dùng EduCareLink"}
        </div>
        <div style={PS.completedDarkPayout}>Đã giải ngân {moneyVnd(payout)} từ MoMo Escrow cho sinh viên.</div>
      </div>

      {/* CARE DIARY BOX — nhật ký chăm sóc bé (nếu có) */}
      <div style={PS.bentoCard}>
        <div style={PS.bentoHeaderRow}>
          <Icon name={ic("book-outline")} size={16} color="#EA580C" />
          <span style={PS.bentoHeaderTitle}>NHẬT KÝ CHĂM SÓC BÉ</span>
        </div>
        {/* CARE DIARY — phụ huynh xem chi tiết. Worker đi luồng riêng
            (card ghi/sửa ở mục thao tác trong screen này). */}
        {booking.task_id ? (
          <Touchable
            style={PS.diaryBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("CareDiaryDetail", { taskId: booking.task_id })}
          >
            <Icon name="document-text-outline" size={15} color="#C2410C" />
            <span style={PS.diaryBtnText}>Xem nhật ký chăm sóc bé</span>
            <Icon name="chevron-forward" size={15} color="#C2410C" />
          </Touchable>
        ) : (
          <div style={PS.diaryEmpty}>
            Sinh viên chưa gửi nhật ký chăm sóc cho ca này. Nhật ký sẽ xuất hiện tại đây sau ca làm.
          </div>
        )}
      </div>

      {/* RATING & REVIEW + QUICK PRAISE TAGS (Stitch Section C.7)
          Blocker B: đã đánh giá → hiện rating THẬT từ booking.review,
          chưa có review → CTA viết đánh giá (đơn cũ không task → disabled) */}
      <div style={PS.reviewCard}>
        {booking.review ? (
          <div style={PS.reviewPromptTitle}>
            ⭐ Bạn đã đánh giá ca này {booking.review.rating} sao — cảm ơn bạn đã góp ý cho {cpName}!
          </div>
        ) : (
          <div style={PS.reviewPromptTitle}>
            ⭐ Bạn thấy {cpName} hỗ trợ bé như thế nào? Hãy đánh giá để tích điểm uy tín cho em ấy!
          </div>
        )}
        <div style={PS.praiseRow}>
          {["Đúng giờ", "Rất kiên nhẫn", "Dạy dễ hiểu", "Bé rất thích"].map((tag) => (
            <div key={tag} style={PS.praiseChip}>
              <span style={PS.praiseChipText}>{tag}</span>
            </div>
          ))}
        </div>
        <Touchable
          style={PS.reviewSubmitBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("Review", {
              taskId: booking.task_id,
              revieweeId: booking.carepartner_id,
            })
          }
          disabled={!booking.task_id}
        >
          <Icon name="star" size={14} color="#fff" />
          <span style={PS.reviewSubmitBtnText}>Viết đánh giá ngay</span>
        </Touchable>
        {!booking.task_id && (
          <div style={PS.diaryEmpty}>Ca này chưa hỗ trợ đánh giá trực tiếp (đơn cũ trước khi có ghép cặp tự động).</div>
        )}
      </div>

      {/* N-003: cửa sổ chat 24h sau ca — mở TRỰC TIẾP (taskId = Task mirror).
          Booking cũ không có task → ẩn nút thay vì 404. */}
      {booking.task_id && (
        <Touchable
          style={PS.chatDetailBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("Chat", {
              taskId: booking.task_id,
              taskTitle: booking.job_title,
            })
          }
        >
          <Icon name="chatbubble-ellipses" size={16} color="#0284C7" />
          <span style={PS.chatDetailBtnText}>Chat với Carepartner (24h)</span>
        </Touchable>
      )}

      <ParentSpotlightBento info={booking.carepartner_info} showPhone={false} />

      {/* MOMO ESCROW RECEIPT — tổng kết breakdown 80/20 */}
      <ParentEscrowCard booking={booking} mode="receipt" />
    </>
  );
}

// ═══ TRẠNG THÁI KẾT THÚC KHÁC (hủy / no_show / hết hạn / tranh chấp) ═══
function EndedBookingView({ booking }: { booking: any }) {
  const isCancelled = ["cancelled_by_parent", "cancelled_by_carepartner", "declined_in_window"].includes(
    booking.status
  );
  return (
    <>
      <div style={PS.endedCard}>
        <div style={PS.amberBannerHeadRow}>
          <Icon name={isCancelled ? "close-circle" : "warning-outline"} size={17} color="#64748B" />
          <span style={PS.endedTitle}>{booking.status_label_vi || "Đơn đã kết thúc"}</span>
        </div>
        {!!fmtViDateTime(booking.cancelled_at || booking.ended_at) && (
          <div style={PS.endedSub}>{fmtViDateTime(booking.cancelled_at || booking.ended_at)}</div>
        )}
        {!!booking.compensation_vnd && booking.compensation_vnd > 0 && (
          <div style={PS.endedCompensation}>
            Đã đền bù {moneyVnd(booking.compensation_vnd)} credit vào ví tín dụng của bạn.
          </div>
        )}
      </div>
      <ParentEscrowCard booking={booking} mode="hold" />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MÀN CHÍNH
   ══════════════════════════════════════════════════════════════════ */
const BookingDetailScreen: React.FC<{ bookingId?: string }> = ({ bookingId }) => {
  const { user } = useAuth();
  const navigation = useNav();
  // registry.tsx spread params vào props: <BookingDetailScreen bookingId=... />
  const id = bookingId;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [supportModal, setSupportModal] = useState(false);
  const [reasonCode, setReasonCode] = useState("school_schedule");
  const [note, setNote] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loadError, setLoadError] = useState("");
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await getBookingDetail(String(id));
      if (!mountedRef.current) return;
      setBooking(data);
      setSecondsLeft(data.seconds_left || 0);
    } catch (err) {
      if (!mountedRef.current) return;
      setLoadError("Không tải được chi tiết đơn. Vui lòng thử lại.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Đếm ngược cửa sổ cam kết (1s — như RN)
  useEffect(() => {
    if (booking?.status !== "awaiting_commitment" || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s: number) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [booking?.status, secondsLeft]);

  const run = async (fn: () => Promise<any>, successMsg?: string) => {
    setActionLoading(true);
    try {
      await fn();
      if (successMsg) showAlert("Thành công", successMsg);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      showAlert("Lỗi", typeof detail === "string" ? detail : "Thao tác thất bại.");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  // Confirmation Jump (QA 2026-09-13): sau khi CarePartner xác nhận cam kết
  // thành công → điều hướng về "Việc của tôi" tab Sắp làm và highlight đúng
  // đơn vừa cam kết. KHÔNG áp dụng cho nhánh Parent (dùng chung file này).
  // RN Alert 2 nút → web window.confirm (Alert 1 nút → showAlert).
  const handleCommitAndJump = async () => {
    setActionLoading(true);
    try {
      await commitBooking(String(id));
      const goUpcoming = window.confirm(
        "Thành công\n\nĐã cam kết nhận đơn thành công! Ca làm đã chuyển sang mục Sắp làm.\n\nOK = Xem ca sắp làm · Cancel = Ở lại"
      );
      if (goUpcoming) {
        // RN: navigation.navigate('MyJobs', { screen: 'MyJobsMain', params: { initialTab: 'upcoming', highlightBookingId } })
        navigation.navigate("MyJobs", {
          initialTab: "upcoming",
          highlightBookingId: String(id),
        });
        return; // đã rời màn — không load lại (tránh setState trên unmounted)
      }
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      showAlert("Không thể xác nhận", typeof detail === "string" ? detail : "Không thể xác nhận lúc này, vui lòng thử lại.");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const submitCancel = async () => {
    const isParentNow =
      !(user?.role === "worker" || (user?.id && booking?.carepartner_id && String(user.id) === String(booking?.carepartner_id))) &&
      (user?.role === "parent" || (user?.id && booking?.parent_id && String(user.id) === String(booking?.parent_id)));
    if (isParentNow) {
      setCancelModal(false);
      await run(() => cancelBookingByParent(String(id), note.trim()), "Đã hủy đơn thành công.");
      return;
    }
    const reason = CANCEL_REASONS.find((r) => r.code === reasonCode);
    if (!reason) {
      showAlert("Thiếu thông tin", "Vui lòng chọn lý do từ chối.");
      return;
    }
    if (reason.forceMajeure && note.trim().length > 0 && note.trim().length < 20) {
      showAlert("Lý do bất khả kháng", "Cần ghi chú ít nhất 20 ký tự để minh bạch với phụ huynh.");
      return;
    }
    setCancelModal(false);
    await run(
      () => cancelBooking(String(id), { reason_code: reasonCode, note: note.trim(), evidence: [] }),
      "Đã từ chối nhận đơn. Hệ thống đã mở lại slot cho bạn sinh viên khác mà không trừ điểm ELO."
    );
  };

  /* ── LOADING (RN: ActivityIndicator size large màu #F26522) ── */
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: COLORS.background,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner size={36} color="#F26522" />
        <div style={{ marginTop: 12, color: "#64748B", fontSize: "13px" }}>Đang tải chi tiết đơn...</div>
      </div>
    );
  }

  /* ── LOAD ERROR ── */
  if (loadError) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: COLORS.background,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Icon name="cloud-offline-outline" size={46} color="#94A3B8" />
        <div style={{ marginTop: 10, color: "#64748B", textAlign: "center", fontSize: "14px" }}>{loadError}</div>
        <Touchable style={CS.retryBtn} onPress={load} activeOpacity={0.85}>
          <span style={{ color: "#FFFFFF", fontWeight: 700 }}>Thử lại</span>
        </Touchable>
      </div>
    );
  }

  /* ── NOT FOUND ── */
  if (!booking) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: COLORS.background,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#64748B" }}>Không tìm thấy đơn.</div>
      </div>
    );
  }

  const isCarePartner =
    user?.role === "worker" ||
    (user?.id && booking.carepartner_id && String(user.id) === String(booking.carepartner_id));
  const isParent =
    !isCarePartner &&
    (user?.role === "parent" || (user?.id && booking.parent_id && String(user.id) === String(booking.parent_id)));
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // Placeholder màu cho textarea/textarea (RN placeholderTextColor mặc định)
  const placeholderStyle = (
    <style>{`.edc-bd-note::placeholder{color:#9CA3AF;opacity:1}@keyframes edc-bd-fade{from{opacity:0}to{opacity:1}}`}</style>
  );

  // ============================================================
  // LUỒNG PHỤ HUYNH — NÂNG CẤP THEO BẢN THIẾT KẾ STITCH 2026-09-13
  // 3 giai đoạn: awaiting_commitment / committed+in_progress / completed.
  // Toàn bộ dữ liệu từ API thật (booking.carepartner_info, first_slot,
  // total_value_vnd...). Giữ nguyên luồng CarePartner bên dưới (KHÔNG ĐỤNG).
  // ============================================================
  if (isParent) {
    const cpInfo = booking.carepartner_info || {};
    const phone = cpInfo.phone || "";
    const isAwaiting = booking.status === "awaiting_commitment";
    const isShiftActive = ["committed", "in_progress"].includes(booking.status);
    const isCompleted = booking.status === "completed";
    const isEndedElse = [
      "cancelled_by_parent",
      "cancelled_by_carepartner",
      "no_show",
      "no_show_unconfirmed",
      "declined_in_window",
      "expired_no_response",
      "disputed",
    ].includes(booking.status);

    // Pass candidate-object cho CandidateProfileV2 từ hồ sơ công khai API
    const candidateForProfile = {
      carepartner_id: booking.carepartner_id,
      display_name: cpInfo.full_name || "CarePartner",
      avatar_url: cpInfo.avatar_url || "",
      school: cpInfo.school || "",
      major: cpInfo.major || "",
      rating: cpInfo.rating_avg || 0,
      completed_jobs: cpInfo.jobs_completed || 0,
    };

    return (
      <Screen bg="#F8FAFC" scroll={false}>
        {placeholderStyle}

        {/* STICKY TOP APP BAR (Stitch Section C.1) */}
        <StatusBarSpacer />
        <div style={PS.topBar}>
          <Touchable
            style={PS.circleBtn}
            onPress={() => navigation.goBack()}
            hitSlop={10}
            activeOpacity={0.85}
          >
            <Icon name="arrow-back" size={21} color="#1E293B" />
          </Touchable>
          <div style={PS.topBarCenter}>
            <div style={PS.orderCode}>MÃ ĐƠN #{String(booking.id || "").slice(0, 8).toUpperCase()}</div>
            <div style={PS.topBarTitle}>Chi tiết ca chăm sóc &amp; gia sư</div>
          </div>
          <Touchable style={PS.circleBtn} onPress={() => setSupportModal(true)} hitSlop={10} activeOpacity={0.85}>
            <Icon name="headset-outline" size={19} color="#64748B" />
          </Touchable>
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
          <div
            style={{
              ...PS.scrollContent,
              paddingBottom: isAwaiting || isShiftActive ? 130 : 40,
            }}
          >
            {/* ═══ GIAI ĐOẠN 1 — AWAITING COMMITMENT ═══ */}
            {isAwaiting && <AwaitingCommitmentView booking={booking} secondsLeft={secondsLeft} />}

            {/* ═══ GIAI ĐOẠN 2 — COMMITTED / IN-PROGRESS ═══ */}
            {isShiftActive && (
              <ActiveShiftView booking={booking} onCallSupport={() => setSupportModal(true)} navigation={navigation} />
            )}

            {/* ═══ GIAI ĐOẠN 3 — COMPLETED ═══ */}
            {isCompleted && <CompletedShiftView booking={booking} navigation={navigation} />}

            {/* ═══ TRẠNG THÁI KẾT THÚC KHÁC (hủy / no_show / hết hạn) ═══ */}
            {isEndedElse && <EndedBookingView booking={booking} />}

            {/* Sự kiện đặc biệt: nghi ngờ không đến — PH phải xác nhận */}
            {booking.status === "suspected_no_show" && (
              <div style={PS.bentoCard}>
                <div style={PS.questionTitle}>CarePartner đã đến chưa?</div>
                <div style={PS.pairRow}>
                  <Touchable
                    style={{ ...PS.btnSolid, background: "#0E9F6E", flex: 1 }}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                    onPress={() => run(() => reportNoShow(String(id), true))}
                  >
                    <span style={PS.btnSolidText}>Đã đến</span>
                  </Touchable>
                  <Touchable
                    style={{ ...PS.btnSolid, background: "#DC2626", flex: 1 }}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                    onPress={() => run(() => reportNoShow(String(id), false))}
                  >
                    <span style={PS.btnSolidText}>Không đến</span>
                  </Touchable>
                </div>
              </div>
            )}

            {/* Sự kiện đặc biệt: CP xin đổi giờ — PH Đồng ý/Từ chối */}
            {booking.status === "reschedule_requested" && (
              <div style={PS.bentoCard}>
                <div style={PS.questionTitle}>CarePartner xin đổi giờ</div>
                <div style={PS.pairRow}>
                  <Touchable
                    style={{ ...PS.btnSolid, background: "#0E9F6E", flex: 1 }}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                    onPress={() => run(() => respondReschedule(String(id), "approve"), "Đã duyệt giờ mới.")}
                  >
                    <span style={PS.btnSolidText}>Đồng ý</span>
                  </Touchable>
                  <Touchable
                    style={{ ...PS.btnSolid, background: "#DC2626", flex: 1 }}
                    disabled={actionLoading}
                    activeOpacity={0.85}
                    onPress={() => run(() => respondReschedule(String(id), "decline"))}
                  >
                    <span style={PS.btnSolidText}>Từ chối</span>
                  </Touchable>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ FIXED BOTTOM DOCK — ĐỔI THEO GIAI ĐOẠN (Stitch Section C.8) ═══ */}
        {isAwaiting && (
          <div style={PS.bottomDock}>
            <div style={PS.dockBtnRow}>
              {/* NÚT 1 (35%): Đổi sinh viên → mở modal hủy (cancelBookingByParent) */}
              <Touchable
                style={PS.dockSecondaryBtn}
                disabled={actionLoading}
                activeOpacity={0.85}
                onPress={() => {
                  setReasonCode("");
                  setNote("");
                  setCancelModal(true);
                }}
              >
                <Icon name={ic("swap-horizontal-outline")} size={16} color="#475569" />
                <span style={PS.dockSecondaryBtnText}>Đổi sinh viên</span>
              </Touchable>

              {/* NÚT 2 (65%): Xem hồ sơ đầy đủ → CandidateProfileV2 */}
              <Touchable
                style={PS.dockPrimaryBtn}
                disabled={actionLoading}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("CandidateProfileV2", {
                    candidate: candidateForProfile,
                    jobId: booking.job_id,
                  })
                }
              >
                <span style={PS.dockPrimaryBtnText}>Xem hồ sơ đầy đủ</span>
                <Icon name="arrow-forward" size={15} color="#fff" />
              </Touchable>
            </div>
            <div style={PS.dockMicroCopy}>
              Nếu sinh viên không nhận sau thời hạn, đơn sẽ tự mở lại miễn phí.
            </div>
          </div>
        )}

        {isShiftActive && (
          <div style={PS.bottomDock}>
            <div style={PS.dockBtnRow}>
              {/* NÚT GỌI (30%) — SĐT thật từ API, chỉ mở khi đã cam kết */}
              {phone ? (
                <Touchable
                  style={PS.dockCallBtn}
                  activeOpacity={0.85}
                  onPress={() => openURL(`tel:${phone}`)}
                >
                  <Icon name={ic("call")} size={18} color="#047857" />
                </Touchable>
              ) : null}

              {/* NÚT CHÍNH (70%): Xác nhận hoàn thành ca → completeBooking */}
              <Touchable
                style={{ ...PS.dockCompleteBtn, ...(!phone ? { flex: 1 } : {}) }}
                disabled={actionLoading}
                activeOpacity={0.85}
                onPress={() =>
                  run(
                    () => completeBooking(String(id)),
                    "Ca làm đã hoàn tất. Tiền ký quỹ được giải ngân 80% cho sinh viên qua MoMo Escrow."
                  )
                }
              >
                {actionLoading ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <>
                    <Icon name={ic("checkmark-done")} size={16} color="#fff" />
                    <span style={PS.dockCompleteBtnText}>Xác nhận hoàn thành ca</span>
                  </>
                )}
              </Touchable>
            </div>
            <div style={PS.dockMicroCopy}>Bấm khi ca làm đã kết thúc và bạn hài lòng với dịch vụ.</div>
          </div>
        )}

        {isCompleted && (
          <div style={PS.bottomDock}>
            {/* HERO CTA: 1-tap Re-book tuần sau */}
            <Touchable
              style={PS.dockRebookBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("JobTypeSelect")}
            >
              <Icon name={ic("repeat")} size={16} color="#fff" />
              <span style={PS.dockRebookBtnText}>Đặt lại bạn sinh viên này cho tuần sau</span>
            </Touchable>
            <Touchable
              style={PS.dockLinkRow}
              activeOpacity={0.85}
              onPress={() => openURL(`tel:${SUPPORT_HOTLINE}`)}
            >
              <span style={PS.dockLinkText}>Cần hỗ trợ hóa đơn? Hotline {SUPPORT_HOTLINE}</span>
            </Touchable>
          </div>
        )}

        {/* ═══ MODAL HỦY CHO PHỤ HUYNH (cancelBookingByParent — giữ nguyên luồng) ═══ */}
        {cancelModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              ...CS.modalBackdrop,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={PS.modalSheet}>
              <div style={PS.sheetDragHandle} />
              <div style={PS.modalTitle}>Xác nhận hủy đơn</div>
              <div style={PS.modalHint}>
                Bạn có chắc chắn muốn hủy đơn này? Nếu hủy sát giờ (dưới 3h trước ca), CarePartner có thể được hỗ trợ
                điểm tín nhiệm. Tiền ký quỹ MoMo Escrow được hoàn lại 100% vào ví của bạn.
              </div>
              <textarea
                className="edc-bd-note"
                style={PS.noteInput}
                placeholder="Ghi chú lý do hủy (tùy chọn)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div style={PS.pairRow}>
                <Touchable
                  style={{ ...PS.modalBtn, ...PS.modalCancelBtn }}
                  activeOpacity={0.85}
                  onPress={() => setCancelModal(false)}
                >
                  <span style={PS.modalCancelText}>Đóng</span>
                </Touchable>
                <Touchable
                  style={{ ...PS.modalBtn, ...PS.modalOkBtn }}
                  onPress={submitCancel}
                  disabled={actionLoading}
                  activeOpacity={0.85}
                >
                  {actionLoading ? (
                    <Spinner size={16} color="#fff" />
                  ) : (
                    <span style={PS.modalOkText}>Xác nhận hủy</span>
                  )}
                </Touchable>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SUPPORT HOTLINE MODAL ═══ */}
        {supportModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 300,
              ...SS.modalOverlay,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={SS.supportBox}>
              <div style={SS.supportIconCircle}>
                <Icon name={ic("headset")} size={28} color="#2563EB" />
              </div>
              <div style={SS.supportTitle}>Tổng đài Hỗ trợ Phụ huynh</div>
              <div style={SS.supportSub}>Cần hỗ trợ về ca làm, thanh toán hoặc sự cố khẩn cấp?</div>
              <Touchable style={SS.hotlineCallBtn} activeOpacity={0.85} onPress={() => openURL(`tel:${SUPPORT_HOTLINE}`)}>
                <Icon name={ic("call")} size={18} color="#EA580C" />
                <span style={SS.hotlineCallText}>Hotline {SUPPORT_HOTLINE}</span>
              </Touchable>
              <Touchable style={SS.supportCloseBtn} activeOpacity={0.85} onPress={() => setSupportModal(false)}>
                <span style={SS.supportCloseBtnText}>Đóng</span>
              </Touchable>
            </div>
          </div>
        )}
      </Screen>
    );
  }

  // ============================================================
  // LUỒNG CAREPARTNER — NÂNG CẤP THEO THIẾT KẾ GOOGLE STITCH
  // ============================================================
  const payoutVnd = booking.carepartner_payout_vnd ?? Math.round((booking.total_value_vnd || 0) * 0.8);
  const parentName = booking.parent_name || "Phụ huynh";
  const categoryLabel = booking.category_name_vi || "Gia sư / Chăm sóc";
  const slot = booking.first_slot;
  const isAwaiting = booking.status === "awaiting_commitment";
  const isCommitted = booking.status === "committed";
  const isInProgress = booking.status === "in_progress";
  const isPenalty = ["cancelled_by_carepartner", "no_show", "no_show_unconfirmed", "suspected_no_show"].includes(
    booking.status
  );

  return (
    <Screen bg="#F8FAFC" scroll={false}>
      {placeholderStyle}

      {/* STICKY TOP APP BAR */}
      <StatusBarSpacer />
      <div style={SS.topBar}>
        <Touchable style={SS.circleBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-back" size={22} color="#1E293B" />
        </Touchable>

        <div style={SS.topBarCenter}>
          <div style={SS.orderCode}>MÃ ĐƠN #{String(booking.id ?? "").slice(0, 8).toUpperCase()}</div>
          <div style={SS.topBarTitle}>Chi tiết ca làm được giao</div>
        </div>

        <Touchable style={SS.circleBtn} onPress={() => setSupportModal(true)} hitSlop={10}>
          <Icon name="headset-outline" size={20} color="#64748B" />
        </Touchable>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
        <div style={{ ...SS.scrollContent, paddingBottom: isAwaiting ? 120 : 50 }}>
          {/* URGENT COUNTDOWN BANNER (Khi chờ xác nhận) */}
          {isAwaiting && (
            <div style={SS.countdownBanner}>
              <div style={SS.hourglassCircle}>
                <Icon name={ic("hourglass")} size={20} color="#D97706" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={SS.countdownTimeRow}>
                  <span style={SS.countdownLabel}>Thời gian suy nghĩ còn:</span>
                  <div style={SS.countdownPill}>
                    <span style={SS.countdownPillText}>
                      {mm}:{ss}
                    </span>
                  </div>
                </div>
                <div style={SS.countdownHint}>
                  Tự động nhường ca cho bạn khác nếu hết giờ (không trừ điểm uy tín).
                </div>
              </div>
            </div>
          )}

          {/* HERO SUMMARY CARD (The Job Identity & Escrow Payout) */}
          <div style={SS.heroCard}>
            <div style={SS.heroAccentLine} />

            <div style={SS.tagRow}>
              <div style={SS.categoryTag}>
                <Icon name={ic("book-outline")} size={13} color="#EA580C" />
                <span style={SS.categoryTagText}>{categoryLabel}</span>
              </div>
              <div
                style={{
                  ...SS.statusTag,
                  ...(isAwaiting ? SS.statusTagAmber : {}),
                  ...(isCommitted ? SS.statusTagGreen : {}),
                }}
              >
                <div
                  style={{
                    ...SS.statusDot,
                    background: isAwaiting ? "#F59E0B" : "#10B981",
                  }}
                />
                <span
                  style={{
                    ...SS.statusTagText,
                    ...(isAwaiting ? { color: "#B45309" } : {}),
                    ...(isCommitted ? { color: "#047857" } : {}),
                  }}
                >
                  {booking.status_label_vi || "Chờ bạn xác nhận"}
                </span>
              </div>
            </div>

            <div style={SS.jobTitleText}>{booking.job_title || "Công việc ghép cặp"}</div>

            {/* Guaranteed Escrow Payout Box */}
            <div style={SS.payoutBox}>
              <div style={{ flex: 1 }}>
                <div style={SS.payoutLabelRow}>
                  <Icon name="shield-checkmark" size={14} color="#0E9F6E" />
                  <span style={SS.payoutLabelText}>Thù lao ca làm này</span>
                </div>
                <div style={SS.amountRow}>
                  <span style={SS.amountText}>{Number(payoutVnd).toLocaleString("vi-VN")}đ</span>
                  <span style={SS.amountSub}>/ ca làm</span>
                </div>
                <div style={SS.escrowNoticeRow}>
                  <div style={SS.greenDot} />
                  <span style={SS.escrowNoticeText}>Đã ký quỹ MoMo Escrow 100% · Tự động giải ngân</span>
                </div>
              </div>
              <div style={SS.hourlyBadge}>
                <span style={SS.hourlyBadgeText}>
                  {booking.hourly_rate_vnd ? `${Math.round(booking.hourly_rate_vnd / 1000)}k/h` : "80% net"}
                </span>
              </div>
            </div>
          </div>

          {/* SCHEDULE & TIME BENTO */}
          <div style={SS.bentoCard}>
            <div style={SS.bentoHeaderRow}>
              <Icon name="calendar-outline" size={16} color="#EA580C" />
              <span style={SS.bentoHeaderTitle}>LỊCH &amp; THỜI LƯỢNG CA LÀM</span>
            </div>

            <div style={SS.bentoGrid}>
              <div style={SS.bentoCol}>
                <div style={SS.bentoColIconRow}>
                  <Icon name={ic("today-outline")} size={13} color="#64748B" />
                  <span style={SS.bentoColLabel}>Ngày làm việc</span>
                </div>
                <div style={SS.bentoColValue}>
                  {slot?.day_of_week_vi ? `${slot.day_of_week_vi}, ` : ""}
                  {slot?.date_vi || slot?.date || "Theo thỏa thuận"}
                </div>
                <div style={SS.matchPill}>
                  <Icon name="checkmark-circle" size={12} color="#0E9F6E" />
                  <span style={SS.matchPillText}>Trùng 100% lịch rảnh</span>
                </div>
              </div>

              <div style={SS.bentoCol}>
                <div style={SS.bentoColIconRow}>
                  <Icon name="time-outline" size={13} color="#64748B" />
                  <span style={SS.bentoColLabel}>Khung giờ</span>
                </div>
                <div style={SS.bentoColValue}>
                  {slot?.time_from?.slice(0, 5) || "17:30"} – {slot?.time_to?.slice(0, 5) || "19:30"}
                </div>
                <div style={SS.durationHint}>Ca làm tiêu chuẩn</div>
              </div>
            </div>
          </div>

          {/* FAMILY & CHILD DETAILS BENTO */}
          <div style={SS.bentoCard}>
            <div style={SS.bentoHeaderRow}>
              <Icon name="people-outline" size={16} color="#EA580C" />
              <span style={SS.bentoHeaderTitle}>PHỤ HUYNH &amp; HỌC SINH</span>
            </div>

            {/* Parent Profile Strip */}
            <div style={SS.parentStrip}>
              <div style={SS.parentAvatarCircle}>
                <span style={SS.parentAvatarInitial}>{String(parentName || "P")[0]?.toUpperCase() || "P"}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={SS.parentNameVerifiedRow}>
                  <span style={SS.parentFullName}>{parentName}</span>
                  <div style={SS.cccdBadge}>
                    <Icon name="checkmark-circle" size={11} color="#0E9F6E" />
                    <span style={SS.cccdBadgeText}>Đã xác thực CCCD</span>
                  </div>
                </div>
                <div style={SS.parentSubInfo}>
                  {isCommitted && booking.parent_info?.phone
                    ? `SĐT: ${booking.parent_info.phone}`
                    : "SĐT sẽ hiển thị sau khi nhận việc"}
                </div>
                <div style={SS.parentRepRow}>
                  <span style={SS.starRep}>⭐ 5.0</span>
                  <span style={SS.dotSep}>•</span>
                  <span style={SS.repItem}>Đã thanh toán Escrow</span>
                  <span style={SS.dotSep}>•</span>
                  <span style={SS.reputationHighlight}>Đúng hẹn</span>
                </div>
              </div>
            </div>

            {/* Child Specifics (nếu có) */}
            {booking.child_info?.age_group ? (
              <div style={SS.childBox}>
                <Icon name="happy-outline" size={18} color="#EA580C" />
                <div style={{ flex: 1 }}>
                  <div style={SS.childAgeText}>Độ tuổi: {booking.child_info.age_group}</div>
                  {booking.child_info.number_of_children ? (
                    <div style={SS.childCountText}>Số lượng bé: {booking.child_info.number_of_children}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Locked Contact Notice khi chưa cam kết */}
            {isAwaiting && (
              <div style={SS.lockedNoticeBox}>
                <Icon name={ic("lock-closed")} size={14} color="#64748B" />
                <span style={SS.lockedNoticeText}>
                  Số điện thoại và hướng dẫn vào nhà sẽ mở ngay sau khi bạn bấm Xác nhận cam kết.
                </span>
              </div>
            )}
          </div>

          {/* LOCATION & ROUTE PREVIEW */}
          <div style={SS.bentoCard}>
            <div style={SS.bentoHeaderRow}>
              <Icon name="location-outline" size={16} color="#EA580C" />
              <span style={SS.bentoHeaderTitle}>ĐỊA ĐIỂM &amp; ĐƯỜNG ĐI</span>
            </div>

            <div style={SS.addressBox}>
              <div style={SS.addressIconCircle}>
                <Icon name="navigate" size={15} color="#EA580C" />
              </div>
              <div style={SS.addressText}>
                {booking.job_address || booking.location_info?.address || "Địa chỉ làm việc tại nhà phụ huynh"}
              </div>
            </div>

            {/* Live GPS Protection Pill */}
            <div style={SS.gpsPill}>
              <Icon name={ic("shield-half")} size={14} color="#0E9F6E" />
              <span style={SS.gpsPillText}>
                Ca làm được bảo vệ bằng định vị an toàn 2 chiều trong suốt thời gian làm việc.
              </span>
            </div>
          </div>

          {/* SPECIAL REQUIREMENTS & TASKS (nếu có) */}
          {booking.job_description || booking.child_info?.notes ? (
            <div style={SS.bentoCard}>
              <div style={SS.bentoHeaderRow}>
                <Icon name="document-text-outline" size={16} color="#EA580C" />
                <span style={SS.bentoHeaderTitle}>NỘI DUNG &amp; YÊU CẦU CÔNG VIỆC</span>
              </div>
              <div style={SS.descriptionText}>{booking.job_description || booking.child_info?.notes}</div>
            </div>
          ) : null}

          {/* ESCROW COMMITMENT POLICY REMINDER (Dark Slate Card) */}
          <div style={SS.escrowPolicyCard}>
            <div style={SS.escrowPolicyHeader}>
              <Icon name="lock-closed-outline" size={17} color="#FED7AA" />
              <span style={SS.escrowPolicyTitle}>Bảo đảm an toàn thu nhập 100%</span>
            </div>
            <div style={SS.escrowPolicyText}>
              Khoản thù lao đã được phụ huynh nộp vào tài khoản ký quỹ MoMo Escrow an toàn. Khi bạn hoàn thành ca làm và
              bấm Kết thúc, tiền công sẽ được giải ngân ngay lập tức.
            </div>
          </div>

          {/* CARE DIARY — GHI/SỬA NHẬT KÝ (luồng CarePartner, Flow 1 matching).
              Task mirror được backend tạo khi ca bắt đầu; form tự load entry
              có sẵn → tự chuyển thành chế độ sửa. Parity với việc legacy
              ở MyJobsScreen. Ẩn khi chưa có task mirror (đơn cũ). */}
          {(isInProgress || booking.status === "completed") && booking.task_id && (
            <div style={SS.bentoCard}>
              <div style={SS.bentoHeaderRow}>
                <Icon name={ic("book-outline")} size={16} color="#EA580C" />
                <span style={SS.bentoHeaderTitle}>NHẬT KÝ CHĂM SÓC BÉ</span>
              </div>
              <div style={SS.escrowPolicyText}>
                Ghi lại tâm trạng, hoạt động và tiến bộ của bé sau ca — phụ huynh xem ngay trên app.
              </div>
              <Touchable
                style={{ ...SS.fullWidthCommitBtn, background: "#EA580C", marginTop: 10 }}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("CareDiaryForm", {
                    taskId: booking.task_id,
                    taskTitle: booking.job_title,
                  })
                }
              >
                <Icon name="create-outline" size={16} color="#fff" />
                <span style={SS.fullWidthCommitBtnText}>Ghi / Sửa nhật ký chăm sóc bé</span>
              </Touchable>
            </div>
          )}

          {/* CÁC NÚT THAO TÁC CHO TRẠNG THÁI KHÁC (Khi đã cam kết hoặc đang làm) */}
          {isCommitted && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <Touchable
                style={SS.fullWidthCommitBtn}
                disabled={actionLoading}
                onPress={() => run(() => startBooking(String(id)), "Đã bắt đầu ca làm việc.")}
              >
                <Icon name="play" size={16} color="#fff" />
                <span style={SS.fullWidthCommitBtnText}>Bắt đầu làm việc</span>
              </Touchable>

              <Touchable
                style={SS.subCancelBtn}
                disabled={actionLoading}
                onPress={() => {
                  setReasonCode("school_schedule");
                  setNote("");
                  setCancelModal(true);
                }}
              >
                <span style={SS.subCancelBtnText}>Hủy ca làm này</span>
              </Touchable>
            </div>
          )}

          {isInProgress && (
            <div style={{ marginTop: 14 }}>
              <Touchable
                style={{ ...SS.fullWidthCommitBtn, background: "#0E9F6E" }}
                disabled={actionLoading}
                onPress={() =>
                  run(
                    () => completeBooking(String(id)),
                    "Đã hoàn thành ca làm! Tiền công sẽ được giải ngân qua Escrow."
                  )
                }
              >
                <Icon name={ic("checkmark-done")} size={18} color="#fff" />
                <span style={SS.fullWidthCommitBtnText}>Kết thúc đơn &amp; Giải ngân</span>
              </Touchable>
            </div>
          )}

          {isPenalty && (
            <Touchable
              style={SS.appealBtn}
              onPress={() => navigation.navigate("Appeal", { bookingId: booking.id })}
            >
              <Icon name={ic("scale-outline")} size={17} color="#B45309" />
              <span style={SS.appealBtnText}>⚖️ Gửi đơn kháng cáo điểm ELO</span>
            </Touchable>
          )}
        </div>
      </div>

      {/* FIXED BOTTOM ACTION DOCK (STRICT 2-BUTTON RULE: TỪ CHỐI vs XÁC NHẬN CAM KẾT) */}
      {isAwaiting && (
        <div style={SS.bottomDock}>
          <div style={SS.dockBtnRow}>
            {/* NÚT 1: TỪ CHỐI / HUỶ ĐƠN (35% width, Secondary) */}
            <Touchable
              style={SS.declineDockBtn}
              disabled={actionLoading}
              activeOpacity={0.88}
              onPress={() => {
                setReasonCode("school_schedule");
                setNote("");
                setCancelModal(true);
              }}
            >
              <Icon name={ic("close-circle-outline")} size={17} color="#475569" />
              <span style={SS.declineDockBtnText}>Từ chối</span>
            </Touchable>

            {/* NÚT 2: XÁC NHẬN CAM KẾT (65% width, Primary Full Brand CTA) */}
            <Touchable
              style={SS.confirmDockBtn}
              disabled={actionLoading}
              activeOpacity={0.88}
              onPress={handleCommitAndJump}
            >
              {actionLoading ? (
                <Spinner size={16} color="#fff" />
              ) : (
                <>
                  <span style={SS.confirmDockBtnText}>Xác nhận cam kết</span>
                  <Icon name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </Touchable>
          </div>

          <div style={SS.dockMicroCopy}>
            Bấm <span style={{ color: "#EA580C", fontWeight: 700 }}>Xác nhận</span> ca sẽ lập tức chuyển vào lịch{" "}
            <span style={{ fontWeight: 700, color: "#1E293B" }}>Sắp làm</span> của bạn.
          </div>
        </div>
      )}

      {/* DECLINE REASON BOTTOM SHEET MODAL (Stitch Design) */}
      {cancelModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            ...SS.modalOverlay,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={SS.modalSheet}>
            <div style={SS.sheetDragHandle} />

            <div style={SS.sheetHeaderRow}>
              <span style={SS.sheetTitle}>Chọn lý do từ chối đơn</span>
              <Touchable style={SS.sheetCloseBtn} onPress={() => setCancelModal(false)}>
                <Icon name="close" size={18} color="#64748B" />
              </Touchable>
            </div>

            <div style={SS.sheetSubtext}>
              Đơn sẽ được hệ thống chuyển tự động cho bạn khác. Vì từ chối trước hạn quy định, bạn{" "}
              <span style={{ color: "#0E9F6E", fontWeight: 700 }}>không bị trừ điểm uy tín ELO</span>.
            </div>

            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {[
                { code: "school_schedule", label: "Trùng lịch học đột xuất tại trường" },
                { code: "transport", label: "Khoảng cách di chuyển quá xa so với dự tính" },
                { code: "health", label: "Lý do sức khỏe hoặc việc gia đình đột xuất" },
                { code: "wrong_job_info", label: "Yêu cầu ca kèm chưa phù hợp năng lực" },
                { code: "other", label: "Lý do cá nhân khác" },
              ].map((r) => {
                const isSelected = reasonCode === r.code;
                return (
                  <Touchable
                    key={r.code}
                    style={{ ...SS.reasonCard, ...(isSelected ? SS.reasonCardActive : {}) }}
                    onPress={() => setReasonCode(r.code)}
                    activeOpacity={0.8}
                  >
                    <div style={{ ...SS.radioCircle, ...(isSelected ? SS.radioCircleActive : {}) }}>
                      {isSelected && <div style={SS.radioDot} />}
                    </div>
                    <span style={{ ...SS.reasonLabel, ...(isSelected ? SS.reasonLabelActive : {}) }}>{r.label}</span>
                  </Touchable>
                );
              })}
            </div>

            <textarea
              className="edc-bd-note"
              style={SS.sheetNoteInput}
              placeholder="Ghi chú thêm (tùy chọn)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <div style={SS.sheetActionGrid}>
              <Touchable style={SS.sheetBackBtn} onPress={() => setCancelModal(false)}>
                <span style={SS.sheetBackBtnText}>Quay lại</span>
              </Touchable>
              <Touchable style={SS.sheetSubmitBtn} onPress={submitCancel} disabled={actionLoading}>
                <span style={SS.sheetSubmitBtnText}>Xác nhận từ chối</span>
              </Touchable>
            </div>
          </div>
        </div>
      )}

      {/* SUPPORT HOTLINE MODAL */}
      {supportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            ...SS.modalOverlay,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={SS.supportBox}>
            <div style={SS.supportIconCircle}>
              <Icon name={ic("headset")} size={28} color="#2563EB" />
            </div>
            <div style={SS.supportTitle}>Tổng đài Hỗ trợ CarePartner</div>
            <div style={SS.supportSub}>Cần hỗ trợ xác minh đường đi hoặc trao đổi về ca làm?</div>

            <Touchable style={SS.hotlineCallBtn} onPress={() => openURL(`tel:${SUPPORT_HOTLINE}`)}>
              <Icon name={ic("call")} size={18} color="#EA580C" />
              <span style={SS.hotlineCallText}>Hotline {SUPPORT_HOTLINE}</span>
            </Touchable>

            <Touchable style={SS.supportCloseBtn} onPress={() => setSupportModal(false)}>
              <span style={SS.supportCloseBtnText}>Đóng</span>
            </Touchable>
          </div>
        </div>
      )}
    </Screen>
  );
};

export default BookingDetailScreen;
