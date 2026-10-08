/**
 * WorkerAvailabilityScreen — port CHÍNH XÁC mobile/src/screens/Worker/WorkerAvailabilityScreen.js (729 dòng).
 * Feature A2 (legacy): CRUD khung giờ rảnh qua /worker/availability/ (getWorkerAvailability,
 * createWorkerAvailability, updateWorkerAvailability, deleteWorkerAvailability).
 * Pattern: WorkerProfileScreen + CandidatesScreen styling — app bar trắng, info banner,
 * danh sách group theo ngày, FAB "Thêm khung giờ", modal bottom-sheet thêm/sửa.
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - API zalo trả body trực tiếp (không bọc .data như axios RN): getWorkerAvailability() → res || [].
 *  - DateTimePicker native: RN nhánh web dùng window.prompt('Nhập giờ…') → port giữ NGUYÊN nhánh
 *    web đó (nhánh native không tồn tại trên Zalo).
 *  - RN Alert.alert 2 nút (Xoá) → window.confirm gộp; alert 1 nút → showAlert().
 *  - Modal RN (slide) → overlay fixed + bottom sheet; đóng bằng nút close (không có back-gesture).
 */
import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Screen, Spinner, StatusBarSpacer, Touchable, showAlert } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, typo } from "@/theme";
import {
  getWorkerAvailability,
  createWorkerAvailability,
  updateWorkerAvailability,
  deleteWorkerAvailability,
} from "@/api/tasks";
import { useNav } from "@/navigation/router";

// Danh sách ngày trong tuần (việt nam)
const WEEKDAYS = [
  { value: 0, label: "Thứ 2", shortLabel: "T2" },
  { value: 1, label: "Thứ 3", shortLabel: "T3" },
  { value: 2, label: "Thứ 4", shortLabel: "T4" },
  { value: 3, label: "Thứ 5", shortLabel: "T5" },
  { value: 4, label: "Thứ 6", shortLabel: "T6" },
  { value: 5, label: "Thứ 7", shortLabel: "T7" },
  { value: 6, label: "Chủ nhật", shortLabel: "CN" },
];

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: COLORS.surfaceWarm },
  // === APP BAR ===
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px 12px",
    background: COLORS.surface,
  },
  appBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  appBarTitle: { ...typo("h3", { color: COLORS.onSurface }) },
  // === INFO BANNER ===
  infoBanner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: "12px 20px 0",
    padding: 12,
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusSm,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  infoBannerText: {
    flex: 1,
    ...typo("bodySmall", { color: COLORS.primaryDark, lineHeight: "18px" }),
  },
  // === CENTER CONTAINERS (loading / empty) ===
  centerContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "0 40px",
  },
  loadingText: { ...typo("bodySmall", { color: COLORS.textMuted, marginTop: 12 }) },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    boxShadow: SHADOWS.small,
  },
  emptyTitle: { ...typo("h4", { color: COLORS.onSurface, marginTop: 12 }) },
  emptyText: { ...typo("bodySmall", { color: COLORS.onSurfaceVariant, textAlign: "center", marginTop: 4 }) },
  // === SCROLL CONTENT ===
  scrollContent: { padding: "0 20px 120px", display: "flex", flexDirection: "column", gap: 8 },
  // === DAY SECTION ===
  daySection: { marginTop: 8 },
  dayLabel: { ...typo("overline", { color: COLORS.textMuted, marginBottom: 6, padding: "0 4px" }) },
  dayCard: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    border: `1px solid ${COLORS.outlineVariant}`,
    padding: 4,
    boxShadow: SHADOWS.small,
  },
  windowRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  windowTimeBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  windowTime: { ...typo("body", { color: COLORS.onSurface }) },
  windowActions: { display: "flex", flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  // === FAB ===
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: COLORS.primary,
    borderRadius: SIZES.radiusFull,
    padding: "14px 24px",
    boxShadow: SHADOWS.large,
    zIndex: 20,
  },
  fabText: { ...typo("buttonSmall", { color: COLORS.textOnPrimary }) },
  // === MODAL ===
  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "flex-end",
  },
  modalContent: {
    background: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    padding: "20px 20px 36px",
    maxHeight: "85%",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { ...typo("h4", { color: COLORS.textPrimary, fontWeight: 800 }) },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.background,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modalLabel: { ...typo("overline", { color: COLORS.textMuted, marginBottom: 6, marginTop: 12 }) },
  // === WEEKDAY CHIPS ===
  weekdayRow: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  weekdayChip: {
    padding: "8px 12px",
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
    border: `1.5px solid ${COLORS.border}`,
  },
  weekdayChipActive: {
    background: COLORS.primary,
    borderColor: COLORS.primary,
  },
  weekdayChipText: { ...typo("caption", { color: COLORS.textMuted }) },
  weekdayChipTextActive: { ...typo("caption", { color: COLORS.textOnPrimary }) },
  // === TIME PICKER BUTTON ===
  timePickerBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    border: `1.5px solid ${COLORS.border}`,
    padding: "12px 14px",
  },
  timePickerText: { flex: 1, ...typo("body", { color: COLORS.textPrimary }) },
  // === VALIDATION HINT ===
  validationHint: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    padding: 8,
    background: COLORS.errorBg,
    borderRadius: SIZES.radiusSm,
  },
  validationHintText: { ...typo("caption", { color: COLORS.error, fontWeight: 500 }) },
  // === SUBMIT BUTTON ===
  submitBtn: {
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 50,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    boxShadow: SHADOWS.large,
  },
  submitBtnText: { ...typo("button", { color: COLORS.textOnPrimary, fontSize: 15 }) },
};

const WorkerAvailabilityScreen: React.FC = () => {
  const nav = useNav();

  // === State ===
  const [windows, setWindows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedWeekday, setSelectedWeekday] = useState(0);
  // Giờ lưu dạng phút trong ngày (RN dùng Date 2026-01-01 làm carrier — minutes tương đương)
  const [startMinutes, setStartMinutes] = useState(8 * 60);
  const [endMinutes, setEndMinutes] = useState(12 * 60);

  // === Fetch ===
  const fetchWindows = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await getWorkerAvailability();
      setWindows(res || []);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.detail || "Không thể tải khung giờ.";
      showAlert("Lỗi", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWindows();
  }, [fetchWindows]);

  // === Helpers ===
  const formatTime = (timeStr: any): string => {
    if (!timeStr) return "";
    // timeStr could be "HH:MM:SS" or a Date
    if (typeof timeStr === "string") {
      const parts = timeStr.split(":");
      return `${parts[0]}:${parts[1]}`;
    }
    return String(timeStr);
  };

  const getWeekdayLabel = (weekdayNum: number) => {
    const found = WEEKDAYS.find((w) => w.value === weekdayNum);
    return found ? found.label : `Ngày ${weekdayNum}`;
  };

  const timeDisplay = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const timeToHMS = (mins: number) => `${timeDisplay(mins)}:00`;

  const promptTime = (title: string, current: number): number | null => {
    // RN nhánh web: prompt('Nhập giờ… (HH:MM)') — port giữ nguyên hành vi
    const val = window.prompt(`Nhập ${title} (HH:MM):`, timeDisplay(current));
    if (val) {
      const parts = val.split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        return h * 60 + m;
      }
    }
    return null;
  };

  // Group windows by weekday
  const grouped = WEEKDAYS.map((wd) => {
    const items = windows
      .filter((w) => w.weekday === wd.value)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    return { ...wd, items };
  }).filter((g) => g.items.length > 0);

  // === Actions ===
  const openAddModal = () => {
    setEditingId(null);
    setSelectedWeekday(0);
    setStartMinutes(8 * 60);
    setEndMinutes(12 * 60);
    setModalVisible(true);
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setSelectedWeekday(item.weekday);
    // Parse time strings (RN parse sang Date — web lưu phút trong ngày)
    const sp = (item.start_time || "08:00").split(":");
    const ep = (item.end_time || "12:00").split(":");
    setStartMinutes((parseInt(sp[0], 10) || 8) * 60 + (parseInt(sp[1], 10) || 0));
    setEndMinutes((parseInt(ep[0], 10) || 12) * 60 + (parseInt(ep[1], 10) || 0));
    setModalVisible(true);
  };

  const handleDelete = (item: any) => {
    const timeText = `${getWeekdayLabel(item.weekday)}, ${formatTime(item.start_time)} - ${formatTime(item.end_time)}`;
    // RN Alert.alert 2 nút [Huỷ / Xoá destructive] → window.confirm (web)
    if (!window.confirm(`Xoá khung giờ\n\nBạn có chắc muốn xoá: ${timeText}?`)) return;
    (async () => {
      try {
        await deleteWorkerAvailability(item.id);
        showAlert("Thành công", "Đã xoá khung giờ.");
        fetchWindows();
      } catch (e: any) {
        const msg = e.response?.data?.error || e.response?.data?.detail || "Xoá thất bại.";
        showAlert("Lỗi", typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    })();
  };

  const handleSubmit = async () => {
    // Validation
    if (startMinutes >= endMinutes) {
      showAlert("Lỗi", "Giờ bắt đầu phải nhỏ hơn giờ kết thúc.");
      return;
    }

    const payload = {
      weekday: selectedWeekday,
      start_time: timeToHMS(startMinutes),
      end_time: timeToHMS(endMinutes),
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateWorkerAvailability(editingId, payload);
        showAlert("Thành công", "Đã cập nhật khung giờ.");
      } else {
        await createWorkerAvailability(payload);
        showAlert("Thành công", "Đã thêm khung giờ mới.");
      }
      setModalVisible(false);
      fetchWindows();
    } catch (e: any) {
      const detail = e.response?.data;
      let msg = "Thao tác thất bại.";
      if (detail) {
        // Could be { error: "..." } or { non_field_errors: [...] } or { field: [...] }
        if (typeof detail === "string") msg = detail;
        else if (detail.error) msg = detail.error;
        else if (detail.detail) msg = detail.detail;
        else if (detail.non_field_errors) msg = detail.non_field_errors.join(", ");
        else {
          const firstKey = Object.keys(detail)[0];
          if (firstKey && Array.isArray(detail[firstKey])) msg = detail[firstKey].join(", ");
        }
      }
      showAlert("Lỗi", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const invalidRange = startMinutes >= endMinutes;

  // === Render ===
  return (
    <Screen bg={COLORS.surfaceWarm} scroll={false}>
      {/* App Bar — RN paddingTop: insets.top + 12 → StatusBarSpacer + 12 */}
      <div style={{ background: COLORS.surface, flexShrink: 0 }}>
        <StatusBarSpacer />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px",
          }}
        >
          <Touchable onPress={() => nav.goBack()} style={styles.appBarBtn} hitSlop={12}>
            <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
          </Touchable>
          <div style={styles.appBarTitle}>Khung giờ rảnh</div>
          <div style={{ width: 44 }} />
        </div>
      </div>

      {/* Info banner */}
      <div style={styles.infoBanner}>
        <Icon name="information-circle-outline" size={16} color={COLORS.primary} />
        <div style={styles.infoBannerText}>Thêm khung giờ rảnh để EduCareLink đề xuất việc phù hợp cho bạn.</div>
      </div>

      {isLoading ? (
        <div style={styles.centerContainer}>
          <Spinner size={34} color={COLORS.primary} />
          <div style={styles.loadingText}>Đang tải khung giờ...</div>
        </div>
      ) : windows.length === 0 ? (
        <div style={styles.centerContainer}>
          <div style={styles.emptyIconCircle}>
            <Icon name="calendar-outline" size={40} color={COLORS.primary} />
          </div>
          <div style={styles.emptyTitle}>Chưa có khung giờ</div>
          <div style={styles.emptyText}>Thêm khung giờ rảnh để nhận gợi ý việc làm phù hợp hơn.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
          <div style={styles.scrollContent}>
            {grouped.map((group) => (
              <div key={group.value} style={styles.daySection}>
                <div style={styles.dayLabel}>{group.label}</div>
                <div style={styles.dayCard}>
                  {group.items.map((item) => (
                    <div key={item.id} style={styles.windowRow}>
                      <div style={styles.windowTimeBox}>
                        <Icon name="time-outline" size={16} color={COLORS.primary} />
                        <div style={styles.windowTime}>
                          {formatTime(item.start_time)} – {formatTime(item.end_time)}
                        </div>
                      </div>
                      <div style={styles.windowActions}>
                        <Touchable
                          onPress={() => openEditModal(item)}
                          style={styles.iconBtn}
                          hitSlop={8}
                        >
                          <Icon name="pencil" size={18} color={COLORS.primary} />
                        </Touchable>
                        <Touchable
                          onPress={() => handleDelete(item)}
                          style={styles.iconBtn}
                          hitSlop={8}
                        >
                          <Icon name="trash-outline" size={18} color={COLORS.error} />
                        </Touchable>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB — Thêm khung giờ */}
      {!isLoading && (
        <Touchable style={styles.fab} onPress={openAddModal} activeOpacity={0.85}>
          <Icon name="add" size={28} color={COLORS.textOnPrimary} />
          <div style={styles.fabText}>Thêm khung giờ</div>
        </Touchable>
      )}

      {/* === Modal: Thêm / Sửa khung giờ === */}
      {modalVisible && (
        <div style={styles.modalOverlay} onClick={() => setModalVisible(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{editingId ? "Sửa khung giờ" : "Thêm khung giờ"}</div>
              <Touchable onPress={() => setModalVisible(false)} style={styles.modalCloseBtn} hitSlop={8}>
                <Icon name="close" size={22} color={COLORS.textSecondary} />
              </Touchable>
            </div>

            {/* Weekday picker (segmented control) */}
            <div style={styles.modalLabel}>Ngày trong tuần *</div>
            <div style={styles.weekdayRow}>
              {WEEKDAYS.map((wd) => (
                <Touchable
                  key={wd.value}
                  style={{ ...(styles.weekdayChip as React.CSSProperties), ...(selectedWeekday === wd.value ? styles.weekdayChipActive : {}) }}
                  onPress={() => setSelectedWeekday(wd.value)}
                >
                  <span
                    style={{
                      ...(selectedWeekday === wd.value ? styles.weekdayChipTextActive : styles.weekdayChipText),
                    }}
                  >
                    {wd.shortLabel}
                  </span>
                </Touchable>
              ))}
            </div>

            {/* Start time picker (RN web branch: window.prompt) */}
            <div style={styles.modalLabel}>Giờ bắt đầu *</div>
            <Touchable
              style={styles.timePickerBtn}
              onPress={() => {
                const v = promptTime("giờ bắt đầu", startMinutes);
                if (v !== null) setStartMinutes(v);
              }}
              activeOpacity={0.7}
            >
              <Icon name="time-outline" size={18} color={COLORS.primary} />
              <span style={styles.timePickerText}>{timeDisplay(startMinutes)}</span>
              <Icon name="chevron-down" size={16} color={COLORS.textMuted} />
            </Touchable>

            {/* End time picker (RN web branch: window.prompt) */}
            <div style={styles.modalLabel}>Giờ kết thúc *</div>
            <Touchable
              style={styles.timePickerBtn}
              onPress={() => {
                const v = promptTime("giờ kết thúc", endMinutes);
                if (v !== null) setEndMinutes(v);
              }}
              activeOpacity={0.7}
            >
              <Icon name="time-outline" size={18} color={COLORS.primary} />
              <span style={styles.timePickerText}>{timeDisplay(endMinutes)}</span>
              <Icon name="chevron-down" size={16} color={COLORS.textMuted} />
            </Touchable>

            {/* Validation hint */}
            {invalidRange ? (
              <div style={styles.validationHint}>
                <Icon name="alert-circle" size={14} color={COLORS.error} />
                <span style={styles.validationHintText}>Giờ bắt đầu phải nhỏ hơn giờ kết thúc.</span>
              </div>
            ) : null}

            {/* Submit button */}
            <Touchable
              style={{ ...styles.submitBtn, ...(isSubmitting ? { opacity: 0.7 } : {}), ...(invalidRange ? { opacity: 0.4 } : {}) }}
              onPress={handleSubmit}
              disabled={isSubmitting || invalidRange}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <Spinner size={22} color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark" size={18} color="#fff" />
                  <span style={styles.submitBtnText}>{editingId ? "Cập nhật" : "Thêm khung giờ"}</span>
                </>
              )}
            </Touchable>
          </div>
        </div>
      )}
    </Screen>
  );
};

export default WorkerAvailabilityScreen;
