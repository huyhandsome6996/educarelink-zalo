/**
 * AppealScreen — port CHÍNH XÁC mobile/src/screens/Worker/AppealScreen.js (142 dòng).
 * Step 7.6: kháng cáo phạt trong 7 ngày — note >= 20 ký tự; tối đa 3 đơn / 30 ngày
 * (thứ 4 auto-reject). Kết quả: approved (đảo ELO, giữ đền bù PH) / partially / rejected.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - RN màn này KHÔNG có header trong screen (headerShown:false, back bằng
 *    gesture/hardware). Web không có gesture-back → thêm AppBar "Kháng cáo"
 *    (stub cũ + menu RN dùng tên này) với nút back nav.goBack.
 *  - useFocusEffect (loadExisting mỗi focus) → useEffect theo mount + bookingId
 *    (mount == focus vì router chỉ render top-of-stack).
 *  - Alert.alert 1 nút → showAlert() (window.alert).
 *  - RN zalo api/matching.ts CANCEL_REASONS lệch danh sách RN gốc → dùng bản
 *    copy NGUYÊN mobile/src/api/matching.js (8 lý do + cờ forceMajeure) như
 *    MyJobsScreen đã làm, không sửa file chung.
 *  - Icon: mọi glyph RN dùng đều có sẵn (information-circle, checkmark-circle).
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable, AppBar } from "@/components/ui";
import { COLORS, SHADOWS, TYPO } from "@/theme";
import { useNav } from "@/navigation/router";
import { createAppeal, getAppeal } from "@/api/matching";

/** CANCEL_REASONS — copy NGUYÊN mobile/src/api/matching.js (8 lý do + forceMajeure) */
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

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: { flex: 1, minHeight: "100dvh", background: COLORS.background },
  statusCard: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    boxShadow: SHADOWS.small,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginTop: 6,
    fontFamily: TYPO.body.fontFamily,
  },
  statusText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: 600,
    marginTop: 2,
    fontFamily: TYPO.body.fontFamily,
  },
  statusNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    fontFamily: TYPO.body.fontFamily,
  },
  helper: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: "18px",
    background: "#FFF7ED",
    borderRadius: 12,
    padding: 12,
    fontFamily: TYPO.body.fontFamily,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: TYPO.body.fontFamily,
  },
  reasonRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#FFFFFF",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 8,
    boxShadow: SHADOWS.small,
  },
  reasonActive: { background: COLORS.primaryLight },
  reasonText: { fontSize: 14, color: COLORS.textPrimary, fontFamily: TYPO.body.fontFamily },
  noteInput: {
    background: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    minHeight: 110,
    fontSize: 14,
    color: COLORS.textPrimary,
    boxShadow: SHADOWS.small,
    border: "none",
    outline: "none",
    resize: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: TYPO.body.fontFamily,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    fontFamily: TYPO.body.fontFamily,
  },
  submitBtn: {
    background: COLORS.primary,
    borderRadius: 14,
    padding: "16px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitText: { color: "#FFFFFF", fontWeight: 700, fontSize: 16 },
};

const AppealScreen: React.FC<{ bookingId?: string }> = ({ bookingId }) => {
  const nav = useNav();
  const [reasonCode, setReasonCode] = useState("personal");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<any>(null);

  const loadExisting = useCallback(async () => {
    if (!bookingId) return;
    try {
      const data: any = await getAppeal(bookingId);
      setExisting(data);
    } catch {
      /* chưa có đơn kháng cáo */
    }
  }, [bookingId]);

  // RN useFocusEffect: loadExisting mỗi lần focus. Web: mount == focus.
  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const submit = async () => {
    if (note.trim().length < 20)
      return showAlert("Thiếu thông tin", "Vui lòng mô tả lý do ít nhất 20 ký tự.");
    setSubmitting(true);
    try {
      const data: any = await createAppeal(bookingId as string, {
        reason_code: reasonCode,
        note: note.trim(),
        evidence: [],
      });
      if (data.status === "rejected") {
        showAlert(
          "Không thể kháng cáo",
          data.status_label_vi === "Đã từ chối" && data.status === "rejected"
            ? "Bạn đã vượt giới hạn 3 kháng cáo trong 30 ngày."
            : "Kháng cáo bị từ chối."
        );
      } else {
        showAlert(
          "Đã gửi kháng cáo",
          "Quản trị viên sẽ xem xét trong thời gian sớm nhất. Kết quả sẽ được thông báo cho bạn."
        );
        nav.goBack();
      }
    } catch (err: any) {
      showAlert("Lỗi", err?.response?.data?.detail ?? "Không gửi được kháng cáo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      <AppBar title="Kháng cáo" onBack={nav.goBack} />

      {/* RN contentContainerStyle={{ padding: SIZES.padding (undefined → 0), paddingBottom: 40 }} */}
      <div style={{ padding: "0 0 40px", overflowY: "auto" }}>
        {existing && (
          <div style={S.statusCard}>
            <Icon name="information-circle" size={22} color={COLORS.primary} />
            <div style={S.statusTitle}>Kháng cáo gần nhất</div>
            <div style={S.statusText}>{existing.status_label_vi}</div>
            {!!existing.admin_note && (
              <div style={S.statusNote}>Ghi chú admin: {existing.admin_note}</div>
            )}
          </div>
        )}

        <div style={S.helper}>
          Nếu bạn cho rằng phạt là không công bằng, hãy kháng cáo trong 7 ngày. Nếu được chấp nhận,
          điểm tin nhiệm sẽ được hoàn trả (phần đền bù cho phụ huynh vẫn được giữ). Tối đa 3 kháng
          cáo mỗi 30 ngày.
        </div>

        <div style={S.label}>Lý do kháng cáo</div>
        {CANCEL_REASONS.map((r) => (
          <Touchable
            key={r.code}
            style={{ ...S.reasonRow, ...(reasonCode === r.code ? S.reasonActive : {}) }}
            onPress={() => setReasonCode(r.code)}
          >
            <div style={S.reasonText}>{r.label}</div>
            {reasonCode === r.code && (
              <Icon name="checkmark-circle" size={20} color={COLORS.primary} />
            )}
          </Touchable>
        ))}

        <div style={S.label}>Mô tả chi tiết * (tối thiểu 20 ký tự)</div>
        <textarea
          className="edc-appeal-note"
          style={S.noteInput}
          placeholder="Kể lại tình huống cụ thể để admin xem xét..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />
        <style>{`.edc-appeal-note::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>
        <div style={S.charCount}>{note.trim().length}/20 ký tự tối thiểu</div>

        <Touchable
          style={{ ...S.submitBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <Spinner size={22} color={"#FFFFFF"} />
          ) : (
            <div style={S.submitText}>Gửi kháng cáo</div>
          )}
        </Touchable>
      </div>
    </div>
  );
};

export default AppealScreen;
