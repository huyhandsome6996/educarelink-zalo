/**
 * ComplaintScreen — port CHÍNH XÁC mobile/src/screens/Worker/ComplaintScreen.js (214 dòng).
 * Modal khiếu nại (presentation:'modal' trong AppNavigator) — createComplaint
 * FormData với evidence ảnh (evidence_0, evidence_1, ...).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - expo-image-picker (Thư viện / Chụp ảnh + xin quyền) → 2 <input type="file">
 *    ẩn (accept="image/*"; nút Chụp ảnh thêm capture="environment" để mở camera
 *    trên webview di động). Quyền do browser tự quản → không có Alert "Cần quyền".
 *  - Upload: web gửi File trực tiếp (RN gửi {uri,type,name}); preview bằng
 *    URL.createObjectURL (revoke khi remove/unmount). Fix H15 (unique _id làm
 *    key thay array index) được giữ nguyên.
 *  - Alert 1 nút + goBack → showAlert() rồi nav.goBack().
 *  - Icon thiếu glyph → alias cục bộ: heart-dislike→heart-outline, bug→warning,
 *    shield-outline→shield, ellipsis-horizontal→list.
 */
import React, { useState, useRef, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SIZES, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { createComplaint } from "@/api/misc";

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  "heart-dislike": "heart-outline",
  bug: "warning",
  "shield-outline": "shield",
  "ellipsis-horizontal": "list",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

const COMPLAINT_TYPES = [
  { value: "exploitation", label: "Bóc lột sức lao động", icon: "alert-circle" },
  { value: "abuse", label: "Ngược đãi (thể chất/tinh thần)", icon: "heart-dislike" },
  { value: "harassment", label: "Quấy rối / xúc phạm", icon: "warning" },
  { value: "non_payment", label: "Không trả / trả thiếu tiền", icon: "cash-outline" },
  { value: "fraud", label: "Gian lận / lừa đảo", icon: "bug" },
  { value: "unsafe", label: "Môi trường không an toàn", icon: "shield-outline" },
  { value: "other", label: "Khác", icon: "ellipsis-horizontal" },
];

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    minHeight: "100dvh",
    background: COLORS.background,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px 16px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { ...typo("h4"), color: COLORS.textPrimary, fontWeight: 800 },
  body: { flex: 1, overflowY: "auto", padding: 16 },
  infoBox: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginBottom: 16,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  infoText: {
    flex: 1,
    ...typo("bodySmall", { lineHeight: "18px" }),
    color: COLORS.primaryDark,
  },
  label: { ...typo("overline"), color: COLORS.textMuted, marginBottom: 6, marginTop: 12 },
  input: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusSm,
    border: `1.5px solid ${COLORS.border}`,
    padding: "12px 14px",
    ...typo("body"),
    color: COLORS.textPrimary,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: { minHeight: 100, paddingTop: 14, resize: "none" },
  typeGrid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: COLORS.surface,
    borderRadius: SIZES.radiusSm,
    padding: "10px 12px",
    border: `1.5px solid ${COLORS.border}`,
  },
  typeBtnActive: { background: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { ...typo("caption", { lineHeight: "16px" }), color: COLORS.textSecondary },
  typeBtnTextActive: { color: "#fff", fontWeight: 700 },
  evidenceRow: { display: "flex", flexDirection: "row", gap: 10 },
  evidenceBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusSm,
    padding: "12px 0",
    border: `1.5px dashed ${COLORS.primarySoft}`,
  },
  evidenceBtnText: { ...typo("buttonSmall"), color: COLORS.primary },
  evidenceList: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  evidenceItem: { position: "relative" },
  evidencePreview: { width: 80, height: 80, borderRadius: SIZES.radiusSm, objectFit: "cover" },
  evidenceRemove: { position: "absolute", top: -6, right: -6 },
  footer: {
    padding: "20px 20px 36px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.border}`,
  },
  submitBtn: {
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 54,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  submitText: { color: "#fff", ...typo("button") },
};

interface EvidenceItem {
  _id: number;
  file: File;
  url: string;
}

const ComplaintScreen: React.FC<{
  reportedUserId?: string | number;
  taskTitle?: string;
  taskId?: string | number;
}> = ({ reportedUserId, taskTitle: _taskTitle, taskId }) => {
  const nav = useNav();

  const [complaintType, setComplaintType] = useState("non_payment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Fix H15: gán unique ID cho mỗi evidence item để dùng làm React key thay
  // cho array index (index sai khi item bị remove giữa danh sách).
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const evidenceIdRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);

  // Revoke objectURL khi unmount
  useEffect(() => {
    return () => {
      evidence.forEach((ev) => URL.revokeObjectURL(ev.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      // Fix H15: gán unique ID cho evidence mới
      setEvidence((prev) => [
        ...prev,
        ...files.map((file) => ({
          _id: ++evidenceIdRef.current,
          file,
          url: URL.createObjectURL(file),
        })),
      ]);
    }
    e.target.value = "";
  };

  const openLibraryPicker = () => document.getElementById("edc-complaint-library")?.click();
  const openCameraPicker = () => document.getElementById("edc-complaint-camera")?.click();

  const removeEvidence = (idx: number) => {
    setEvidence((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      showAlert("Thiếu thông tin", "Vui lòng nhập tiêu đề và mô tả.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      // RN append reportedUserId thô (undefined → "undefined" với bridge);
      // web: chuẩn hoá chuỗi để không rơi glyph lạ vào multipart.
      formData.append("reported_user_id", reportedUserId == null ? "" : String(reportedUserId));
      if (taskId) formData.append("task_id", String(taskId));
      formData.append("complaint_type", complaintType);
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      evidence.forEach((ev, idx) => {
        formData.append(`evidence_${idx}`, ev.file, `evidence_${idx}.jpg`);
      });
      await createComplaint(formData);
      showAlert("✅ Đã gửi", "Khiếu nại của bạn đã được gửi. Admin sẽ xử lý sớm.");
      nav.goBack();
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Gửi khiếu nại thất bại.";
      showAlert("Lỗi", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      <style>{`.edc-complaint-input::placeholder{color:${COLORS.textMuted};opacity:1}`}</style>

      <div style={S.header}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="close" size={22} color={COLORS.textSecondary} />
        </Touchable>
        <div style={S.headerTitle}>Gửi khiếu nại</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={S.body}>
        <div style={S.infoBox}>
          <Icon name="information-circle" size={18} color={COLORS.primary} />
          <div style={S.infoText}>
            Mô tả chi tiết sự việc. Đính kèm ảnh bằng chứng nếu có. Admin sẽ xem xét và xử lý. AI sẽ
            hỗ trợ phân tích khiếu nại của bạn 24/7.
          </div>
        </div>

        <div style={S.label}>Loại khiếu nại *</div>
        <div style={S.typeGrid}>
          {COMPLAINT_TYPES.map((t) => (
            <Touchable
              key={t.value}
              style={{ ...S.typeBtn, ...(complaintType === t.value ? S.typeBtnActive : {}) }}
              onPress={() => setComplaintType(t.value)}
              activeOpacity={0.8}
            >
              <Icon
                name={ic(t.icon)}
                size={16}
                color={complaintType === t.value ? "#fff" : COLORS.primary}
              />
              <div
                style={{
                  ...S.typeBtnText,
                  ...(complaintType === t.value ? S.typeBtnTextActive : {}),
                }}
              >
                {t.label}
              </div>
            </Touchable>
          ))}
        </div>

        <div style={S.label}>Tiêu đề *</div>
        <input
          className="edc-complaint-input"
          style={S.input}
          placeholder="VD: Phụ huynh không trả tiền sau khi xong việc"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div style={S.label}>Mô tả chi tiết *</div>
        <textarea
          className="edc-complaint-input"
          style={{ ...S.input, ...S.textarea }}
          placeholder="Mô tả sự việc, thời gian, địa điểm..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
        />

        <div style={S.label}>Bằng chứng (tuỳ chọn)</div>
        <div style={S.evidenceRow}>
          <Touchable style={S.evidenceBtn} onPress={openLibraryPicker}>
            <Icon name="images-outline" size={20} color={COLORS.primary} />
            <div style={S.evidenceBtnText}>Thư viện</div>
          </Touchable>
          <Touchable style={S.evidenceBtn} onPress={openCameraPicker}>
            <Icon name="camera-outline" size={20} color={COLORS.primary} />
            <div style={S.evidenceBtnText}>Chụp ảnh</div>
          </Touchable>
        </div>
        {/* Web image picker (thay expo-image-picker) — camera dùng capture */}
        <input
          id="edc-complaint-library"
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={onPickFiles}
        />
        <input
          id="edc-complaint-camera"
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={onPickFiles}
        />

        {evidence.length > 0 && (
          <div style={S.evidenceList}>
            {evidence.map((ev, idx) => (
              // Fix H15: dùng ev._id (unique) làm key thay vì idx (array index).
              // Array index làm key gây issue khi remove item giữa danh sách.
              <div key={ev._id} style={S.evidenceItem}>
                <img src={ev.url} style={S.evidencePreview} alt="" />
                <Touchable style={S.evidenceRemove} onPress={() => removeEvidence(idx)}>
                  <Icon name="close-circle" size={20} color={COLORS.error} />
                </Touchable>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.footer}>
        <Touchable
          style={{ ...S.submitBtn, ...(submitting ? { opacity: 0.7 } : {}) }}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <Spinner size={22} color="#fff" />
          ) : (
            <>
              <Icon name="send" size={18} color="#fff" />
              <div style={S.submitText}>Gửi khiếu nại</div>
            </>
          )}
        </Touchable>
      </div>
    </div>
  );
};

export default ComplaintScreen;
