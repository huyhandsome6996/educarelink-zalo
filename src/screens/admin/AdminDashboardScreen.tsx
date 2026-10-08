/**
 * AdminDashboardScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminDashboardScreen.js (451 dòng).
 * Hub admin: header cam (logo + NotificationBell), Quick Actions ngang mở 7 màn admin,
 * 3 tab (Chờ duyệt / Carepartner / Tất cả user) với thẻ user + action approve/reject/
 * toggle_active/revoke, nút "Tạo dữ liệu mẫu" ghim đáy.
 * Dữ liệu: getPendingWorkers/getAllWorkers/getAllUsers + workerAction/toggleUserActive/
 * revokeCarepartner/seedDemoData (src/api/misc.ts — port đúng mobile/src/api/admin.js).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web; dữ liệu tự reload khi đổi tab.
 * - Alert.alert 2 nút (Từ chối / Tước quyền / Seed) → window.confirm 2 nút.
 * - Alert.alert 1 nút (thông báo kết quả) → showAlert (window.alert).
 * - Route RN 'AdminTracking' → registry zalo đăng ký tên 'AdminTrackingOverview' (map tại QUICK_ACTIONS).
 * - RN navigation.navigate tới 2 route presentation:'modal' (AdminChatbot, AdminSendNotification)
 *   → nav.openModal (router zalo render modal phủ toàn màn như react-navigation).
 * - Icon thiếu glyph trong bộ 159: documents→document-text, card→card-outline,
 *   document-attach→document-text-outline, flask-outline→cube, lock-closed→lock-closed-outline,
 *   swap-horizontal→sync-outline, checkmark-done-outline→checkmark-circle-outline
 *   (map glyph Ionicons gần nhất cùng nghĩa — không được sửa ionicons.ts).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import {
  Touchable,
  Spinner,
  showAlert,
  StatusBarSpacer,
  NotificationBell,
  useStatusBarHeight,
} from "@/components/ui";
import { COLORS, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import {
  getPendingWorkers,
  workerAction,
  toggleUserActive,
  revokeCarepartner,
  getAllWorkers,
  getAllUsers,
  seedDemoData,
} from "@/api/misc";

const TABS = [
  { key: "pending", label: "Chờ duyệt", icon: "time-outline" },
  { key: "workers", label: "Carepartner", icon: "people-outline" },
  { key: "users", label: "Tất cả user", icon: "person-outline" },
];

// Quick access buttons cho admin — mở các screen chuyên biệt
const QUICK_ACTIONS = [
  { key: "admin_chatbot", label: "AI Trợ lý", icon: "sparkles", color: COLORS.primary, target: "AdminChatbot" },
  { key: "admin_all_tasks", label: "Tất cả việc", icon: "document-text", color: "#0EA5E9", target: "AdminAllTasks" },
  { key: "admin_payments", label: "Thanh toán", icon: "card-outline", color: "#D82D8B", target: "AdminPayments" },
  { key: "admin_review", label: "Duyệt hồ sơ", icon: "document-text-outline", color: COLORS.secondary, target: "AdminReview" },
  { key: "admin_moderation", label: "Kiểm duyệt", icon: "shield-checkmark", color: COLORS.warning, target: "AdminModeration" },
  // RN route 'AdminTracking' — registry zalo dùng tên 'AdminTrackingOverview'
  { key: "admin_tracking", label: "Tracking", icon: "locate", color: COLORS.info, target: "AdminTrackingOverview" },
  { key: "admin_send_notify", label: "Gửi thông báo", icon: "notifications", color: "#8B5CF6", target: "AdminSendNotification" },
];

interface AdminUserRow {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  role?: string;
  is_active?: boolean;
  is_approved?: boolean;
}

const AdminDashboardScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [activeTab, setActiveTab] = useState("pending");
  const [data, setData] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      let res: any;
      if (activeTab === "pending") res = await getPendingWorkers();
      else if (activeTab === "workers") res = await getAllWorkers();
      else res = await getAllUsers();
      setData(res.data || []);
    } catch (e: any) {
      console.error("Admin fetch error:", e);
      showAlert("Lỗi", "Không thể tải dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleAction = async (userId: number | string, action: string) => {
    setActionLoading(`${userId}-${action}`);
    try {
      if (action === "approve") {
        await workerAction(userId, { action: "approve" });
        showAlert("✅ Đã duyệt", "Tài khoản Carepartner đã được kích hoạt.");
      } else if (action === "reject") {
        // RN Alert.alert 2 nút (Huỷ / Từ chối destructive) → window.confirm
        const ok = window.confirm("Xác nhận từ chối\n\nBạn chắc chắn muốn từ chối tài khoản này?");
        if (!ok) return;
        try {
          await workerAction(userId, { action: "reject" });
          showAlert("✅ Đã từ chối", "Tài khoản đã bị từ chối.");
          fetchData();
        } catch (err: any) {
          showAlert("Lỗi", err?.response?.data?.error || "Thao tác thất bại.");
        }
        return;
      } else if (action === "toggle_active") {
        await toggleUserActive(userId);
        showAlert("✅ Thành công", "Đã thay đổi trạng thái tài khoản.");
      } else if (action === "revoke") {
        const ok = window.confirm("Xác nhận tước quyền\n\nTước quyền Carepartner (đổi về Phụ huynh)?");
        if (!ok) return;
        try {
          await revokeCarepartner(userId);
          showAlert("✅ Đã tước quyền", "User đã được đổi về vai trò Phụ huynh.");
          fetchData();
        } catch (err: any) {
          showAlert("Lỗi", err?.response?.data?.error || "Thao tác thất bại.");
        }
        return;
      }
      fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Thao tác thất bại.";
      showAlert("Lỗi", msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedDemo = async () => {
    const ok = window.confirm("Seed dữ liệu mẫu\n\nTạo user + task mẫu để test? (Sẽ thêm dữ liệu vào DB)");
    if (!ok) return;
    try {
      await seedDemoData();
      showAlert("✅ Thành công", "Đã seed dữ liệu mẫu.");
      fetchData();
    } catch (e: any) {
      showAlert("Lỗi", "Không thể seed dữ liệu.");
    }
  };

  const renderUser = (item: AdminUserRow) => {
    const isWorker = item.role === "worker";
    const isPending = !item.is_approved && isWorker;
    return (
      <div key={String(item.id)} style={S.card}>
        <div style={S.cardTop}>
          <div style={S.avatar}>
            <span style={S.avatarText}>{item.username?.[0]?.toUpperCase() || "?"}</span>
          </div>
          <div style={S.cardInfo}>
            <div style={S.userName}>
              {item.first_name || item.last_name
                ? `${item.first_name} ${item.last_name || ""}`.trim()
                : item.username}
            </div>
            <div style={S.userUsername}>@{item.username}</div>
            <div style={S.roleRow}>
              <div
                style={{
                  ...S.roleBadge,
                  ...(isWorker
                    ? S.roleWorker
                    : item.role === "parent"
                    ? S.roleParent
                    : S.roleAdmin),
                }}
              >
                <span style={S.roleText}>
                  {item.role === "parent" ? "Phụ huynh" : item.role === "worker" ? "Carepartner" : "Admin"}
                </span>
              </div>
              {!item.is_active && (
                <div style={S.lockedBadge}>
                  <Icon name="lock-closed-outline" size={10} color="#fff" />
                  <span style={S.lockedText}>Khoá</span>
                </div>
              )}
              {isPending && (
                <div style={S.pendingBadge}>
                  <Icon name="time" size={10} color={COLORS.warning} />
                  <span style={S.pendingText}>Chờ duyệt</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div style={S.contactRow}>
          {item.email ? (
            <div style={S.contactItem}>
              <Icon name="mail-outline" size={12} color={COLORS.textMuted} />
              <span style={S.contactText}>{item.email}</span>
            </div>
          ) : null}
          {item.phone_number ? (
            <div style={S.contactItem}>
              <Icon name="call-outline" size={12} color={COLORS.textMuted} />
              <span style={S.contactText}>{item.phone_number}</span>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div style={S.actionRow}>
          {activeTab === "pending" && (
            <>
              <Touchable
                style={{
                  ...S.actionBtn,
                  ...S.approveBtn,
                  ...(actionLoading === `${item.id}-approve` ? { opacity: 0.6 } : {}),
                }}
                onPress={() => handleAction(item.id, "approve")}
                disabled={actionLoading === `${item.id}-approve`}
                activeOpacity={0.85}
              >
                {actionLoading === `${item.id}-approve` ? (
                  <Spinner size={16} color="#fff" />
                ) : (
                  <>
                    <Icon name="checkmark" size={16} color="#fff" />
                    <span style={S.actionBtnText}>Duyệt</span>
                  </>
                )}
              </Touchable>
              <Touchable style={{ ...S.actionBtn, ...S.rejectBtn }} onPress={() => handleAction(item.id, "reject")} activeOpacity={0.85}>
                <Icon name="close" size={16} color={COLORS.error} />
                <span style={{ ...S.actionBtnText, color: COLORS.error }}>Từ chối</span>
              </Touchable>
            </>
          )}
          {activeTab === "workers" && (
            <>
              <Touchable style={{ ...S.actionBtn, ...S.toggleBtn }} onPress={() => handleAction(item.id, "toggle_active")} activeOpacity={0.85}>
                <Icon name={item.is_active ? "lock-closed-outline" : "lock-open-outline"} size={16} color={COLORS.textSecondary} />
                <span style={{ ...S.actionBtnText, color: COLORS.textSecondary }}>
                  {item.is_active ? "Khoá" : "Mở khoá"}
                </span>
              </Touchable>
              <Touchable style={{ ...S.actionBtn, ...S.revokeBtn }} onPress={() => handleAction(item.id, "revoke")} activeOpacity={0.85}>
                <Icon name="sync-outline" size={16} color={COLORS.warning} />
                <span style={{ ...S.actionBtnText, color: COLORS.warning }}>Tước quyền</span>
              </Touchable>
            </>
          )}
          {activeTab === "users" && (
            <Touchable style={{ ...S.actionBtn, ...S.toggleBtn }} onPress={() => handleAction(item.id, "toggle_active")} activeOpacity={0.85}>
              <Icon name={item.is_active ? "lock-closed-outline" : "lock-open-outline"} size={16} color={COLORS.textSecondary} />
              <span style={{ ...S.actionBtnText, color: COLORS.textSecondary }}>
                {item.is_active ? "Khoá tài khoản" : "Mở khoá"}
              </span>
            </Touchable>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, position: "relative", overflow: "hidden" }}>
      <StatusBarSpacer />
      {/* Header */}
      <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitleRow}>
          {/* RN require('../../../assets/logo.png') → asset tĩnh đã copy vào /static/images */}
          <img
            src="/static/images/logo.png"
            alt=""
            style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", marginRight: 10, objectFit: "contain" }}
          />
          <div style={S.headerTitle}>Admin Dashboard</div>
        </div>
        <NotificationBell />
      </div>

      {/* Quick Actions — các nút truy cập nhanh tới tính năng admin */}
      <div style={S.quickActionsWrap}>
        <div style={S.quickActionsScroll}>
          {QUICK_ACTIONS.map((action) => (
            <Touchable
              key={action.key}
              style={S.quickActionBtn}
              // RN presentation:'modal' (AdminChatbot/AdminSendNotification) → openModal
              onPress={() =>
                action.target === "AdminChatbot" || action.target === "AdminSendNotification"
                  ? nav.openModal(action.target)
                  : nav.navigate(action.target)
              }
              activeOpacity={0.85}
            >
              <div style={{ ...S.quickActionIcon, background: action.color }}>
                <Icon name={action.icon} size={18} color="#fff" />
              </div>
              <div style={S.quickActionLabel}>{action.label}</div>
            </Touchable>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Touchable
              key={tab.key}
              style={{ ...S.tab, ...(isActive ? S.tabActive : {}) }}
              onPress={() => {
                setActiveTab(tab.key);
                setIsLoading(true);
              }}
              activeOpacity={0.8}
            >
              <Icon name={tab.icon} size={16} color={isActive ? COLORS.primary : COLORS.textMuted} />
              <div style={{ ...S.tabText, ...(isActive ? S.tabTextActive : {}) }}>{tab.label}</div>
            </Touchable>
          );
        })}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={S.list}>
            <div style={S.countText}>
              {data.length} {activeTab === "pending" ? "chờ duyệt" : activeTab === "workers" ? "carepartner" : "người dùng"}
            </div>
            {data.length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.emptyIconCircle}>
                  <Icon name="checkmark-circle-outline" size={40} color={COLORS.primary} />
                </div>
                <div style={S.emptyTitle}>Không có dữ liệu</div>
                <div style={S.emptyText}>
                  {activeTab === "pending" ? "Không có carepartner nào chờ duyệt" : "Chưa có user nào"}
                </div>
              </div>
            ) : (
              data.map(renderUser)
            )}
          </div>
        </div>
      )}

      {/* Bottom: Seed demo data button */}
      <Touchable style={S.seedBtn} onPress={handleSeedDemo} activeOpacity={0.85}>
        <Icon name="cube" size={18} color="#fff" />
        <div style={S.seedBtnText}>Tạo dữ liệu mẫu</div>
      </Touchable>
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 16px",
    background: COLORS.primary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    background: "rgba(255,255,255,0.15)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800 },
  headerTitleRow: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  tabs: {
    display: "flex",
    flexDirection: "row",
    background: COLORS.surface,
    padding: "0 16px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    gap: SIZES.xs,
  },
  tab: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    display: "flex",
    alignItems: "center",
    borderRadius: SIZES.radiusSm,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    background: COLORS.background,
  },
  tabActive: { background: COLORS.primaryLight, boxShadow: SHADOWS.small },
  tabText: { ...typo("buttonSmall"), color: COLORS.textMuted, fontWeight: 600 },
  tabTextActive: { color: COLORS.primary, fontWeight: 800 },
  list: { padding: 16, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 100 },
  countText: { ...typo("overline"), color: COLORS.textMuted, marginBottom: 4 },
  card: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: SHADOWS.cardHover,
    borderLeft: `4px solid ${COLORS.primary}`,
  },
  cardTop: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  avatarText: { color: "#fff", ...typo("h4"), fontWeight: 800 },
  cardInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  userName: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  userUsername: { ...typo("caption"), color: COLORS.textMuted },
  roleRow: { display: "flex", flexDirection: "row", gap: 6, alignItems: "center", marginTop: 2 },
  roleBadge: { borderRadius: SIZES.radiusXs, padding: "2px 8px" },
  roleWorker: { background: COLORS.primaryLight },
  roleParent: { background: COLORS.successBg },
  roleAdmin: { background: "#fef3c7" },
  roleText: { ...typo("overline"), fontWeight: 700 },
  lockedBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    background: COLORS.error,
    borderRadius: SIZES.radiusXs,
    padding: "2px 6px",
  },
  lockedText: { color: "#fff", ...typo("overline"), fontSize: 9, fontWeight: 700 },
  pendingBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    background: COLORS.warningBg,
    borderRadius: SIZES.radiusXs,
    padding: "2px 6px",
  },
  pendingText: { ...typo("overline"), color: COLORS.warning, fontSize: 9, fontWeight: 700 },
  contactRow: { display: "flex", flexDirection: "row", gap: 14, flexWrap: "wrap" },
  contactItem: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  contactText: { ...typo("caption"), color: COLORS.textSecondary },
  actionRow: { display: "flex", flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderRadius: SIZES.radiusSm,
    paddingTop: 10,
    paddingBottom: 10,
  },
  approveBtn: { background: COLORS.success, boxShadow: SHADOWS.small },
  rejectBtn: { background: COLORS.errorBg, border: "1px solid #fecaca" },
  toggleBtn: { background: COLORS.background, border: `1px solid ${COLORS.border}` },
  revokeBtn: { background: COLORS.warningBg, border: "1px solid #fde68a" },
  actionBtnText: { ...typo("buttonSmall"), fontWeight: 700 },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, paddingBottom: 60, gap: 12 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  emptyTitle: { ...typo("h5"), color: COLORS.textPrimary },
  emptyText: { ...typo("bodySmall"), color: COLORS.textMuted, textAlign: "center" },
  seedBtn: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 50,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    boxShadow: SHADOWS.large,
    zIndex: 5,
  },
  seedBtnText: { color: "#fff", ...typo("button"), fontSize: 15 },
  // Quick Actions
  quickActionsWrap: {
    background: COLORS.surface,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  quickActionsScroll: { display: "flex", flexDirection: "row", gap: 12, padding: "0 16px", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  quickActionBtn: { display: "flex", flexDirection: "column", alignItems: "center", width: 70, gap: 4, flexShrink: 0 },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  quickActionLabel: { ...typo("caption"), color: COLORS.textSecondary, textAlign: "center", fontWeight: 600, fontSize: 10 },
};

export default AdminDashboardScreen;
