/**
 * CancellationPolicyScreen — port CHÍNH XÁC mobile/src/screens/HelpCenter/CancellationPolicyScreen.js (553 dòng).
 * MỚI (Nhóm B, mock data) — chính sách huỷ lịch + hoàn tiền. Backend chưa có →
 * MOCK_BOOKING/REFUND_TIERS/CANCEL_REASONS copy NGUYÊN từ RN (convention: màn
 * mock được giữ mock như RN).
 *
 * Layout theo design HTML cancellation_policy/code.html:
 * - Top App Bar: surface bg, back + 'Huỷ Lịch' + spacer
 * - Warning banner: errorContainer bg, 'Lưu ý giới hạn huỷ' (2/3 lần)
 * - Refund policy section: surface card với progress timeline
 *   (3 mốc: ≥24h 100%, 6-24h 80%, <6h 50%) + estimated refund
 * - Booking detail section: surface card với task info + price
 * - Reason input: text area
 * - Sticky footer: 'Xác nhận huỷ lịch' button (errorDeep bg)
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar dark-content + paddingTop insets.top+32 → StatusBarSpacer + paddingTop 32.
 *  - Animated.timing fade (ANIM.timingNormal) → CSS transition opacity + setState.
 *  - RN đã có nhánh Platform.OS==='web' → alert(msg); zalo luôn web → giữ nhánh
 *    alert. showComingSoon → showAlert('Thông báo', ...) như utils/comingSoon.js.
 *  - Icon: mọi glyph RN dùng đều có sẵn (warning/checkmark/time/person/close-circle/
 *    arrow-back).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, ANIM, TYPO, typo } from "@/theme";
import { useNav } from "@/navigation/router";

/* ── showComingSoon — utils/comingSoon.js (Alert 1 nút → showAlert) ── */
const showComingSoon = (featureName?: string) =>
  showAlert(
    "Thông báo",
    featureName
      ? `Tính năng "${featureName}" đang được phát triển. Vui lòng quay lại sau!`
      : "Tính năng đang được phát triển. Vui lòng quay lại sau!"
  );

// === MOCK DATA — thay bằng API khi backend sẵn sàng ===
const MOCK_BOOKING = {
  taskTitle: "Đưa đón bé Mai từ trường",
  carepartner: "Nguyễn Thị Lan",
  scheduledTime: "Hôm nay, 16:30",
  originalPrice: 300000,
  refundPercent: 50, // dựa trên thời gian hiện tại so với scheduled_time
  refundAmount: 150000,
  cancellationsUsed: 2,
  cancellationsLimit: 3,
};

// 3 mốc hoàn tiền
const REFUND_TIERS = [
  {
    hoursBefore: "≥ 24h",
    percent: 100,
    icon: "checkmark",
    active: false,
  },
  {
    hoursBefore: "6h - 24h",
    percent: 80,
    icon: "checkmark",
    active: false,
  },
  {
    hoursBefore: "< 6h",
    percent: 50,
    icon: "time",
    active: true, // mốc hiện tại
  },
];

const CANCEL_REASONS = [
  { id: "schedule", label: "Trùng lịch đột xuất" },
  { id: "sick", label: "Bé bị ốm" },
  { id: "family", label: "Việc gia đình" },
  { id: "weather", label: "Thời tiết xấu" },
  { id: "other", label: "Lý do khác" },
];

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    minHeight: "100dvh",
    background: COLORS.surfaceWarm,
    display: "flex",
    flexDirection: "column",
  },
  // === APP BAR ===
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px 12px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.outlineVariant}`,
  },
  appBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: COLORS.surfaceContainerLow,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  appBarTitle: { ...typo("h1"), color: COLORS.primary, fontSize: 22 },
  // === SCROLL ===
  scrollView: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  scrollContent: { display: "flex", flexDirection: "column", padding: "24px 20px 40px", gap: 20 },
  // === WARNING BANNER ===
  warningBanner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    background: COLORS.errorContainer,
    borderRadius: 14,
    padding: 14,
    border: "1px solid rgba(186, 26, 26, 0.2)",
    boxShadow: SHADOWS.small,
  },
  warningIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: "#ffffff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  warningContent: { flex: 1 },
  warningTitle: { ...typo("h4"), color: COLORS.errorDeep, marginBottom: 4 },
  warningText: {
    ...typo("body", { fontSize: 14, lineHeight: "20px" }),
    color: COLORS.onSurface, // on-error-container
  },
  warningStrong: { fontWeight: 800, color: COLORS.errorDeep },
  // === POLICY CARD ===
  policyCard: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  sectionTitle: { ...typo("h3"), color: COLORS.onSurface, marginBottom: 16 },
  // === TIMELINE ===
  timelineRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
    padding: "8px 0 16px",
    marginBottom: 16,
  },
  timelineBgLine: {
    position: "absolute",
    top: 32,
    left: 32,
    right: 32,
    height: 4,
    background: COLORS.surfaceContainerHigh,
    borderRadius: 2,
  },
  timelineActiveLine: {
    position: "absolute",
    top: 32,
    right: 32,
    height: 4,
    background: COLORS.primary,
    borderRadius: 2,
    zIndex: 1,
  },
  tierItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 80,
    gap: 4,
  },
  tierDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.surfaceContainerHigh,
    border: `2px solid ${COLORS.surface}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    boxSizing: "border-box",
  },
  tierDotActive: {
    background: COLORS.primary,
    borderColor: COLORS.surface,
    boxShadow: SHADOWS.medium,
  },
  tierTooltip: {
    background: COLORS.primary,
    padding: "2px 8px",
    borderRadius: 6,
    marginTop: 4,
  },
  tierTooltipText: { ...TYPO.caption, lineHeight: "16px", fontSize: 10, color: COLORS.textOnPrimary, fontWeight: 700 },
  tierHours: {
    ...typo("caption"),
    color: COLORS.onSurfaceVariant,
    textAlign: "center",
    marginTop: 4,
  },
  tierHoursActive: { color: COLORS.primary, fontWeight: 700 },
  tierPercent: { ...typo("caption"), color: COLORS.onSurfaceVariant, textAlign: "center" },
  tierPercentActive: { color: COLORS.primary, fontWeight: 800 },
  // === REFUND BOX ===
  refundBox: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    background: COLORS.surfaceContainerLow,
    borderRadius: 14,
    padding: 16,
  },
  refundLabel: { ...typo("body", { fontSize: 14 }), color: COLORS.onSurfaceVariant },
  refundNote: { ...typo("caption"), color: COLORS.outline, marginTop: 2 },
  refundAmountBlock: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  refundAmount: { ...typo("h2"), color: COLORS.primary },
  refundOriginal: { ...typo("caption"), color: COLORS.onSurfaceVariant, textDecoration: "line-through" },
  // === BOOKING CARD ===
  bookingCard: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  bookingInfo: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 14 },
  bookingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  bookingText: { flex: 1 },
  bookingTitle: { ...typo("h4"), color: COLORS.onSurface, marginBottom: 4 },
  bookingSub: { ...typo("body", { fontSize: 13 }), color: COLORS.onSurfaceVariant, marginTop: 2 },
  // === REASON SECTION ===
  reasonSection: { display: "flex", flexDirection: "column", gap: 12 },
  reasonList: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    padding: "8px 14px",
    borderRadius: 999,
    background: COLORS.surface,
    border: `1px solid ${COLORS.outlineVariant}`,
  },
  reasonChipActive: {
    background: COLORS.primary,
    borderColor: COLORS.primary,
    boxShadow: SHADOWS.small,
  },
  reasonChipText: { ...typo("body", { fontSize: 13 }), color: COLORS.onSurface },
  reasonChipTextActive: { color: COLORS.textOnPrimary, fontWeight: 700 },
  // === NOTE INPUT ===
  noteField: { display: "flex", flexDirection: "column", gap: 8 },
  noteLabel: { ...typo("caption"), color: COLORS.onSurfaceVariant, fontWeight: 700, letterSpacing: 0.5 },
  noteInputBox: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.outlineVariant}`,
    borderRadius: 14,
    padding: "12px 14px",
    minHeight: 80,
  },
  noteInput: {
    ...typo("body"),
    color: COLORS.onSurface,
    padding: 0,
    minHeight: 56,
    border: "none",
    outline: "none",
    resize: "none",
    width: "100%",
    background: "transparent",
    boxSizing: "border-box",
  },
  // === FOOTER ===
  footer: {
    padding: "20px 20px 36px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.outlineVariant}`,
  },
  cancelBtn: {
    background: COLORS.errorDeep,
    borderRadius: 14,
    height: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: SHADOWS.large,
  },
  cancelBtnText: { ...typo("h4"), color: COLORS.textOnPrimary },
};

const CancellationPolicyScreen: React.FC = () => {
  const nav = useNav();

  // QA-FIX-UI 3.2: fade-in animation khi mount (opacity 0→1) — CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFaded(true), 30);
    return () => clearTimeout(t);
  }, []);

  const [booking] = useState(MOCK_BOOKING);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const handleConfirmCancel = () => {
    if (!selectedReason) {
      // RN: Platform.OS === 'web' → alert(msg) — zalo luôn là web
      window.alert("Vui lòng chọn lý do huỷ lịch.");
      return;
    }
    showComingSoon("Xác nhận huỷ lịch (backend đang phát triển)");
  };

  const formatPrice = (price: number) => `${price.toLocaleString("vi-VN")}đ`;

  return (
    <div
      style={{
        ...S.container,
        opacity: faded ? 1 : 0,
        transition: `opacity ${ANIM.timingNormal}ms`,
      }}
    >
      <StatusBarSpacer />
      <style>{`.edc-cp-note::placeholder{color:${COLORS.outline};opacity:1}`}</style>

      {/* Top App Bar */}
      <div style={{ ...S.appBar, paddingTop: 32 }}>
        <Touchable
          onPress={nav.goBack}
          style={S.appBarBtn}
          hitSlop={12}
          aria-role="button"
          aria-label="Quay lại"
        >
          <Icon name="arrow-back" size={22} color={COLORS.primary} />
        </Touchable>
        <div style={S.appBarTitle}>Huỷ Lịch</div>
        <div style={{ width: 44 }} />
      </div>

      <div style={S.scrollView}>
        <div style={S.scrollContent}>
          {/* Warning banner — errorContainer bg */}
          <div style={S.warningBanner}>
            <div style={S.warningIconBox}>
              <Icon name="warning" size={20} color={COLORS.errorDeep} />
            </div>
            <div style={S.warningContent}>
              <div style={S.warningTitle}>Lưu ý giới hạn huỷ</div>
              <div style={S.warningText}>
                Bạn đã sử dụng{" "}
                <span style={S.warningStrong}>
                  {booking.cancellationsUsed}/{booking.cancellationsLimit}
                </span>{" "}
                lần huỷ lịch miễn phí trong tháng này. Nếu vượt quá, tài khoản có thể bị hạn chế.
              </div>
            </div>
          </div>

          {/* Refund policy section */}
          <div style={S.policyCard}>
            <div style={S.sectionTitle}>Chính sách hoàn tiền</div>

            {/* Timeline 3 mốc */}
            <div style={S.timelineRow}>
              {/* Background line */}
              <div style={S.timelineBgLine} />
              {/* Active progress (1/3 = 33%) */}
              <div style={{ ...S.timelineActiveLine, width: "33%" }} />

              {REFUND_TIERS.map((tier, idx) => (
                <div key={idx} style={S.tierItem}>
                  {/* Tier dot */}
                  <div style={{ ...S.tierDot, ...(tier.active ? S.tierDotActive : {}) }}>
                    <Icon
                      name={tier.icon}
                      size={14}
                      color={tier.active ? "#fff" : COLORS.onSurfaceVariant}
                    />
                  </div>
                  {/* Active tooltip */}
                  {tier.active && (
                    <div style={S.tierTooltip}>
                      <div style={S.tierTooltipText}>Hiện tại</div>
                    </div>
                  )}
                  {/* Tier label */}
                  <div style={{ ...S.tierHours, ...(tier.active ? S.tierHoursActive : {}) }}>
                    {tier.hoursBefore}
                  </div>
                  <div style={{ ...S.tierPercent, ...(tier.active ? S.tierPercentActive : {}) }}>
                    {tier.percent}%
                  </div>
                </div>
              ))}
            </div>

            {/* Estimated refund */}
            <div style={S.refundBox}>
              <div>
                <div style={S.refundLabel}>
                  Số tiền hoàn lại dự kiến ({booking.refundPercent}%)
                </div>
                <div style={S.refundNote}>Hoàn về ví EduCareLink sau 24h</div>
              </div>
              <div style={S.refundAmountBlock}>
                <div style={S.refundAmount}>{formatPrice(booking.refundAmount)}</div>
                <div style={S.refundOriginal}>{formatPrice(booking.originalPrice)}</div>
              </div>
            </div>
          </div>

          {/* Booking detail */}
          <div style={S.bookingCard}>
            <div style={S.sectionTitle}>Chi tiết buổi chăm sóc</div>
            <div style={S.bookingInfo}>
              <div style={S.bookingIcon}>
                <Icon name="person" size={20} color={COLORS.primary} />
              </div>
              <div style={S.bookingText}>
                <div style={S.bookingTitle}>{booking.taskTitle}</div>
                <div style={S.bookingSub}>CarePartner: {booking.carepartner}</div>
                <div style={S.bookingSub}>Thời gian: {booking.scheduledTime}</div>
              </div>
            </div>
          </div>

          {/* Reason selection */}
          <div style={S.reasonSection}>
            <div style={S.sectionTitle}>Lý do huỷ lịch</div>
            <div style={S.reasonList}>
              {CANCEL_REASONS.map((reason) => (
                <Touchable
                  key={reason.id}
                  style={{
                    ...S.reasonChip,
                    ...(selectedReason === reason.id ? S.reasonChipActive : {}),
                  }}
                  onPress={() => setSelectedReason(reason.id)}
                  activeOpacity={0.85}
                >
                  <div
                    style={{
                      ...S.reasonChipText,
                      ...(selectedReason === reason.id ? S.reasonChipTextActive : {}),
                    }}
                  >
                    {reason.label}
                  </div>
                </Touchable>
              ))}
            </div>

            {/* Note input */}
            <div style={S.noteField}>
              <div style={S.noteLabel}>Ghi chú thêm (tuỳ chọn)</div>
              <div style={S.noteInputBox}>
                <textarea
                  className="edc-cp-note"
                  style={S.noteInput}
                  placeholder="VD: Bé bị sốt nên cần nghỉ..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div style={{ height: 100 }} />
        </div>
      </div>

      {/* Sticky footer — 'Xác nhận huỷ lịch' button */}
      <div style={S.footer}>
        <Touchable style={S.cancelBtn} onPress={handleConfirmCancel} activeOpacity={0.85}>
          <Icon name="close-circle" size={20} color="#fff" />
          <div style={S.cancelBtnText}>Xác nhận huỷ lịch</div>
        </Touchable>
      </div>
    </div>
  );
};

export default CancellationPolicyScreen;
