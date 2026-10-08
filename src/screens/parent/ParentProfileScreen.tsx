/**
 * ParentProfileScreen — port CHÍNH XÁC mobile/src/screens/Parent/ParentProfileScreen.js (636 dòng).
 * Tab "Tài khoản" của Phụ huynh: app bar trắng avatar nhỏ + EduCareLink + chuông,
 * profile card avatar chữ cái 96px, badges, stats 3 cột (mock như RN), info card
 * Email/Phone/Địa chỉ + modal đổi thông tin, menu list, logout.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Animated.timing fade 250ms (ANIM.timingNormal) → CSS transition opacity + rAF.
 * - StatusBar + useSafeAreaInsets().top → <StatusBarSpacer /> + paddingTop 32.
 * - Alert.alert 1 nút → showAlert(); logout 2 nút RN-web đã là window.confirm → giữ nguyên.
 * - RN gọi requestProfileChange (POST /worker/profile-change-request/, chờ Admin duyệt);
 *   theo đặc tả task 6-e modal này ĐỔI THÔNG TIN trực tiếp qua updateProfile
 *   (PATCH /profile/ — giống web Django parent_profile.html) → sau lưu gọi
 *   refreshUser() để AuthContext cập nhật user mới. UI giữ nguyên layout RN.
 * - Icon thiếu glyph trong bộ 159 (card, help-circle) → map glyph gần nhất (ic()).
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, ANIM } from "@/theme";
import { useNav } from "@/navigation/router";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/api/auth";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      card: "card-outline",
      "help-circle": "help-circle-outline",
      "close-circle-outline": "close-circle",
      "arrow-down-circle": "download-outline",
    } as Record<string, string>
  )[name] ?? name;

// Route modal (presentation:'modal' trong AppNavigator) → mở bằng openModal
const MODAL_TARGETS = new Set(["PaymentSetup", "CreateTask", "ImagePreview", "CancellationPolicy", "Complaint"]);

// Menu items — những mục chưa có screen → thông báo "đang phát triển" (showComingSoon của RN)
const MENU_ITEMS = [
  { id: "rewards", icon: "gift", label: "Điểm thưởng & Voucher", target: "RewardPoints" },
  { id: "children", icon: "people", label: "Quản lý bé", target: null },
  { id: "payment", icon: "card", label: "Phương thức thanh toán", target: "PaymentSetup" },
  { id: "notifications", icon: "notifications", label: "Cài đặt thông báo", target: "Notifications" },
  { id: "security", icon: "shield-checkmark", label: "Bảo mật & Quyền riêng tư", target: null },
  { id: "help", icon: "help-circle", label: "Trợ giúp & Hỗ trợ", target: "HelpCenter" },
  { id: "about", icon: "information-circle", label: "Về EduCareLink", target: null },
];

/** RN utils/comingSoon.js — Alert 1 nút "Đã hiểu" */
const showComingSoon = (featureName?: string) => {
  showAlert(
    "Thông báo",
    featureName
      ? `Tính năng "${featureName}" đang được phát triển. Vui lòng quay lại sau!`
      : "Tính năng đang được phát triển. Vui lòng quay lại sau!"
  );
};

const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: n,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
});

const ParentProfileScreen: React.FC = () => {
  const nav = useNav();
  const { user, logout, refreshUser } = useAuth();

  // QA-FIX-UI 3.2: fade-in animation khi mount (opacity 0→1) — CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // Modal state cho "Đổi thông tin cá nhân" — pattern giống WorkerProfileScreen
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [modalMounted, setModalMounted] = useState(false); // slide-up animation
  const [changeForm, setChangeForm] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone_number: user?.phone_number || "",
    email: user?.email || "",
    address: user?.address || "",
  });
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  // Sync form khi user thay đổi (vd: user load xong sau khi mount)
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

  // Slide-up modal (RN animationType="slide") — bật transition sau 1 frame
  useEffect(() => {
    if (changeModalVisible) {
      const r = requestAnimationFrame(() => setModalMounted(true));
      return () => cancelAnimationFrame(r);
    }
    setModalMounted(false);
    return undefined;
  }, [changeModalVisible]);

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user?.username || "Phụ huynh";

  const handleMenuPress = (item: { label: string; target: string | null }) => {
    if (item.target) {
      if (MODAL_TARGETS.has(item.target)) nav.openModal(item.target);
      else nav.navigate(item.target);
    } else {
      showComingSoon(item.label);
    }
  };

  const handleRequestChange = async () => {
    setChangeSubmitting(true);
    try {
      // Chỉ gửi các field thực sự thay đổi (giữ logic diff của RN)
      const changes: Record<string, string> = {};
      (["first_name", "last_name", "phone_number", "email", "address"] as const).forEach((key) => {
        const newVal = (changeForm[key] || "").trim();
        const oldVal = String(user?.[key] || "").trim();
        if (newVal && newVal !== oldVal) changes[key] = newVal;
      });
      if (Object.keys(changes).length === 0) {
        showAlert("Không có thay đổi", "Bạn chưa sửa thông tin nào.");
        setChangeSubmitting(false);
        return;
      }
      // Đặc tả task 6-e: lưu trực tiếp hồ sơ parent (PATCH /profile/) thay vì
      // requestProfileChange của RN (workflow chờ Admin duyệt của worker).
      await updateProfile(changes);
      await refreshUser();
      showAlert("✅ Đã lưu", "Thông tin cá nhân đã được cập nhật.");
      setChangeModalVisible(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Cập nhật thông tin thất bại.";
      showAlert("Lỗi", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleLogout = () => {
    // RN: nhánh Platform.OS === 'web' — window.confirm rồi logout
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      logout();
    }
  };

  return (
    <Screen bg={COLORS.surfaceWarm} scroll={false}>
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
        <StatusBarSpacer />

        {/* Top App Bar */}
        <div style={S.appBar}>
          <div style={S.avatarSmall}>
            <Icon name="person" size={18} color={COLORS.primary} />
          </div>
          <span style={{ ...S.appBarTitle, color: COLORS.primary, fontSize: 22 }}>EduCareLink</span>
          <Touchable onPress={() => nav.navigate("Notifications")} style={S.appBarBtn}>
            <Icon name="notifications-outline" size={22} color={COLORS.primary} />
          </Touchable>
        </div>

        {/* Scroll content */}
        <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: "24px 20px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Profile card */}
            <div style={S.profileCard}>
              {/* Avatar 96px */}
              <div style={S.avatarLarge}>
                <span style={{ ...S.avatarText, fontSize: 36 }}>{displayName[0]?.toUpperCase() || "?"}</span>
              </div>
              <div style={{ ...S.name, ...clamp(2) }}>{displayName}</div>
              <span style={S.role}>Phụ huynh</span>

              {/* Badges */}
              <div style={S.badgeRow}>
                <div style={S.verifiedBadge}>
                  <Icon name="shield-checkmark" size={14} color={COLORS.secondaryDark} />
                  <span style={{ ...S.verifiedBadgeText, color: COLORS.secondaryDark }}>Đã xác thực</span>
                </div>
                <div style={S.memberBadge}>
                  <Icon name="star" size={14} color={COLORS.onSurfaceVariant} />
                  <span style={{ ...S.memberBadgeText, color: COLORS.onSurface }}>Thành viên</span>
                </div>
              </div>
            </div>

            {/* Stats row — 3 cột (mock stats, chưa có API parent stats — như RN) */}
            <div style={S.statsCard}>
              <div style={S.statItem}>
                <span style={{ ...S.statValue, color: COLORS.primary }}>12</span>
                <span style={{ ...S.statLabel, color: COLORS.onSurfaceVariant, textAlign: "center" }}>Việc đã đăng</span>
              </div>
              <div style={S.statDivider} />
              <div style={S.statItem}>
                <span style={{ ...S.statValue, color: COLORS.primary }}>8</span>
                <span style={{ ...S.statLabel, color: COLORS.onSurfaceVariant, textAlign: "center" }}>Hoàn thành</span>
              </div>
              <div style={S.statDivider} />
              <div style={S.statItem}>
                <span style={{ ...S.statValue, color: COLORS.primary }}>4.8</span>
                <span style={{ ...S.statLabel, color: COLORS.onSurfaceVariant, textAlign: "center" }}>Đánh giá</span>
              </div>
            </div>

            {/* Thông tin cá nhân — real data từ useAuth() (được populate từ API GET /profile/) */}
            <div style={S.infoCard}>
              <div style={S.infoHeader}>
                <span style={{ ...S.infoTitle, color: COLORS.onSurface }}>Thông tin cá nhân</span>
                <Touchable
                  style={S.editBtn}
                  onPress={() => {
                    setChangeForm({
                      first_name: user?.first_name || "",
                      last_name: user?.last_name || "",
                      phone_number: user?.phone_number || "",
                      email: user?.email || "",
                      address: user?.address || "",
                    });
                    setChangeModalVisible(true);
                  }}
                >
                  <Icon name="create-outline" size={16} color={COLORS.primary} />
                  <span style={{ ...S.editBtnText, color: COLORS.primary }}>Sửa</span>
                </Touchable>
              </div>
              <div style={S.infoList}>
                <div style={S.infoRow}>
                  <div style={{ ...S.infoIconBox, background: COLORS.primaryLight }}>
                    <Icon name="mail-outline" size={18} color={COLORS.primary} />
                  </div>
                  <div style={S.infoContent}>
                    <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>Email</span>
                    <span style={{ ...S.infoValue, color: COLORS.onSurface, ...clamp(1) }}>
                      {user?.email || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>
                <div style={S.infoDivider} />
                <div style={S.infoRow}>
                  <div style={{ ...S.infoIconBox, background: COLORS.primaryLight }}>
                    <Icon name="call-outline" size={18} color={COLORS.primary} />
                  </div>
                  <div style={S.infoContent}>
                    <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>Số điện thoại</span>
                    <span style={{ ...S.infoValue, color: COLORS.onSurface, ...clamp(1) }}>
                      {user?.phone_number || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>
                <div style={S.infoDivider} />
                <div style={S.infoRow}>
                  <div style={{ ...S.infoIconBox, background: COLORS.primaryLight }}>
                    <Icon name="location-outline" size={18} color={COLORS.primary} />
                  </div>
                  <div style={S.infoContent}>
                    <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>Địa chỉ</span>
                    <span style={{ ...S.infoValue, color: COLORS.onSurface, ...clamp(2) }}>
                      {user?.address || "Chưa cập nhật"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu list */}
            <div style={S.menuCard}>
              {MENU_ITEMS.map((item, idx) => (
                <div key={item.id}>
                  <Touchable style={S.menuRow} onPress={() => handleMenuPress(item)} activeOpacity={0.7}>
                    <div style={S.menuIconBox}>
                      <Icon name={ic(item.icon)} size={20} color={COLORS.primary} />
                    </div>
                    <span style={{ ...S.menuLabel, color: COLORS.onSurface, flex: 1 }}>{item.label}</span>
                    <Icon name="chevron-forward" size={18} color={COLORS.onSurfaceVariant} />
                  </Touchable>
                  {idx < MENU_ITEMS.length - 1 && <div style={S.menuDivider} />}
                </div>
              ))}
            </div>

            {/* Logout button */}
            <Touchable style={S.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Icon name="log-out-outline" size={20} color={COLORS.errorDeep} />
              <span style={{ ...S.logoutText, color: COLORS.errorDeep }}>Đăng xuất</span>
            </Touchable>

            {/* App version */}
            <span style={{ ...S.versionText, color: COLORS.outline, textAlign: "center" }}>EduCareLink v1.1.0</span>

            <div style={{ height: 60 }} />
          </div>
        </div>
      </div>

      {/* Modal: Đổi thông tin cá nhân — layout giống WorkerProfileScreen (bottom sheet slide-up) */}
      {changeModalVisible && (
        <div style={S.modalOverlay}>
          <div
            style={{
              ...S.modalContent,
              transform: modalMounted ? "translateY(0)" : "translateY(100%)",
            }}
          >
            <div style={S.modalHeader}>
              <span style={{ ...S.modalTitle, color: COLORS.onSurface }}>Đổi thông tin cá nhân</span>
              <Touchable onPress={() => setChangeModalVisible(false)} style={S.modalCloseBtn}>
                <Icon name="close" size={22} color={COLORS.textSecondary} />
              </Touchable>
            </div>

            <span style={{ ...S.modalLabel, color: COLORS.onSurfaceVariant }}>Họ</span>
            <input
              style={S.modalInput}
              value={changeForm.last_name}
              onChange={(e) => setChangeForm({ ...changeForm, last_name: e.target.value })}
            />

            <span style={{ ...S.modalLabel, color: COLORS.onSurfaceVariant }}>Tên</span>
            <input
              style={S.modalInput}
              value={changeForm.first_name}
              onChange={(e) => setChangeForm({ ...changeForm, first_name: e.target.value })}
            />

            <span style={{ ...S.modalLabel, color: COLORS.onSurfaceVariant }}>Số điện thoại</span>
            <input
              style={S.modalInput}
              value={changeForm.phone_number}
              onChange={(e) => setChangeForm({ ...changeForm, phone_number: e.target.value })}
              inputMode="tel"
            />

            <span style={{ ...S.modalLabel, color: COLORS.onSurfaceVariant }}>Email</span>
            <input
              style={S.modalInput}
              value={changeForm.email}
              onChange={(e) => setChangeForm({ ...changeForm, email: e.target.value })}
              inputMode="email"
              autoCapitalize="none"
            />

            <span style={{ ...S.modalLabel, color: COLORS.onSurfaceVariant }}>Địa chỉ</span>
            <textarea
              style={{ ...S.modalInput, minHeight: 64, resize: "vertical" }}
              value={changeForm.address}
              onChange={(e) => setChangeForm({ ...changeForm, address: e.target.value })}
            />

            <div style={{ ...S.infoBox, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
              <Icon name="information-circle-outline" size={14} color={COLORS.primary} />
              <span style={{ ...S.infoBoxText, color: COLORS.primaryDark }}>
                Thông tin sẽ được cập nhật ngay sau khi bạn gửi.
              </span>
            </div>

            <Touchable
              style={{ ...S.modalSubmitBtn, ...(changeSubmitting ? { opacity: 0.7 } : {}) }}
              onPress={handleRequestChange}
              disabled={changeSubmitting}
              activeOpacity={0.85}
            >
              {changeSubmitting ? (
                <Spinner size={22} color="#fff" />
              ) : (
                <>
                  <Icon name="send" size={18} color="#fff" />
                  <span style={{ ...S.modalSubmitText, color: COLORS.textOnPrimary, fontSize: 15 }}>Gửi yêu cầu</span>
                </>
              )}
            </Touchable>
          </div>
        </div>
      )}
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  // === APP BAR ===
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "32px 20px 12px",
    background: COLORS.surface,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: COLORS.surfaceContainer,
    border: `2px solid ${COLORS.primary}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  appBarTitle: { ...TYPO.h1 },
  appBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  // === PROFILE CARD ===
  profileCard: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    background: COLORS.primary,
    border: `4px solid ${COLORS.surface}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    boxShadow: SHADOWS.medium,
    boxSizing: "border-box",
  },
  avatarText: { ...TYPO.h1, color: COLORS.textOnPrimary, lineHeight: "40px" },
  name: { ...TYPO.h2, color: COLORS.onSurface, marginBottom: 4, textAlign: "center", width: "100%" },
  role: { ...TYPO.body, color: COLORS.onSurfaceVariant, marginBottom: 16 },
  // === BADGES ===
  badgeRow: { display: "flex", flexDirection: "row", gap: 8 },
  verifiedBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.secondaryLight,
    padding: "6px 12px",
    borderRadius: 999,
  },
  verifiedBadgeText: { ...TYPO.caption },
  memberBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.surfaceContainerHigh,
    padding: "6px 12px",
    borderRadius: 999,
  },
  memberBadgeText: { ...TYPO.caption },
  // === STATS CARD ===
  statsCard: {
    display: "flex",
    flexDirection: "row",
    background: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  statItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  statValue: { ...TYPO.h3, marginBottom: 4 },
  statLabel: { ...TYPO.caption },
  statDivider: { width: 1, height: 40, background: COLORS.outlineVariant, flexShrink: 0 },
  // === INFO CARD (email/phone/address) ===
  infoCard: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  infoHeader: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  infoTitle: { ...TYPO.h4 },
  editBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    borderRadius: 999,
    background: COLORS.primaryLight,
  },
  editBtnText: { ...TYPO.caption },
  infoList: { display: "flex", flexDirection: "column", gap: 0 },
  infoRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "12px 0" },
  infoIconBox: { width: 38, height: 38, borderRadius: 19, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  infoContent: { flex: 1, minWidth: 0 },
  infoLabel: { ...TYPO.overline, marginBottom: 2, display: "block" },
  infoValue: { ...TYPO.body, fontWeight: 600 },
  infoDivider: { height: 1, background: COLORS.outlineVariant, opacity: 0.5 },
  // === MENU CARD ===
  menuCard: {
    background: COLORS.surface,
    borderRadius: 20,
    border: `1px solid ${COLORS.outlineVariant}`,
    overflow: "hidden",
    boxShadow: SHADOWS.small,
  },
  menuRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: COLORS.surfaceContainer,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  menuLabel: { ...TYPO.h4 },
  menuDivider: { height: 1, background: COLORS.outlineVariant, margin: "0 16px", opacity: 0.5 },
  // === LOGOUT ===
  logoutBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "16px 0",
    background: COLORS.surface,
    borderRadius: 14,
    border: "1px solid rgba(186, 26, 26, 0.3)",
    boxShadow: SHADOWS.small,
  },
  logoutText: { ...TYPO.h4 },
  // === VERSION ===
  versionText: { ...TYPO.caption, marginTop: 8, display: "block" },
  // === MODAL (Đổi thông tin cá nhân) ===
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    zIndex: 300,
  },
  modalContent: {
    background: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    padding: "20px 20px 36px",
    maxHeight: "90%",
    overflowY: "auto",
    transition: "transform 0.25s ease-out",
    width: "100%",
    boxSizing: "border-box",
  },
  modalHeader: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { ...TYPO.h4, fontWeight: 800 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.surfaceWarm,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  modalLabel: { ...TYPO.overline, marginBottom: 6, marginTop: 12, display: "block" },
  modalInput: {
    background: COLORS.surfaceWarm,
    borderRadius: SIZES.radiusSm,
    border: `1.5px solid ${COLORS.outlineVariant}`,
    padding: "10px 14px",
    ...TYPO.body,
    color: COLORS.onSurface,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    fontFamily: TYPO.body.fontFamily,
    fontSize: TYPO.body.fontSize,
    fontWeight: TYPO.body.fontWeight,
  },
  infoBox: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    borderRadius: SIZES.radiusSm,
    padding: 10,
    marginTop: 12,
    border: "1px solid",
  },
  infoBoxText: { flex: 1, ...TYPO.caption, lineHeight: "18px" },
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
  modalSubmitText: { ...TYPO.button },
};

export default ParentProfileScreen;
