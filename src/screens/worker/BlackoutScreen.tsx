/**
 * BlackoutScreen — port CHÍNH XÁC mobile/src/screens/Worker/BlackoutScreen.js (1390 dòng).
 * Khai báo lịch bận: sticky header, hero shield card (ELO + hạn mức 30 ngày), form bento
 * (6 reason chips, ghi chú, switch bận cả ngày, preset khung giờ, stepper ±30 phút,
 * chọn ngày), nút "Lưu Lịch Bận & Tạm Khóa Ghép Việc", danh sách ngày bận đã khai
 * (strip đỏ cả ngày / cam khung giờ), rules card 3 quy tắc, university badge, modal quy định.
 * API: getBlackouts / addBlackout / deleteBlackout (matching) — trùng booking 409 → alert
 * "Trùng đơn đã xác nhận" đúng RN; too_many_blackouts → "Giới hạn".
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - API zalo trả body trực tiếp (không bọc .data như axios RN): getBlackouts() → mảng.
 *  - RN dùng @react-native-community/datetimepicker (chỉ native) → web tự dựng LỊCH MINI THÁNG
 *    (grid 7 cột, Monday-first, điều hướng tháng, chặn ngày trước hôm nay như minimumDate).
 *  - RN Alert.alert 2 nút (Mở lại lịch nhận việc) → window.confirm gộp; alert 1 nút → showAlert().
 *  - RN Switch (native) → toggle CSS tự dựng (track #CBD5E1/#F26522, thumb trắng).
 *  - Icon 'remove' (dấu trừ) thiếu → MinusIcon CSS; alias cục bộ: school-outline→school,
 *    medkit-outline→medkit, airplane-outline→navigate-outline, bookmark-outline→flag-outline,
 *    lock-closed→lock-closed-outline, book-outline→book.
 *  - RefreshControl (kéo-tải) không tồn tại trên web — load khi mount (≈ useFocusEffect RN).
 */
import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Screen, Spinner, StatusBarSpacer, Touchable, showAlert } from "@/components/ui";
import { SHADOWS } from "@/theme";
import { getBlackouts, addBlackout, deleteBlackout } from "@/api/matching";
import { useNav } from "@/navigation/router";

const REASONS = [
  { code: "exam", label: "Thi / Kiểm tra", emoji: "🎓", icon: "school-outline" },
  { code: "health", label: "Sức khỏe / Ốm", emoji: "🩺", icon: "medkit-outline" },
  { code: "family", label: "Việc gia đình", emoji: "🏡", icon: "home-outline" },
  { code: "travel", label: "Đi xa / Về quê", emoji: "✈️", icon: "airplane-outline" },
  { code: "personal", label: "Việc cá nhân", emoji: "👤", icon: "person-outline" },
  { code: "other", label: "Lý do khác", emoji: "📌", icon: "bookmark-outline" },
];

const TIME_PRESETS = [
  { label: "Sáng (07:00 - 12:00)", from: "07:00", to: "12:00" },
  { label: "Chiều (13:00 - 17:30)", from: "13:00", to: "17:30" },
  { label: "Tối (18:00 - 22:00)", from: "18:00", to: "22:00" },
];

/* Icon alias — glyph thiếu trong ionicons.ts zalo (chỉ thêm tại đây, không sửa file chung) */
const ICON_ALIAS: Record<string, string> = {
  "school-outline": "school",
  "medkit-outline": "medkit",
  "airplane-outline": "navigate-outline",
  "bookmark-outline": "flag-outline",
  "lock-closed": "lock-closed-outline",
  "book-outline": "book",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/** Ionicons 'remove' (dấu trừ) — glyph thiếu, dựng bằng CSS thanh ngang */
const MinusIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "#131B2E" }) => (
  <span
    style={{
      display: "inline-block",
      width: size * 0.72,
      height: Math.max(2, size * 0.11),
      borderRadius: size * 0.06,
      background: color,
    }}
  />
);

/** Switch native RN → toggle web (trackColor false #CBD5E1 / true #F26522, thumb #FFFFFF) */
const Switch: React.FC<{ value: boolean; onValueChange: (v: boolean) => void }> = ({ value, onValueChange }) => (
  <Touchable
    onPress={() => onValueChange(!value)}
    style={{
      width: 51,
      height: 31,
      borderRadius: 15.5,
      background: value ? "#F26522" : "#CBD5E1",
      padding: 2,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: value ? "flex-end" : "flex-start",
      transition: "background 0.2s",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: 27,
        height: 27,
        borderRadius: 13.5,
        background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "transform 0.15s",
      }}
    />
  </Touchable>
);

/** numberOfLines RN → CSS line-clamp */
const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: n,
  overflow: "hidden",
});

// utils/date.js formatDateToYMD — tránh lỗi múi giờ khi dùng toISOString()
const formatDateToYMD = (date: Date | string | number): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/* ================= Mini Month Calendar — thay DateTimePicker trên web ================= */
const MiniMonthCalendar: React.FC<{
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
}> = ({ value, onChange, onClose }) => {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth()); // 0-11
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday-first: (getDay() + 6) % 7 ô trống đầu tuần
  const leadingBlanks = (firstDay.getDay() + 6) % 7;

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];
  const dowHeader = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0, 0, 0, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 320, background: "#FFFFFF", borderRadius: 18, padding: 16, boxShadow: SHADOWS.medium }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: điều hướng tháng */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Touchable
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
            style={{ width: 34, height: 34, borderRadius: 17, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="chevron-back" size={18} color="#131B2E" />
          </Touchable>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#131B2E" }}>
            {monthNames[viewMonth]} {viewYear}
          </span>
          <Touchable
            onPress={() => shiftMonth(1)}
            hitSlop={8}
            style={{ width: 34, height: 34, borderRadius: 17, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="chevron-forward" size={18} color="#131B2E" />
          </Touchable>
        </div>

        {/* Header thứ trong tuần */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {dowHeader.map((d) => (
            <div
              key={d}
              style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "#64748B", padding: "4px 0" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid ngày (7 cột) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 2 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={`b-${idx}`} />;
            const cellDate = new Date(viewYear, viewMonth, day);
            const isPast = cellDate.getTime() < today.getTime(); // minimumDate = hôm nay (như RN)
            const isSelected = formatDateToYMD(cellDate) === formatDateToYMD(value);
            const isToday = formatDateToYMD(cellDate) === formatDateToYMD(today);
            return (
              <Touchable
                key={day}
                disabled={isPast}
                onPress={() => {
                  onChange(cellDate);
                  onClose();
                }}
                style={{
                  height: 38,
                  borderRadius: 19,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isSelected ? "#F26522" : "transparent",
                  border: isToday && !isSelected ? "1px solid #FED7AA" : "1px solid transparent",
                  opacity: isPast ? 0.3 : 1,
                  cursor: isPast ? "default" : "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "#FFFFFF" : isPast ? "#94A3B8" : "#131B2E",
                  }}
                >
                  {day}
                </span>
              </Touchable>
            );
          })}
        </div>

        <Touchable
          onPress={onClose}
          style={{
            marginTop: 12,
            background: "#F26522",
            borderRadius: 12,
            padding: "10px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700 }}>Chọn ngày này</span>
        </Touchable>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: "#FAF8FF" },
  headerSection: {
    background: "rgba(250, 248, 255, 0.95)",
    borderBottom: "1px solid #E2E8F0",
    padding: "0 16px 10px",
    zIndex: 10,
    flexShrink: 0,
  },
  headerContent: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    background: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  headerTitleWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
    padding: "0 8px",
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#131B2E",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  headerSubtitleRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  activeDot: { width: 6, height: 6, borderRadius: 3, background: "#00714C" },
  headerSubtitle: { fontSize: 11, color: "#594138" },

  // 1. HERO SHIELD CARD
  heroCard: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    border: "1px solid #FED7AA",
    boxShadow: SHADOWS.small,
  },
  heroTopRow: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 12 },
  shieldIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#E11D48",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 15, fontWeight: 700, color: "#131B2E", marginBottom: 4 },
  heroDesc: { fontSize: 12.5, lineHeight: "18px", color: "#594138" },
  heroBadgesRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid #F1F5F9",
  },
  trustScorePill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    background: "#ECFDF5",
    padding: "5px 10px",
    borderRadius: 20,
  },
  trustScoreText: { fontSize: 11.5, color: "#00714C" },
  limitPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    background: "#FEF3C7",
    padding: "5px 10px",
    borderRadius: 20,
  },
  limitText: { fontSize: 11.5, color: "#855300", fontWeight: 600 },
  boldText: { fontWeight: 700 },

  // 2. FORM BENTO
  formCard: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    boxShadow: SHADOWS.small,
  },
  formHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  formTitleWrap: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  addIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    background: "#FFF4ED",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: { fontSize: 16, fontWeight: 700, color: "#131B2E" },
  versionBadge: { background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 },
  versionBadgeText: { fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: "0.5px" },

  sectionBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.4px", marginBottom: 8 },
  reasonGrid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonPill: {
    width: "31%",
    background: "#F8FAFC",
    borderRadius: 12,
    padding: "10px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #E2E8F0",
  },
  reasonPillActive: {
    background: "#FFF4ED",
    borderColor: "#F26522",
    borderWidth: "1.5px",
    boxShadow: SHADOWS.small,
  },
  reasonEmoji: { fontSize: 20, marginBottom: 4 },
  reasonText: { fontSize: 11, color: "#475569", textAlign: "center", ...clamp(1) },
  reasonTextActive: { color: "#F26522", fontWeight: 700 },

  inputWrap: { position: "relative", display: "flex", justifyContent: "center" },
  textInput: {
    background: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: "10px 38px 10px 14px",
    fontSize: 13,
    color: "#131B2E",
    outline: "none",
    width: "100%",
  },
  inputIcon: { position: "absolute", right: 12, pointerEvents: "none" as const },

  // TIME SECTION
  timeSectionBox: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    border: "1px solid #E2E8F0",
  },
  timeToggleRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeToggleLeft: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  timeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#FFF4ED",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  timeToggleTitle: { fontSize: 13.5, fontWeight: 700, color: "#131B2E" },
  timeToggleSub: { fontSize: 11, color: "#64748B" },
  hourlyContainer: { marginTop: 12, paddingTop: 12, borderTop: "1px solid #E2E8F0" },
  presetChipsRow: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  presetChip: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: "5px 10px",
    border: "1px solid #CBD5E1",
  },
  presetChipText: { fontSize: 11, color: "#475569", fontWeight: 600 },
  stepperCard: {
    background: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid #E2E8F0",
  },
  stepperLabel: { fontSize: 10, fontWeight: 700, color: "#64748B" },
  stepperTimeDisplay: { fontSize: 15, fontWeight: 700, color: "#F26522", marginTop: 2 },
  stepperActions: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnPrimary: { background: "#F26522" },

  // DATE SELECTOR
  dateSelectorBtn: {
    background: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: 12,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLeftRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 },
  calendarIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: "#FFF4ED",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateValueText: { fontSize: 14, fontWeight: 700, color: "#131B2E" },
  dateHintText: { fontSize: 11, color: "#64748B", marginTop: 1 },

  submitBtn: {
    background: "#F26522",
    borderRadius: 12,
    padding: "14px 0",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: SHADOWS.small,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: 700 },

  // 3. BLACKOUT LIST
  listSection: { marginBottom: 20 },
  listHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listHeaderLeft: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  listTitle: { fontSize: 16, fontWeight: 700, color: "#131B2E" },
  countPill: { background: "#FEE2E2", padding: "2px 8px", borderRadius: 12 },
  countPillText: { fontSize: 11, fontWeight: 700, color: "#991B1B" },
  itemsList: { display: "flex", flexDirection: "column", gap: 10 },
  blackoutCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    border: "1px solid #F1F5F9",
    boxShadow: SHADOWS.small,
  },
  cardLeftStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  stripRed: { background: "#E11D48" },
  stripAmber: { background: "#F59E0B" },
  cardMain: { flex: 1, paddingLeft: 8, minWidth: 0 },
  cardHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  cardDateText: { fontSize: 13.5, fontWeight: 700, color: "#131B2E" },
  timeTypeBadge: { borderRadius: 6, padding: "2px 6px" },
  badgeAllDay: { background: "#FEE2E2" },
  badgeHourly: { background: "#FEF3C7" },
  timeTypeBadgeText: { fontSize: 10.5, fontWeight: 700 },
  textAllDay: { color: "#991B1B" },
  textHourly: { color: "#92400E" },
  reasonRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  reasonBadgeText: { fontSize: 12, fontWeight: 600, color: "#334155" },
  cardNoteText: { fontSize: 11.5, color: "#64748B", marginLeft: 4, flex: 1, minWidth: 0, ...clamp(1) },
  cardFootnote: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  cardFootnoteText: { fontSize: 10.5 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    flexShrink: 0,
  },
  emptyCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: "32px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #E2E8F0",
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: 700, color: "#131B2E", marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: "#64748B", textAlign: "center", lineHeight: "18px" },
  errorBox: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { marginTop: 8, fontSize: 13, color: "#64748B", textAlign: "center" },
  retryBtn: {
    marginTop: 12,
    padding: "8px 16px",
    borderRadius: 14,
    background: "#F26522",
  },
  retryBtnText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: 700 },

  // 4. RULES CARD
  rulesCard: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    border: "1px solid #E2E8F0",
  },
  rulesHeaderRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  rulesTitle: { fontSize: 14, fontWeight: 700, color: "#131B2E" },
  rulesList: { display: "flex", flexDirection: "column", gap: 10 },
  ruleItem: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ruleNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    background: "#FFF4ED",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  ruleNumberText: { fontSize: 11, fontWeight: 700, color: "#F26522" },
  ruleItemText: { flex: 1, fontSize: 12, lineHeight: "18px", color: "#475569" },

  // 5. UNIV BADGE
  univBadgeRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 0",
  },
  univBadgeText: { fontSize: 11, color: "#64748B" },

  // MODAL
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    background: "rgba(0, 0, 0, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    background: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    boxShadow: SHADOWS.medium,
  },
  modalHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "1px solid #F1F5F9",
  },
  modalHeaderLeft: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 15, fontWeight: 700, color: "#131B2E" },
  modalParagraph: { fontSize: 13, lineHeight: "20px", color: "#475569", marginBottom: 10 },
  modalBullet: { fontSize: 12.5, lineHeight: "19px", color: "#334155", marginBottom: 8 },
  modalCloseBtn: {
    marginTop: 16,
    background: "#F26522",
    borderRadius: 12,
    padding: "12px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: 700 },
};

const BlackoutScreen: React.FC = () => {
  const nav = useNav();

  // State
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  // Form states
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Mặc định ngày mai
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [reason, setReason] = useState("exam");
  const [note, setNote] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [timeFrom, setTimeFrom] = useState("07:00");
  const [timeTo, setTimeTo] = useState("12:00");
  const [rulesModalVisible, setRulesModalVisible] = useState(false);

  // Tải danh sách ngày bận từ backend
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data: any = await getBlackouts();
      setItems(data ?? []);
    } catch (err) {
      setLoadError("Không tải được danh sách ngày bận. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  // RN useFocusEffect → web: gọi khi mount (màn remount khi quay lại)
  useEffect(() => {
    load();
  }, [load]);

  // Điều chỉnh giờ bắt đầu / kết thúc theo bước nhảy 30 phút
  const adjustTime = (type: "from" | "to", deltaMinutes: number) => {
    const parseMins = (str: string) => {
      const [h, m] = str.split(":").map(Number);
      return h * 60 + m;
    };
    const formatMins = (mins: number) => {
      const positiveMins = (mins + 24 * 60) % (24 * 60);
      const h = Math.floor(positiveMins / 60);
      const m = positiveMins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    if (type === "from") {
      const newMins = parseMins(timeFrom) + deltaMinutes;
      setTimeFrom(formatMins(newMins));
    } else {
      const newMins = parseMins(timeTo) + deltaMinutes;
      setTimeTo(formatMins(newMins));
    }
  };

  // Định dạng ngày theo tiếng Việt hiển thị
  const formatDateVi = (dateObj: Date | string) => {
    if (!dateObj) return "";
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return String(dateObj);
    const weekdays = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayName = weekdays[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dayName}, ${dd}/${mm}/${yyyy}`;
  };

  // Lưu ngày bận mới
  const handleSaveBlackout = async () => {
    const dateStr = formatDateToYMD(selectedDate);
    const payload: Record<string, any> = {
      date: dateStr,
      reason,
      note: note.trim() || undefined,
      time_from: allDay ? null : timeFrom,
      time_to: allDay ? null : timeTo,
    };

    setSubmitting(true);
    try {
      await addBlackout(payload);
      await load();
      showAlert("Thành công", `Đã ghi nhận ngày bận ${formatDateVi(selectedDate)}.`);
      setNote("");
    } catch (err: any) {
      const body = err?.response?.data;
      if (err?.response?.status === 409) {
        showAlert(
          "Trùng đơn đã xác nhận",
          "Ngày này bạn đang có đơn đã nhận việc. Hãy vào Việc của tôi để xin hoán đổi ca trước khi khai bận."
        );
      } else if (body?.code === "too_many_blackouts") {
        showAlert("Giới hạn", body.detail ?? "Tối đa 30 ngày bận trong tương lai.");
      } else {
        const errorMsg =
          typeof body?.detail === "string"
            ? body.detail
            : typeof body?.error === "string"
            ? body.error
            : "Không thể lưu ngày bận. Vui lòng thử lại.";
        showAlert("Không thể lưu", errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa ngày bận
  const handleDeleteBlackout = (item: any) => {
    // RN Alert.alert 2 nút [Đóng / Mở lại lịch nhận việc destructive] → window.confirm (web)
    const detailTime = item.time_from
      ? `${item.time_from.slice(0, 5)} - ${item.time_to.slice(0, 5)}`
      : "Cả ngày";
    if (
      !window.confirm(
        `Hủy lịch bận này?\n\nBạn có chắc chắn muốn mở lại lịch nhận việc cho ngày ${formatDateVi(item.date)} (${detailTime})?`
      )
    )
      return;
    (async () => {
      setDeletingId(item.id);
      try {
        await deleteBlackout(item.id);
        await load();
      } catch {
        showAlert("Lỗi", "Không thể xóa ngày bận. Vui lòng thử lại.");
      } finally {
        setDeletingId(null);
      }
    })();
  };

  return (
    <Screen bg="#FAF8FF" scroll={false}>
      {/* STICKY TOP APP BAR */}
      <div style={styles.headerSection}>
        <StatusBarSpacer />
        <div style={styles.headerContent}>
          <Touchable style={styles.headerBtn} onPress={() => nav.goBack()}>
            <Icon name="arrow-back" size={20} color="#131B2E" />
          </Touchable>

          <div style={styles.headerTitleWrap}>
            <div style={styles.headerTitle}>Khai Báo Lịch Bận &amp; Thi</div>
            <div style={styles.headerSubtitleRow}>
              <div style={styles.activeDot} />
              <div style={styles.headerSubtitle}>AI tạm dừng ghép việc các ngày này</div>
            </div>
          </div>

          <Touchable style={styles.headerBtn} onPress={() => setRulesModalVisible(true)}>
            <Icon name="shield-checkmark" size={20} color="#F26522" />
          </Touchable>
        </div>
      </div>

      {/* Scroll content (paddingBottom 110 như RN — chừa chỗ bottom tab) */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
        <div style={{ padding: "16px 16px 110px" }}>
          {/* 1. HERO BENTO WARNING & SHIELD CARD */}
          <div style={styles.heroCard}>
            <div style={styles.heroTopRow}>
              <div style={styles.shieldIconWrap}>
                <Icon name="shield" size={24} color="#FFFFFF" />
              </div>
              <div style={styles.heroTextWrap}>
                <div style={styles.heroTitle}>Bảo Vệ Điểm Tín Nhiệm &amp; ELO Đối Tác</div>
                <div style={styles.heroDesc}>
                  Báo bận trước ít nhất 24 giờ giúp bạn duy trì chỉ số uy tín 100% và không bị trừ điểm tín nhiệm khi bước vào mùa thi học
                  kỳ hoặc có việc gia đình đột xuất.
                </div>
              </div>
            </div>

            {/* Badges row */}
            <div style={styles.heroBadgesRow}>
              <div style={styles.trustScorePill}>
                <Icon name="checkmark-circle" size={15} color="#00714C" />
                <span style={styles.trustScoreText}>
                  Điểm tín nhiệm hiện tại: <span style={styles.boldText}>100/100</span>
                </span>
              </div>
              <div style={styles.limitPill}>
                <Icon name="time-outline" size={15} color="#855300" />
                <span style={styles.limitText}>Tối đa 30 ngày bận tương lai</span>
              </div>
            </div>
          </div>

          {/* 2. FORM BENTO: THÊM NGÀY BẬN MỚI */}
          <div style={styles.formCard}>
            <div style={styles.formHeaderRow}>
              <div style={styles.formTitleWrap}>
                <div style={styles.addIconCircle}>
                  <Icon name="add-circle" size={19} color="#F26522" />
                </div>
                <div style={styles.formTitle}>Thêm Ngày Bận Mới</div>
              </div>
              <div style={styles.versionBadge}>
                <span style={styles.versionBadgeText}>MẪU V2.4</span>
              </div>
            </div>

            {/* REASON GRID (6 options) */}
            <div style={styles.sectionBlock}>
              <div style={styles.fieldLabel}>CHỌN LÝ DO BẬN / NGHỈ (AI GHI NHẬN HỒ SƠ)</div>
              <div style={styles.reasonGrid}>
                {REASONS.map((r) => {
                  const isSelected = reason === r.code;
                  return (
                    <Touchable
                      key={r.code}
                      style={{ ...styles.reasonPill, ...(isSelected ? styles.reasonPillActive : {}) }}
                      onPress={() => setReason(r.code)}
                      activeOpacity={0.75}
                    >
                      <span style={styles.reasonEmoji}>{r.emoji}</span>
                      <span style={{ ...styles.reasonText, ...(isSelected ? styles.reasonTextActive : {}) }}>{r.label}</span>
                    </Touchable>
                  );
                })}
              </div>
            </div>

            {/* NOTE / EXAM DETAIL INPUT */}
            <div style={styles.sectionBlock}>
              <div style={styles.fieldLabel}>CHI TIẾT MÔN HỌC HOẶC GHI CHÚ BẬN</div>
              <div style={styles.inputWrap}>
                <input
                  style={styles.textInput}
                  placeholder="Ví dụ: Thi cuối kỳ môn Giải Tích 2 (ĐH Khoa học Huế)..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <span style={styles.inputIcon}>
                  <Icon name="create-outline" size={18} color="#94A3B8" />
                </span>
              </div>
            </div>

            {/* ALL-DAY TOGGLE & HOURLY STEPPERS */}
            <div style={styles.timeSectionBox}>
              <div style={styles.timeToggleRow}>
                <div style={styles.timeToggleLeft}>
                  <div style={styles.timeIconWrap}>
                    <Icon name="calendar-outline" size={18} color="#F26522" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.timeToggleTitle}>Bận cả ngày (24 giờ)</div>
                    <div style={styles.timeToggleSub}>Khuyên dùng khi thi môn chính hoặc về quê</div>
                  </div>
                </div>
                <Switch value={allDay} onValueChange={setAllDay} />
              </div>

              {/* Collapsible Hourly Segment */}
              {!allDay && (
                <div style={styles.hourlyContainer}>
                  {/* Presets */}
                  <div style={styles.presetChipsRow}>
                    {TIME_PRESETS.map((p, idx) => (
                      <Touchable
                        key={idx}
                        style={styles.presetChip}
                        onPress={() => {
                          setTimeFrom(p.from);
                          setTimeTo(p.to);
                        }}
                      >
                        <span style={styles.presetChipText}>{p.label}</span>
                      </Touchable>
                    ))}
                  </div>

                  {/* Steppers */}
                  <div style={styles.stepperCard}>
                    <div>
                      <div style={styles.stepperLabel}>KHUNG GIỜ BẬN</div>
                      <div style={styles.stepperTimeDisplay}>
                        {timeFrom} – {timeTo}
                      </div>
                    </div>
                    <div style={styles.stepperActions}>
                      <Touchable
                        style={styles.stepperBtn}
                        onPress={() => adjustTime("from", -30)}
                      >
                        <MinusIcon size={16} color="#131B2E" />
                      </Touchable>
                      <Touchable
                        style={{ ...styles.stepperBtn, ...styles.stepperBtnPrimary }}
                        onPress={() => adjustTime("to", 30)}
                      >
                        <Icon name="add" size={16} color="#FFFFFF" />
                      </Touchable>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* DATE SELECTION TRIGGER */}
            <div style={styles.sectionBlock}>
              <div style={styles.fieldLabel}>NGÀY ÁP DỤNG</div>
              <Touchable style={styles.dateSelectorBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
                <div style={styles.dateLeftRow}>
                  <div style={styles.calendarIconCircle}>
                    <Icon name="calendar" size={20} color="#F26522" />
                  </div>
                  <div>
                    <div style={styles.dateValueText}>{formatDateVi(selectedDate)}</div>
                    <div style={styles.dateHintText}>Chạm để đổi ngày bạn muốn khai bận</div>
                  </div>
                </div>
                <Icon name="chevron-forward" size={18} color="#94A3B8" />
              </Touchable>

              {showPicker && (
                <MiniMonthCalendar value={selectedDate} onChange={setSelectedDate} onClose={() => setShowPicker(false)} />
              )}
            </div>

            {/* MAIN SUBMIT BUTTON */}
            <Touchable
              style={{ ...styles.submitBtn, ...(submitting ? styles.submitBtnDisabled : {}) }}
              onPress={handleSaveBlackout}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <Spinner size={22} color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
                  <span style={styles.submitBtnText}>Lưu Lịch Bận &amp; Tạm Khóa Ghép Việc</span>
                </>
              )}
            </Touchable>
          </div>

          {/* 3. REGISTERED BLACKOUT DATES BENTO LIST */}
          <div style={styles.listSection}>
            <div style={styles.listHeaderRow}>
              <div style={styles.listHeaderLeft}>
                <div style={styles.listTitle}>Lịch bận đã đăng ký</div>
                <div style={styles.countPill}>
                  <span style={styles.countPillText}>{items.length} ngày</span>
                </div>
              </div>
            </div>

            {loadError ? (
              <div style={styles.errorBox}>
                <Icon name="cloud-offline-outline" size={32} color="#DC2626" />
                <div style={styles.errorText}>{loadError}</div>
                <Touchable style={styles.retryBtn} onPress={load}>
                  <span style={styles.retryBtnText}>Thử lại</span>
                </Touchable>
              </div>
            ) : items.length === 0 ? (
              <div style={styles.emptyCard}>
                <div style={styles.emptyIconCircle}>
                  <Icon name="calendar-outline" size={36} color="#94A3B8" />
                </div>
                <div style={styles.emptyTitle}>Chưa khai ngày bận nào</div>
                <div style={styles.emptyDesc}>
                  Bạn chưa đăng ký ngày bận nào. AI đang sẵn sàng ghép việc cho bạn 7 ngày trong tuần.
                </div>
              </div>
            ) : (
              <div style={styles.itemsList}>
                {items.map((item) => {
                  const isAllDay = !item.time_from;
                  const reasonObj =
                    REASONS.find((r) => r.code === item.reason) || { label: item.reason, emoji: "📌" };

                  return (
                    <div key={item.id} style={styles.blackoutCard}>
                      {/* Dải màu đánh dấu trái */}
                      <div style={{ ...styles.cardLeftStrip, ...(isAllDay ? styles.stripRed : styles.stripAmber) }} />

                      <div style={styles.cardMain}>
                        <div style={styles.cardHeaderRow}>
                          <span style={styles.cardDateText}>{formatDateVi(item.date)}</span>
                          <div style={{ ...styles.timeTypeBadge, ...(isAllDay ? styles.badgeAllDay : styles.badgeHourly) }}>
                            <span style={{ ...styles.timeTypeBadgeText, ...(isAllDay ? styles.textAllDay : styles.textHourly) }}>
                              {isAllDay ? "Cả ngày" : `${item.time_from.slice(0, 5)} – ${item.time_to.slice(0, 5)}`}
                            </span>
                          </div>
                        </div>

                        {/* Lý do & ghi chú */}
                        <div style={styles.reasonRow}>
                          <span style={styles.reasonBadgeText}>
                            {reasonObj.emoji} {reasonObj.label}
                          </span>
                          {item.note ? (
                            <span style={styles.cardNoteText}>· {item.note}</span>
                          ) : null}
                        </div>

                        {/* Trạng thái khóa AI */}
                        <div style={styles.cardFootnote}>
                          <Icon
                            name={isAllDay ? "lock-closed" : "time"}
                            size={12}
                            color={isAllDay ? "#DC2626" : "#D97706"}
                          />
                          <span style={{ ...styles.cardFootnoteText, color: isAllDay ? "#DC2626" : "#D97706" }}>
                            {isAllDay
                              ? "Đã khóa tự động nhận đơn cả ngày"
                              : `Chỉ khóa ca ${item.time_from.slice(0, 5)} – ${item.time_to.slice(0, 5)} (Giờ khác vẫn nhận đơn)`}
                          </span>
                        </div>
                      </div>

                      {/* Nút xóa thùng rác */}
                      <Touchable
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteBlackout(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Spinner size={16} color="#DC2626" />
                        ) : (
                          <Icon name="trash-outline" size={18} color="#94A3B8" />
                        )}
                      </Touchable>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. RULES & TRUST CARD */}
          <div style={styles.rulesCard}>
            <div style={styles.rulesHeaderRow}>
              <Icon name={ic("book-outline")} size={18} color="#F26522" />
              <span style={styles.rulesTitle}>Quy tắc báo bận chuẩn CarePartner</span>
            </div>
            <div style={styles.rulesList}>
              <div style={styles.ruleItem}>
                <div style={styles.ruleNumberCircle}>
                  <span style={styles.ruleNumberText}>1</span>
                </div>
                <span style={styles.ruleItemText}>
                  <span style={styles.boldText}>Không báo bận đè lên ca đã chốt: </span>
                  Nếu đã có phụ huynh xác nhận đơn, bạn cần vào mục "Việc của tôi" xin hoán đổi ca trước 24 giờ.
                </span>
              </div>

              <div style={styles.ruleItem}>
                <div style={styles.ruleNumberCircle}>
                  <span style={styles.ruleNumberText}>2</span>
                </div>
                <span style={styles.ruleItemText}>
                  <span style={styles.boldText}>Giữ vững điểm 100/100: </span>
                  Báo trước 24 giờ với các lý do học tập, thi cử được hệ thống tự động bảo lưu thứ hạng ưu tiên ELO.
                </span>
              </div>

              <div style={styles.ruleItem}>
                <div style={styles.ruleNumberCircle}>
                  <span style={styles.ruleNumberText}>3</span>
                </div>
                <span style={styles.ruleItemText}>
                  <span style={styles.boldText}>Tự động kích hoạt lại: </span>
                  Ngay khi hết khung giờ hoặc ngày bận, AI tự động mở lại trạng thái nhận ca mà không cần thao tác thêm.
                </span>
              </div>
            </div>
          </div>

          {/* 5. UNIVERSITY TRUST BADGE */}
          <div style={styles.univBadgeRow}>
            <Icon name="checkmark-circle" size={15} color="#00714C" />
            <span style={styles.univBadgeText}>Được hỗ trợ đồng bộ với lịch học VNU, FTU, NEU, HUST, ĐHQG</span>
          </div>
        </div>
      </div>

      {/* RULES MODAL POPUP */}
      {rulesModalVisible && (
        <div style={styles.modalOverlay} onClick={() => setRulesModalVisible(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderLeft}>
                <Icon name="shield-checkmark" size={22} color="#F26522" />
                <span style={styles.modalTitle}>Quy định báo bận CarePartner</span>
              </div>
              <Touchable onPress={() => setRulesModalVisible(false)} hitSlop={8}>
                <Icon name="close" size={22} color="#131B2E" />
              </Touchable>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <div style={styles.modalParagraph}>
                Nhằm bảo vệ quyền lợi học tập của sinh viên và đảm bảo độ tin cậy đối với phụ huynh, EduCareLink áp dụng cơ chế báo bận
                tự động:
              </div>
              <div style={styles.modalBullet}>
                • <span style={styles.boldText}>Báo trước &gt; 24h:</span> Hoàn toàn miễn phí, không ảnh hưởng thứ tự ưu tiên nhận việc
                (ELO 100%).
              </div>
              <div style={styles.modalBullet}>
                • <span style={styles.boldText}>Trùng lịch đơn đã nhận:</span> Bạn phải chủ động liên hệ Phụ huynh hoặc dùng nút Đổi lịch
                trong chi tiết đơn trước khi khai bận.
              </div>
              <div style={styles.modalBullet}>
                • <span style={styles.boldText}>Hạn mức tối đa:</span> Mỗi CarePartner được khai tối đa 30 ngày bận trong tương lai để đảm
                bảo tính sẵn sàng.
              </div>
            </div>
            <Touchable style={styles.modalCloseBtn} onPress={() => setRulesModalVisible(false)}>
              <span style={styles.modalCloseBtnText}>Đã hiểu quy định</span>
            </Touchable>
          </div>
        </div>
      )}
    </Screen>
  );
};

export default BlackoutScreen;
