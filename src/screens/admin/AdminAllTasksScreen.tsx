/**
 * AdminAllTasksScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminAllTasksScreen.js (379 dòng).
 * Danh sách TẤT CẢ công việc (getAllTasksAdmin(moderation_status)) — header TRẮNG với
 * nút refresh (giữ được trên web), ô tìm kiếm client-side (title/parent), chips filter
 * moderation (all/pending/needs_review/approved/rejected), thẻ task với 2 badge
 * (trạng thái task + trạng thái kiểm duyệt), verdict AI, nút Duyệt (confirm) /
 * Xóa (modal nhập lý do → moderateTask reject_task).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → nút refresh trên header giữ nguyên + không pull.
 * - Alert.alert 2 nút (Duyệt công việc) → window.confirm; Alert 1 nút → showAlert.
 * - Modal fade của RN → overlay fixed hiển thị tức thời.
 * - numberOfLines (2/3) → CSS -webkit-line-clamp.
 * - Icon thiếu glyph: eye→eye-outline, trash→trash-outline, documents-outline→
 *   document-text-outline (bộ 159 glyph).
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, useStatusBarHeight } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getAllTasksAdmin, moderateTask } from "@/api/misc";

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả", icon: "apps" },
  { value: "pending", label: "Chờ AI", icon: "time" },
  { value: "needs_review", label: "Cần xem", icon: "eye-outline" },
  { value: "approved", label: "Đã duyệt", icon: "checkmark-circle" },
  { value: "rejected", label: "Từ chối", icon: "close-circle" },
];

const TASK_STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  open: { text: "Đang tìm", color: COLORS.warning, bg: "#FFF7ED" },
  in_progress: { text: "Đang làm", color: COLORS.info, bg: "#DBEAFE" },
  completed: { text: "Hoàn thành", color: COLORS.success, bg: "#DCFCE7" },
  cancelled: { text: "Đã hủy", color: COLORS.textSecondary, bg: "#F3F4F6" },
};

const MOD_STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  approved: { text: "✅ Đã duyệt", color: COLORS.success, bg: "#DCFCE7" },
  admin_approved: { text: "✅ Admin duyệt", color: COLORS.success, bg: "#DCFCE7" },
  rejected: { text: "❌ Từ chối", color: COLORS.error, bg: "#FEE2E2" },
  needs_review: { text: "⚠️ Cần xem", color: "#D97706", bg: "#FEF3C7" },
  pending: { text: "⏳ Chờ AI", color: "#4F46E5", bg: "#E0E7FF" },
};

interface TaskRow {
  id: number | string;
  title?: string;
  description?: string;
  status?: string;
  price?: string | number;
  moderation_status?: string;
  moderation_verdict?: string;
  parent_name?: string;
  parent_username?: string;
  category_name?: string;
  scheduled_time?: string;
  location?: string;
  geofence_lat?: number | string | null;
  geofence_lng?: number | string | null;
}

const AdminAllTasksScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; taskId: number | string | null }>({
    visible: false,
    taskId: null,
  });
  const [rejectReason, setRejectReason] = useState("");

  const loadTasks = useCallback(
    async (status: string = filter) => {
      try {
        setLoading(true);
        const res = await getAllTasksAdmin(status);
        setTasks(res.data || []);
      } catch (err) {
        showAlert("Lỗi", "Không thể tải danh sách công việc");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  const handleApprove = async (taskId: number | string) => {
    const ok = window.confirm("Duyệt công việc\n\nBạn có chắc muốn duyệt công việc này?");
    if (!ok) return;
    try {
      await moderateTask(taskId, { action: "approve_task" });
      showAlert("✅ Thành công", "Đã duyệt công việc");
      loadTasks();
    } catch (err: any) {
      showAlert("Lỗi", err?.response?.data?.error || "Không thể duyệt");
    }
  };

  const handleReject = (taskId: number | string) => {
    setRejectModal({ visible: true, taskId });
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      showAlert("Lỗi", "Vui lòng nhập lý do xóa");
      return;
    }
    try {
      await moderateTask(rejectModal.taskId!, {
        action: "reject_task",
        reason: rejectReason,
      });
      setRejectModal({ visible: false, taskId: null });
      showAlert("✅ Thành công", "Đã xóa công việc");
      loadTasks();
    } catch (err: any) {
      showAlert("Lỗi", err?.response?.data?.error || "Không thể xóa");
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (t.title || "").toLowerCase().includes(q) ||
      (t.parent_name || "").toLowerCase().includes(q) ||
      (t.parent_username || "").toLowerCase().includes(q)
    );
  });

  const renderTask = (item: TaskRow) => {
    const taskStatus = TASK_STATUS_LABEL[item.status || ""] || {
      text: item.status,
      color: COLORS.textSecondary,
      bg: "#F3F4F6",
    };
    const modStatus = MOD_STATUS_LABEL[item.moderation_status || ""] || MOD_STATUS_LABEL.pending;
    const hasGeofence = item.geofence_lat && item.geofence_lng;

    return (
      <div key={String(item.id)} style={S.taskCard}>
        <div style={S.taskHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...S.taskTitle, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
              {item.title} {hasGeofence ? "📍" : ""}
            </div>
            <div style={{ ...S.taskDesc, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
              {item.description}
            </div>
          </div>
          <div style={S.taskPrice}>{parseInt(String(item.price || 0)).toLocaleString("vi-VN")}đ</div>
        </div>

        <div style={S.taskMeta}>
          <div style={S.metaText}>👤 {item.parent_name || item.parent_username}</div>
          <div style={S.metaText}>📂 {item.category_name || "Khác"}</div>
        </div>

        <div style={S.taskMeta}>
          <div style={S.metaText}>
            📅 {item.scheduled_time ? new Date(item.scheduled_time).toLocaleDateString("vi-VN") : "—"}
          </div>
          <div style={S.metaText}>📍 {item.location || "—"}</div>
        </div>

        <div style={S.badgesRow}>
          <div style={{ ...S.badge, background: taskStatus.bg }}>
            <div style={{ ...S.badgeText, color: taskStatus.color }}>{taskStatus.text}</div>
          </div>
          <div style={{ ...S.badge, background: modStatus.bg }}>
            <div style={{ ...S.badgeText, color: modStatus.color }}>{modStatus.text}</div>
          </div>
        </div>

        {item.moderation_verdict ? (
          <div
            style={{ ...S.verdictText, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}
          >
            AI: {item.moderation_verdict}
          </div>
        ) : null}

        <div style={S.actionRow}>
          <Touchable style={{ ...S.actionBtn, ...S.approveBtn }} onPress={() => handleApprove(item.id)}>
            <Icon name="checkmark-circle" size={16} color="#fff" />
            <div style={S.actionBtnText}>Duyệt</div>
          </Touchable>
          <Touchable style={{ ...S.actionBtn, ...S.rejectBtn }} onPress={() => handleReject(item.id)}>
            <Icon name="trash-outline" size={16} color="#fff" />
            <div style={S.actionBtnText}>Xóa</div>
          </Touchable>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden" }}>
      <StatusBarSpacer />
      <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={24} color={COLORS.textPrimary} />
        </Touchable>
        <div style={S.headerTitle}>Tất cả công việc</div>
        <Touchable onPress={onRefresh} style={S.refreshBtn}>
          <Icon name="refresh" size={22} color={COLORS.primary} />
        </Touchable>
      </div>

      <div style={S.searchRow}>
        <div style={S.searchInput}>
          <Icon name="search" size={16} color={COLORS.textMuted} />
          <input
            style={S.searchText}
            placeholder="Tìm theo tiêu đề, phụ huynh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={S.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Touchable
            key={f.value}
            style={{ ...S.filterChip, ...(filter === f.value ? S.filterChipActive : {}) }}
            onPress={() => setFilter(f.value)}
          >
            <Icon name={f.icon} size={13} color={filter === f.value ? "#fff" : COLORS.textSecondary} />
            <div style={{ ...S.filterText, ...(filter === f.value ? S.filterTextActive : {}) }}>{f.label}</div>
          </Touchable>
        ))}
      </div>

      {loading ? (
        <div style={S.centerContainer}>
          <Spinner size={36} color={COLORS.primary} />
          <div style={S.loadingText}>Đang tải...</div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={S.centerContainer}>
          <Icon name="document-text-outline" size={64} color={COLORS.textMuted} />
          <div style={S.emptyTitle}>Không có công việc</div>
          <div style={S.emptyText}>{filter === "all" ? "Chưa có phụ huynh nào đăng việc" : "Không có công việc phù hợp bộ lọc"}</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={S.list}>{filteredTasks.map(renderTask)}</div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.visible && (
        <div
          style={S.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRejectModal({ visible: false, taskId: null });
          }}
        >
          <div style={S.modalContent}>
            <div style={S.modalTitle}>Xóa công việc</div>
            <div style={S.modalSubtitle}>Nhập lý do xóa (sẽ gửi thông báo cho phụ huynh):</div>
            <textarea
              style={S.modalInput}
              placeholder="VD: Công việc vi phạm tiêu chuẩn cộng đồng..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div style={S.modalActions}>
              <Touchable style={{ ...S.modalBtn, ...S.modalCancelBtn }} onPress={() => setRejectModal({ visible: false, taskId: null })}>
                <div style={S.modalCancelText}>Hủy</div>
              </Touchable>
              <Touchable style={{ ...S.modalBtn, ...S.modalConfirmBtn }} onPress={confirmReject}>
                <div style={S.modalConfirmText}>Xóa</div>
              </Touchable>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 12px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typo("h4"), color: COLORS.textPrimary, fontWeight: 700 },
  refreshBtn: { padding: 4 },
  searchRow: { padding: 12, background: COLORS.surface },
  searchInput: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: COLORS.background,
    borderRadius: 12,
    padding: "8px 12px",
  },
  searchText: {
    ...TYPO.body,
    lineHeight: "22px",
    flex: 1,
    color: COLORS.textPrimary,
    border: "none",
    outline: "none",
    background: "transparent",
    fontFamily: TYPO.body.fontFamily,
  },
  filterRow: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    padding: "0 12px 8px",
    background: COLORS.surface,
    flexWrap: "wrap",
  },
  filterChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: "5px 10px",
    borderRadius: 16,
    background: COLORS.background,
    border: `1px solid ${COLORS.border}`,
  },
  filterChipActive: { background: COLORS.primary, borderColor: COLORS.primary },
  filterText: { ...typo("caption"), color: COLORS.textSecondary, fontWeight: 600 },
  filterTextActive: { color: "#fff" },
  list: { padding: 12, display: "flex", flexDirection: "column", gap: 12 },
  taskCard: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    boxShadow: SHADOWS.cardHover,
    border: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
  },
  taskHeader: { display: "flex", flexDirection: "row", gap: 10, marginBottom: 8 },
  taskTitle: { ...TYPO.body, lineHeight: "22px", fontWeight: 700, color: COLORS.textPrimary, flex: 1 },
  taskDesc: { ...typo("caption"), color: COLORS.textSecondary, marginTop: 2 },
  taskPrice: { ...TYPO.body, lineHeight: "22px", fontWeight: 800, color: COLORS.primary },
  taskMeta: { display: "flex", flexDirection: "row", gap: 12, marginBottom: 4 },
  metaText: { ...typo("caption"), color: COLORS.textSecondary },
  badgesRow: { display: "flex", flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  badge: { padding: "3px 8px", borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: 600 },
  verdictText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    fontStyle: "italic",
    lineHeight: "16px",
  },
  actionRow: { display: "flex", flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
  },
  approveBtn: { background: COLORS.success },
  rejectBtn: { background: COLORS.error },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: 700 },
  centerContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: { ...TYPO.body, lineHeight: "22px", color: COLORS.textSecondary, marginTop: 8 },
  emptyTitle: { ...typo("h4"), color: COLORS.textPrimary, marginTop: 12 },
  emptyText: { ...TYPO.body, lineHeight: "22px", color: COLORS.textSecondary, textAlign: "center", marginTop: 4 },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "rgba(0,0,0,0.5)",
    padding: 24,
    zIndex: 300,
  },
  modalContent: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: { ...typo("h4"), color: COLORS.textPrimary, fontWeight: 700, marginBottom: 8 },
  modalSubtitle: { ...typo("bodySmall"), color: COLORS.textSecondary, marginBottom: 12 },
  modalInput: {
    width: "100%",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    ...TYPO.body,
    lineHeight: "22px",
    color: COLORS.textPrimary,
    marginBottom: 16,
    outline: "none",
    resize: "vertical",
    fontFamily: TYPO.body.fontFamily,
    background: "#fff",
  },
  modalActions: { display: "flex", flexDirection: "row", gap: 8 },
  modalBtn: { flex: 1, paddingTop: 10, paddingBottom: 10, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" },
  modalCancelBtn: { background: COLORS.background },
  modalCancelText: { ...TYPO.body, lineHeight: "22px", color: COLORS.textSecondary, fontWeight: 600 },
  modalConfirmBtn: { background: COLORS.error },
  modalConfirmText: { ...TYPO.body, lineHeight: "22px", color: "#fff", fontWeight: 700 },
};

export default AdminAllTasksScreen;
