/**
 * WorkerProfileScreen — port CHÍNH XÁC mobile/src/screens/Worker/WorkerProfileScreen.js (777 dòng).
 * Tab "Tài khoản" CarePartner: header cam (vòng tròn decor + avatar ring/glow + badge xác thực),
 * AI summary card, thông tin cá nhân, bằng cấp, menu actions, mục "⚡ Ghép cặp thông minh",
 * mã PIN cá nhân (VerificationPinSetupModal port inline), consent GPS, logout.
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - RN dùng expo-image-picker → web dùng <input type="file" accept="image/*"> ẩn (không cần quyền).
 *  - RN Alert.alert nhiều nút (logout) → NHÁNH Platform.OS === 'web' của RN dùng sẵn window.confirm → giữ nguyên.
 *  - RN Switch (native) → toggle CSS tự dựng (track/thumb + transition).
 *  - VerificationPinSetupModal là file riêng ở RN — không thuộc danh sách file được giao nên port THÀNH
 *    component nội bộ trong file này (giữ nguyên UI/logic từng dòng).
 *  - RN StyleSheet duplicate key `sectionTitle` → JS last-wins: bản hiệu lực KHÔNG có padding
 *    (fontSize 13 / 800 / uppercase / marginBottom 4) — port đúng bản hiệu lực đó.
 *  - NotificationBell RN 42×42 nền trắng 15% → dùng NotificationBell của ui.tsx (38×38 nền trắng 20%).
 *  - Icon thiếu trong bộ glyph zalo → alias cục bộ (documents-outline, ban-outline, shield-outline,
 *    cloud-upload-outline, ribbon-outline).
 *  - updateMatchingGpsConsent (RN AuthContext) không có trong AuthContext zalo → nội suy tại chỗ:
 *    setMatchingGpsConsent + ghi key 'gps_no_consent_until' (backoff 24h) như RN.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { NotificationBell, Screen, Spinner, StatusBarSpacer, Touchable, showAlert } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, TYPO, typo } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { updateCertificate } from "@/api/auth";
import { submitCredential, requestProfileChange } from "@/api/tasks";
import { setVerificationPin, getMatchingGpsConsent, setMatchingGpsConsent } from "@/api/tracking";
import storage from "@/utils/storage";
import { useNav } from "@/navigation/router";

const GPS_NO_CONSENT_BACKOFF_MS = 24 * 60 * 60 * 1000; // 24h — như RN AuthContext

/* Icon alias — glyph thiếu trong ionicons.ts zalo (chỉ thêm tại đây, không sửa file chung) */
const ICON_ALIAS: Record<string, string> = {
  "documents-outline": "document-text-outline",
  "ban-outline": "ban",
  "shield-outline": "shield",
  "cloud-upload-outline": "images-outline",
  "ribbon-outline": "medal",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/* Switch native RN → toggle web (trackColor false #CBD5E1 / true COLORS.primary, thumb #fff) */
const Switch: React.FC<{ value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }> = ({
  value,
  onValueChange,
  disabled,
}) => (
  <Touchable
    onPress={() => !disabled && onValueChange(!value)}
    disabled={disabled}
    style={{
      width: 51,
      height: 31,
      borderRadius: 15.5,
      background: value ? COLORS.primary : "#CBD5E1",
      padding: 2,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: value ? "flex-end" : "flex-start",
      transition: "background 0.2s",
      opacity: disabled ? 0.5 : 1,
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

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: COLORS.background },
  // === HEADER === (paddingTop: insets.top + 12 — StatusBarSpacer + 12px)
  header: {
    alignItems: "center",
    paddingBottom: 32,
    background: COLORS.primary,
    gap: 6,
    borderBottomLeftRadius: SIZES.radiusXl,
    borderBottomRightRadius: SIZES.radiusXl,
    overflow: "hidden",
    position: "relative",
  },
  headerTopRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 16px 16px",
    width: "100%",
  },
  headerTitle: { ...typo("h5", { color: COLORS.textOnPrimary }) },
  headerDeco1: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    background: "rgba(255,255,255,0.08)",
  },
  headerDeco2: {
    position: "absolute",
    bottom: -20,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    background: "rgba(255,255,255,0.06)",
  },
  headerDeco3: {
    position: "absolute",
    top: 30,
    right: 90,
    width: 50,
    height: 50,
    borderRadius: 25,
    background: "rgba(255,255,255,0.05)",
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    border: "3px solid rgba(255,255,255,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  avatarGlow: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 54,
    background: "rgba(255,255,255,0.12)",
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    background: "rgba(255,255,255,0.25)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { ...typo("h1", { color: COLORS.textOnPrimary, fontSize: 34, lineHeight: "40px" }) },
  name: { ...typo("h2", { color: COLORS.textOnPrimary }) },
  username: { ...typo("bodySmall", { color: "rgba(255,255,255,0.7)" }) },
  verifiedBadge: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    background: "rgba(255,255,255,0.2)",
    borderRadius: SIZES.radiusXl,
    padding: "6px 14px",
    marginTop: 4,
    border: "1px solid rgba(255,255,255,0.25)",
  },
  unverifiedBadge: {
    background: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.3)",
  },
  verifiedText: { ...typo("caption", { color: COLORS.textOnPrimary }) },
  // === AI ===
  aiCard: {
    margin: 16,
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: `1px solid ${COLORS.primarySoft}`,
    boxShadow: SHADOWS.small,
    borderLeft: `3px solid ${COLORS.primary}`,
  },
  aiHeader: { display: "flex", flexDirection: "row", gap: 10, alignItems: "center" },
  aiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.surface,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  aiTitle: { ...typo("h5", { color: COLORS.primary }) },
  aiText: { ...typo("body", { color: COLORS.textSecondary }) },
  // === SECTIONS ===
  section: {
    margin: "0 16px 12px",
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    overflow: "hidden",
    boxShadow: SHADOWS.cardHover,
  },
  // RN: sectionTitle bị khai báo 2 lần trong StyleSheet — JS last-wins → bản hiệu lực
  // (cuối) KHÔNG có padding: {fontSize 13, 800, uppercase, marginBottom 4}. Port đúng bản hiệu lực.
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: COLORS.textMuted || "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoList: { padding: "0 16px 8px" },
  infoItem: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    padding: "12px 0",
    borderBottom: `1px solid ${COLORS.border}`,
    alignItems: "center",
  },
  infoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  infoText: { flex: 1, minWidth: 0 },
  infoLabel: { ...typo("overline", { color: COLORS.textMuted, marginBottom: 2 }) },
  infoValue: { ...typo("h5", { color: COLORS.textPrimary, fontWeight: 600, overflowWrap: "anywhere" }) },
  actionRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  actionText: { flex: 1, ...typo("bodyLarge", { color: COLORS.textPrimary }) },
  consentRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "12px 0",
  },
  // RN: color: COLORS.text || '#0F172A' — colors.js không có token 'text' → hiệu lực '#0F172A'
  consentTitle: { fontSize: 14, fontWeight: 700, color: "#0F172A" },
  consentDesc: { marginTop: 4, fontSize: 12, color: COLORS.textSecondary || "#64748B", lineHeight: "17px" },
  logoutRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    background: `${COLORS.errorBg}40`,
    borderRadius: SIZES.radiusMd,
    margin: SIZES.xs,
    boxShadow: SHADOWS.small,
  },
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
    maxHeight: "90%",
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
  modalInput: {
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    border: `1.5px solid ${COLORS.border}`,
    padding: "10px 14px",
    ...typo("body", { color: COLORS.textPrimary }),
    outline: "none",
    width: "100%",
  },
  modalTextarea: {
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    border: `1.5px solid ${COLORS.border}`,
    padding: "10px 14px",
    ...typo("body", { color: COLORS.textPrimary }),
    minHeight: 80,
    outline: "none",
    width: "100%",
    resize: "vertical",
  },
  uploadBtn: {
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusMd,
    padding: 24,
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    gap: 8,
    border: `1.5px dashed ${COLORS.primarySoft}`,
  },
  uploadBtnText: { ...typo("bodySmall", { color: COLORS.primary, fontWeight: 600 }) },
  credImagePreview: {
    width: "100%",
    height: 180,
    borderRadius: SIZES.radiusMd,
    background: COLORS.background,
    objectFit: "cover",
    display: "block",
  },
  changePhotoText: { ...typo("caption", { color: COLORS.primary, textAlign: "center", marginTop: 6, fontWeight: 500 }) },
  infoBox: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusSm,
    padding: 10,
    marginTop: 12,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  infoBoxText: { flex: 1, ...typo("caption", { color: COLORS.primaryDark, lineHeight: "18px", fontWeight: 500 }) },
  modalSubmitBtn: {
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
  modalSubmitText: { ...typo("button", { color: COLORS.textOnPrimary, fontSize: 15 }) },
};

/* ================= VerificationPinSetupModal — port nguyên bản component RN ================= */
const VerificationPinSetupModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isChange?: boolean;
}> = ({ visible, onClose, onSuccess, isChange = false }) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setPin("");
    setConfirmPin("");
    setCurrentPassword("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    // Validate client-side
    if (!/^\d{4,6}$/.test(pin)) {
      showAlert("Lỗi", "Mã cá nhân phải là 4-6 chữ số.");
      return;
    }
    if (pin !== confirmPin) {
      showAlert("Lỗi", "Mã xác nhận không khớp.");
      return;
    }
    if (!currentPassword) {
      showAlert("Lỗi", "Vui lòng nhập mật khẩu tài khoản để xác nhận.");
      return;
    }

    setSubmitting(true);
    try {
      await setVerificationPin({ pin, current_password: currentPassword });
      showAlert("✅ Thành công", isChange ? "Đã đổi mã cá nhân." : "Đã đặt mã cá nhân.");
      resetForm();
      onSuccess();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Không thể đặt mã. Vui lòng thử lại.";
      showAlert("Lỗi", msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: COLORS.background || "#F7F7F7", overflowY: "auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 50,
          padding: "50px 16px 12px",
          background: "#fff",
          borderBottom: "1px solid #F0F0F0",
        }}
      >
        <Touchable onPress={handleClose} hitSlop={8} style={{ width: 40, height: 40, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Icon name="close" size={28} color={COLORS.textPrimary} />
        </Touchable>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary || "#1A1A2E" }}>
          {isChange ? "🔐 Đổi mã cá nhân" : "🔐 Đặt mã cá nhân"}
        </div>
        <div style={{ width: 40, height: 40 }} />
      </div>

      {/* Body */}
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 14, color: COLORS.textSecondary || "#6B7280", lineHeight: "20px", marginBottom: 20 }}>
          {isChange
            ? "Đặt mã cá nhân mới. Mã này sẽ được hệ thống dùng để xác minh ngẫu nhiên trong ca làm, đảm bảo bạn vẫn đang cầm máy."
            : "Hệ thống sẽ thỉnh thoảng yêu cầu bạn nhập mã này trong ca làm để xác nhận bạn vẫn đang cầm máy (chống để máy lại rồi bỏ đi). Hãy chọn mã dễ nhớ nhưng khó đoán."}
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary || "#1A1A2E", marginBottom: 6, marginTop: 12 }}>
          Mã cá nhân (4-6 chữ số)
        </div>
        <input
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 16,
            color: COLORS.textPrimary || "#1A1A2E",
            outline: "none",
            width: "100%",
          }}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="VD: 1234"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoFocus
        />

        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary || "#1A1A2E", marginBottom: 6, marginTop: 12 }}>
          Nhập lại mã
        </div>
        <input
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 16,
            color: COLORS.textPrimary || "#1A1A2E",
            outline: "none",
            width: "100%",
          }}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="Nhập lại mã"
          type="password"
          inputMode="numeric"
          maxLength={6}
        />

        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary || "#1A1A2E", marginBottom: 6, marginTop: 12 }}>
          Mật khẩu tài khoản (xác nhận)
        </div>
        <input
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 16,
            color: COLORS.textPrimary || "#1A1A2E",
            outline: "none",
            width: "100%",
          }}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Nhập mật khẩu tài khoản"
          type="password"
        />
        <div style={{ fontSize: 12, color: COLORS.textMuted || "#9CA3AF", marginTop: 8, lineHeight: "16px" }}>
          ⚠️ Vì lý do bảo mật, phải nhập mật khẩu tài khoản để đổi PIN — tránh ai cầm máy đổi PIN tuỳ tiện.
        </div>

        <Touchable
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            background: COLORS.primary || "#F26522",
            borderRadius: 12,
            padding: "16px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 24,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <Spinner size={22} color="#fff" />
          ) : (
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{isChange ? "Đổi mã" : "Đặt mã"}</span>
          )}
        </Touchable>
      </div>
    </div>
  );
};

/* ================= Screen chính ================= */
const WorkerProfileScreen: React.FC = () => {
  const nav = useNav();
  const { user, logout, refreshUser } = useAuth();
  // Task E (2026-09-14): consent GPS CHO GHÉP CẶP — toggle riêng, không
  // liên quan LocationConsent per-task của live-tracking trong ca.
  const [gpsConsent, setGpsConsent] = useState(false);
  const [gpsConsentBusy, setGpsConsentBusy] = useState(false);

  const loadGpsConsent = useCallback(async () => {
    try {
      const resp: any = await getMatchingGpsConsent();
      setGpsConsent(!!resp?.matching_gps_consent);
    } catch (e) {
      /* chưa login / mạng lỗi — giữ mặc định */
    }
  }, []);

  useEffect(() => {
    loadGpsConsent();
  }, [loadGpsConsent]);

  // Nội suy updateMatchingGpsConsent của RN AuthContext (set API + backoff storage)
  const handleGpsConsentChange = async (granted: boolean) => {
    setGpsConsentBusy(true);
    try {
      await setMatchingGpsConsent(granted);
      await storage.setItem("gps_no_consent_until", granted ? "0" : String(Date.now() + GPS_NO_CONSENT_BACKOFF_MS));
      setGpsConsent(granted);
      showAlert(
        granted ? "Đã bật" : "Đã tắt",
        granted
          ? "Hệ thống sẽ dùng vị trí hiện tại để gợi ý việc gần bạn."
          : "Hệ thống dùng địa chỉ hồ sơ để tính khoảng cách gợi ý việc."
      );
    } catch (e) {
      showAlert("Lỗi", "Không đổi được cài đặt. Thử lại sau.");
    } finally {
      setGpsConsentBusy(false);
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  // Modal states cho Submit Credential
  const [credModalVisible, setCredModalVisible] = useState(false);
  const [credPhoto, setCredPhoto] = useState<File | null>(null);
  const [credPhotoUrl, setCredPhotoUrl] = useState<string>("");
  const [credDesc, setCredDesc] = useState("");
  const [credSubmitting, setCredSubmitting] = useState(false);

  // Modal states cho Profile Change Request
  // Fix H13: useState initializer chỉ chạy 1 lần — nếu user null khi mount
  // thì changeForm sẽ init với empty strings. Khi user load xong, changeForm
  // vẫn giữ empty. Dùng useEffect để sync changeForm khi user thay đổi.
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [changeForm, setChangeForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone_number: user?.phone_number || "",
    email: user?.email || "",
    address: user?.address || "",
  });
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  // === Phần 3 — Modal đặt/đổi mã PIN cá nhân ===
  const [pinModalVisible, setPinModalVisible] = useState(false);

  // Sync changeForm khi user thay đổi (vd: user load xong sau khi mount).
  useEffect(() => {
    if (user) {
      setChangeForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone_number: user.phone_number || "",
        email: user.email || "",
        address: user.address || "",
      });
    }
  }, [user]);

  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.username || "Sinh viên";

  const MENU_ITEMS: Array<{ icon: string; label: string; color: string; action?: string }> = [
    { icon: "star-outline", label: "Xem đánh giá từ phụ huynh", color: COLORS.primary, action: "view_reviews" },
    { icon: "wallet-outline", label: "Thu nhập của tôi", color: COLORS.success, action: "view_earnings" },
    // QA-FIX-GAP-4: Entry point vào WorkerScreeningStatus (Nhóm B)
    { icon: "shield-checkmark-outline", label: "Trạng thái thẩm định hồ sơ", color: COLORS.primary, action: "view_screening_status" },
    { icon: "ribbon-outline", label: "Gửi bằng cấp mới", color: COLORS.primary, action: "submit_credential" },
    { icon: "documents-outline", label: "Khiếu nại của tôi", color: COLORS.error, action: "view_my_complaints" },
    { icon: "create-outline", label: "Yêu cầu sửa hồ sơ", color: COLORS.primary, action: "request_change" },
    { icon: "document-text-outline", label: "Lịch sử yêu cầu đổi hồ sơ", color: COLORS.info, action: "view_change_history" },
    { icon: "help-circle-outline", label: "Trung tâm hỗ trợ", color: COLORS.info, action: "help_center" },
    { icon: "card-outline", label: "Xác thực thẻ sinh viên / bằng cấp", color: COLORS.primary, action: "upload_cert" },
    { icon: "shield-checkmark-outline", label: "Chính sách bảo mật", color: COLORS.primary },
  ];

  // Flow 1 — menu ghép cặp mới (song song luồng cũ)
  const MATCHING_MENU_ITEMS: Array<{ icon: string; label: string; color: string; action?: string }> = [
    { icon: "time-outline", label: "Lịch rảnh (ghép cặp)", color: COLORS.primary, action: "matching_availability" },
    { icon: "ban-outline", label: "Ngày bận đột xuất", color: COLORS.error, action: "blackout" },
    { icon: "briefcase-outline", label: "Đơn của tôi (ghép cặp)", color: COLORS.success, action: "my_bookings" },
    { icon: "megaphone-outline", label: "Kháng cáo", color: COLORS.info, action: "appeal" },
  ];

  /* File input ẩn thay expo-image-picker (web) */
  const credFileRef = useRef<HTMLInputElement | null>(null);
  const certFileRef = useRef<HTMLInputElement | null>(null);

  const pickCredPhoto = () => {
    credFileRef.current?.click();
  };

  const handleCredFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (credPhotoUrl) URL.revokeObjectURL(credPhotoUrl);
      setCredPhoto(f);
      setCredPhotoUrl(URL.createObjectURL(f));
    }
    e.target.value = "";
  };

  const handleSubmitCredential = async () => {
    if (!credPhoto) {
      showAlert("Thiếu ảnh", "Vui lòng chọn ảnh bằng cấp.");
      return;
    }
    setCredSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("certificate_photo", credPhoto, "credential.jpg");
      if (credDesc.trim()) formData.append("description", credDesc.trim());

      await submitCredential(formData);
      showAlert("✅ Thành công", "Đã gửi bằng cấp. Admin sẽ xem xét sớm!");
      setCredModalVisible(false);
      setCredPhoto(null);
      setCredPhotoUrl("");
      setCredDesc("");
    } catch (e: any) {
      const msg = e.response?.data?.error || "Gửi thất bại.";
      showAlert("Lỗi", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setCredSubmitting(false);
    }
  };

  const handleRequestChange = async () => {
    setChangeSubmitting(true);
    try {
      const changes: Record<string, string> = {};
      (Object.keys(changeForm) as Array<keyof typeof changeForm>).forEach((key) => {
        const newVal = (changeForm[key] || "").trim();
        const oldVal = (user?.[key] || "").trim();
        if (newVal && newVal !== oldVal) changes[key] = newVal;
      });
      if (Object.keys(changes).length === 0) {
        showAlert("Không có thay đổi", "Bạn chưa sửa thông tin nào.");
        setChangeSubmitting(false);
        return;
      }
      await requestProfileChange(changes);
      showAlert("✅ Đã gửi", "Yêu cầu thay đổi hồ sơ đã gửi. Admin sẽ duyệt trong 1-2 ngày.");
      setChangeModalVisible(false);
    } catch (e: any) {
      const msg = e.response?.data?.error || "Gửi yêu cầu thất bại.";
      showAlert("Lỗi", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleMenuPress = async (action: string) => {
    if (action === "view_reviews") {
      nav.navigate("CandidateProfile", { workerId: user?.id, isPending: false });
    } else if (action === "view_earnings") {
      nav.navigate("MyEarnings");
    } else if (action === "view_screening_status") {
      // QA-FIX-GAP-4: Entry point vào WorkerScreeningStatus (Nhóm B)
      nav.navigate("WorkerScreeningStatus");
    } else if (action === "view_availability") {
      nav.navigate("WorkerAvailability");
    } else if (action === "matching_availability") {
      // Flow 1 — lịch rảnh cho ghép cặp mới
      nav.navigate("MatchingAvailability");
    } else if (action === "blackout") {
      // Flow 1 — ngày bận đột xuất (blackout)
      nav.navigate("Blackout");
    } else if (action === "my_bookings") {
      // Flow 1 — đơn ghép cặp của CarePartner
      nav.navigate("MyBookings");
    } else if (action === "appeal") {
      // Flow 1 — kháng cáo (cần bookingId — mở danh sách đơn để chọn)
      nav.navigate("MyBookings");
    } else if (action === "view_my_complaints") {
      nav.navigate("MyComplaints");
    } else if (action === "help_center") {
      nav.navigate("HelpCenter");
    } else if (action === "submit_credential") {
      setCredModalVisible(true);
    } else if (action === "request_change") {
      setChangeForm({
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        phone_number: user?.phone_number || "",
        email: user?.email || "",
        address: user?.address || "",
      });
      setChangeModalVisible(true);
    } else if (action === "view_change_history") {
      // WIRING FIX (2026-08-21): Entry point vào ProfileChangeRequestsScreen
      nav.navigate("ProfileChangeRequests");
    } else if (action === "upload_cert") {
      // Web: không cần xin quyền thư viện — mở trực tiếp file picker
      certFileRef.current?.click();
    }
  };

  const handleCertFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setIsUploading(true);
    try {
      await updateCertificate(f);
      showAlert("Thành công", "Đã tải lên minh chứng thành công. Admin sẽ xem xét sớm nhất!");
    } catch (error: any) {
      console.error("Upload error:", error?.response?.data || error);
      showAlert("Lỗi", "Không thể tải lên. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Screen bg={COLORS.background} scroll={true}>
      <input ref={certFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCertFileChosen} />
      <input ref={credFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCredFileChosen} />

      {/* Header cam */}
      <div style={{ ...styles.header, paddingTop: 12 }}>
        <StatusBarSpacer />
        <div style={styles.headerTopRow}>
          <div style={{ width: 40 }} />
          <div style={styles.headerTitle}>Hồ sơ</div>
          <NotificationBell />
        </div>
        {/* Decorative circles */}
        <div style={styles.headerDeco1} />
        <div style={styles.headerDeco2} />
        <div style={styles.headerDeco3} />
        <div style={styles.avatarRing}>
          <div style={styles.avatarGlow} />
          <div style={styles.avatar}>
            <div style={styles.avatarText}>{displayName?.[0]?.toUpperCase()}</div>
          </div>
        </div>
        <div style={styles.name}>{displayName}</div>
        <div style={styles.username}>@{user?.username}</div>
        {/* Verified badge */}
        {user?.is_verified ? (
          <div style={styles.verifiedBadge}>
            <Icon name="shield-checkmark" size={14} color="#fff" />
            <div style={styles.verifiedText}>Đã xác thực</div>
          </div>
        ) : (
          <div style={{ ...styles.verifiedBadge, ...styles.unverifiedBadge }}>
            <Icon name={ic("shield-outline")} size={14} color={COLORS.warning} />
            <div style={{ ...styles.verifiedText, color: COLORS.warning }}>Chưa xác thực</div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {user?.ai_profile_summary && (
        <div style={styles.aiCard}>
          <div style={styles.aiHeader}>
            <div style={styles.aiIconCircle}>
              <Icon name="sparkles" size={20} color={COLORS.primary} />
            </div>
            <div style={styles.aiTitle}>Nhận xét từ AI</div>
          </div>
          <div style={styles.aiText}>{user.ai_profile_summary}</div>
        </div>
      )}

      {/* Thông tin */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Thông tin cá nhân</div>
        <div style={styles.infoList}>
          {[
            { icon: "mail-outline", label: "Email", value: user?.email || "Chưa cập nhật", color: COLORS.primary },
            { icon: "call-outline", label: "Số điện thoại", value: user?.phone_number || "Chưa cập nhật", color: COLORS.primary },
            { icon: "location-outline", label: "Địa chỉ", value: user?.address || "Chưa cập nhật", color: COLORS.primary },
          ].map((item) => (
            <div key={item.label} style={styles.infoItem}>
              <div style={{ ...styles.infoIconCircle, background: `${item.color}15` }}>
                <Icon name={item.icon} size={18} color={item.color} />
              </div>
              <div style={styles.infoText}>
                <div style={styles.infoLabel}>{item.label}</div>
                <div style={styles.infoValue}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bằng cấp & Chứng chỉ */}
      {user?.qualifications && user.qualifications.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Bằng cấp & Chứng chỉ</div>
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {user.qualifications.map((q: string, idx: number) => (
              <div key={idx} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name={ic("ribbon-outline")} size={18} color={COLORS.primary} />
                <div style={{ ...typo("body", { color: COLORS.textPrimary }) }}>{q}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Menu Actions */}
      <div style={styles.section}>
        {MENU_ITEMS.map((item, index) => (
          <Touchable
            key={item.label}
            style={{ ...styles.actionRow, ...(index === MENU_ITEMS.length - 1 ? { borderBottomWidth: 0 } : {}) }}
            onPress={() => item.action && handleMenuPress(item.action)}
            activeOpacity={0.7}
          >
            <div style={{ ...styles.actionIconCircle, background: `${item.color}15` }}>
              {isUploading && item.action === "upload_cert" ? (
                <Spinner size={18} color={item.color} />
              ) : (
                <Icon name={ic(item.icon)} size={20} color={item.color} />
              )}
            </div>
            <div style={styles.actionText}>{item.label}</div>
            <Icon name="chevron-forward" size={16} color={COLORS.textMuted} />
          </Touchable>
        ))}
      </div>

      {/* Flow 1 — Ghép cặp & Đơn (luồng mới) */}
      <div style={styles.section}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: COLORS.primary,
            textTransform: "uppercase",
            padding: "14px 16px 4px",
            letterSpacing: "0.5px",
          }}
        >
          ⚡ Ghép cặp thông minh (Flow 1 mới)
        </div>
        {MATCHING_MENU_ITEMS.map((item, index) => (
          <Touchable
            key={item.label}
            style={{ ...styles.actionRow, ...(index === MATCHING_MENU_ITEMS.length - 1 ? { borderBottomWidth: 0 } : {}) }}
            onPress={() => item.action && handleMenuPress(item.action)}
            activeOpacity={0.7}
          >
            <div style={{ ...styles.actionIconCircle, background: `${item.color}15` }}>
              <Icon name={ic(item.icon)} size={20} color={item.color} />
            </div>
            <div style={styles.actionText}>{item.label}</div>
            <Icon name="chevron-forward" size={16} color={COLORS.textMuted} />
          </Touchable>
        ))}
      </div>

      {/* === Phần 3 — Mã cá nhân (PIN) cho xác minh ngẫu nhiên === */}
      <div style={styles.section}>
        <Touchable style={styles.actionRow} onPress={() => setPinModalVisible(true)} activeOpacity={0.7}>
          <div style={{ ...styles.actionIconCircle, background: `${COLORS.primary || "#F26522"}15` }}>
            <Icon name="key-outline" size={20} color={COLORS.primary || "#F26522"} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.actionText}>
              {user?.has_verification_pin ? "Đổi mã cá nhân" : "🔐 Đặt mã cá nhân (bắt buộc)"}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted || "#9CA3AF", marginTop: 2 }}>
              {user?.has_verification_pin
                ? "Đã đặt — hệ thống sẽ yêu cầu nhập mã ngẫu nhiên trong ca làm"
                : "⚠️ Chưa đặt mã — không thể nhận việc"}
            </div>
          </div>
          <Icon name="chevron-forward" size={16} color={COLORS.textMuted} />
        </Touchable>
      </div>

      {/* Task E (2026-09-14) — Consent GPS cho ghép cặp (tách khỏi live-tracking) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Vị trí & gợi ý việc</div>
        <div style={styles.consentRow}>
          <div style={{ flex: 1, paddingRight: 12, minWidth: 0 }}>
            <div style={styles.consentTitle}>Dùng vị trí để gợi ý việc gần bạn</div>
            <div style={styles.consentDesc}>
              Bật để hệ thống ưu tiên việc gần vị trí hiện tại của bạn. Không bật: dùng địa chỉ hồ sơ. Không ảnh hưởng theo dõi vị trí
              khi đang làm việc.
            </div>
          </div>
          <Switch value={gpsConsent} onValueChange={handleGpsConsentChange} disabled={gpsConsentBusy} />
        </div>
      </div>

      {/* Logout */}
      <div style={styles.section}>
        <Touchable
          style={styles.logoutRow}
          activeOpacity={0.7}
          onPress={() => {
            // RN: nhánh Platform.OS === 'web' — window.confirm rồi logout()
            if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
              logout();
            }
          }}
        >
          <div style={{ ...styles.actionIconCircle, background: COLORS.errorBg }}>
            <Icon name="log-out-outline" size={20} color={COLORS.error} />
          </div>
          <div style={{ ...styles.actionText, color: COLORS.error }}>Đăng xuất</div>
        </Touchable>
      </div>

      <div style={{ height: 40 }} />

      {/* === Phần 3 — Modal đặt/đổi mã PIN === */}
      <VerificationPinSetupModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        isChange={!!user?.has_verification_pin}
        onSuccess={async () => {
          // BUG FIX: Sau khi đặt/đổi PIN thành công, gọi refreshUser() để
          // cập nhật ngay user.has_verification_pin trong AuthContext — không
          // cần chờ đăng nhập lại. Trước đây onSuccess để trống → UI vẫn
          // hiển thị "Chưa đặt mã" dù PIN đã được lưu đúng ở backend.
          if (refreshUser) {
            await refreshUser();
          }
        }}
      />

      {/* Modal: Submit Credential */}
      {credModalVisible && (
        <div style={styles.modalOverlay} onClick={() => setCredModalVisible(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Gửi bằng cấp mới</div>
              <Touchable onPress={() => setCredModalVisible(false)} style={styles.modalCloseBtn} hitSlop={8}>
                <Icon name="close" size={22} color={COLORS.textSecondary} />
              </Touchable>
            </div>

            <div style={styles.modalLabel}>Ảnh bằng cấp/chứng chỉ *</div>
            {credPhoto ? (
              <Touchable onPress={pickCredPhoto} activeOpacity={0.8}>
                <img src={credPhotoUrl} alt="Bằng cấp" style={styles.credImagePreview} />
                <div style={styles.changePhotoText}>Chạm để đổi ảnh</div>
              </Touchable>
            ) : (
              <Touchable style={styles.uploadBtn} onPress={pickCredPhoto} activeOpacity={0.85}>
                <Icon name={ic("cloud-upload-outline")} size={28} color={COLORS.primary} />
                <div style={styles.uploadBtnText}>Chọn ảnh từ thư viện</div>
              </Touchable>
            )}

            <div style={styles.modalLabel}>Mô tả (tuỳ chọn)</div>
            <textarea
              style={styles.modalTextarea}
              placeholder="VD: Bằng cử nhân Sư phạm Toán, chứng chỉ IELTS 7.5..."
              value={credDesc}
              onChange={(e) => setCredDesc(e.target.value)}
              rows={3}
            />

            <Touchable
              style={{ ...styles.modalSubmitBtn, ...(credSubmitting ? { opacity: 0.7 } : {}) }}
              onPress={handleSubmitCredential}
              disabled={credSubmitting}
              activeOpacity={0.85}
            >
              {credSubmitting ? (
                <Spinner size={22} color="#fff" />
              ) : (
                <>
                  <Icon name="send" size={18} color="#fff" />
                  <div style={styles.modalSubmitText}>Gửi cho Admin duyệt</div>
                </>
              )}
            </Touchable>
          </div>
        </div>
      )}

      {/* Modal: Profile Change Request */}
      {changeModalVisible && (
        <div style={styles.modalOverlay} onClick={() => setChangeModalVisible(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Yêu cầu sửa hồ sơ</div>
              <Touchable onPress={() => setChangeModalVisible(false)} style={styles.modalCloseBtn} hitSlop={8}>
                <Icon name="close" size={22} color={COLORS.textSecondary} />
              </Touchable>
            </div>

            <div style={styles.modalLabel}>Họ</div>
            <input
              style={styles.modalInput}
              value={changeForm.last_name}
              onChange={(e) => setChangeForm({ ...changeForm, last_name: e.target.value })}
            />

            <div style={styles.modalLabel}>Tên</div>
            <input
              style={styles.modalInput}
              value={changeForm.first_name}
              onChange={(e) => setChangeForm({ ...changeForm, first_name: e.target.value })}
            />

            <div style={styles.modalLabel}>Số điện thoại</div>
            <input
              style={styles.modalInput}
              value={changeForm.phone_number}
              onChange={(e) => setChangeForm({ ...changeForm, phone_number: e.target.value })}
              inputMode="tel"
            />

            <div style={styles.modalLabel}>Email</div>
            <input
              style={styles.modalInput}
              value={changeForm.email}
              onChange={(e) => setChangeForm({ ...changeForm, email: e.target.value })}
              inputMode="email"
              autoCapitalize="none"
            />

            <div style={styles.modalLabel}>Địa chỉ</div>
            <input
              style={styles.modalInput}
              value={changeForm.address}
              onChange={(e) => setChangeForm({ ...changeForm, address: e.target.value })}
            />

            <div style={styles.infoBox}>
              <Icon name="information-circle-outline" size={14} color={COLORS.primary} />
              <div style={styles.infoBoxText}>
                Yêu cầu sẽ được Admin duyệt trong 1-2 ngày. Bạn vẫn dùng thông tin cũ cho đến khi được duyệt.
              </div>
            </div>

            <Touchable
              style={{ ...styles.modalSubmitBtn, ...(changeSubmitting ? { opacity: 0.7 } : {}) }}
              onPress={handleRequestChange}
              disabled={changeSubmitting}
              activeOpacity={0.85}
            >
              {changeSubmitting ? (
                <Spinner size={22} color="#fff" />
              ) : (
                <>
                  <Icon name="send" size={18} color="#fff" />
                  <div style={styles.modalSubmitText}>Gửi yêu cầu</div>
                </>
              )}
            </Touchable>
          </div>
        </div>
      )}
    </Screen>
  );
};

export default WorkerProfileScreen;
