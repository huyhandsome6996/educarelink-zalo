/**
 * AdminReviewScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminReviewScreen.js (476 dòng).
 * 2 tab: "Bằng cấp" (getPendingCredentials + reviewCredential) và "Sửa hồ sơ"
 * (getPendingProfileChanges + reviewProfileChange); chips filter status
 * (pending/approved/rejected/all); modal duyệt/từ chối với ghi chú admin;
 * ảnh bằng cấp mở ImagePreview (params uri + title).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web.
 * - Modal fade của RN → overlay fixed hiển thị tức thời.
 * - Ảnh media backend (certificate_photo) đường dẫn tương đối /media/... → ghép
 *   RENDER_ORIGIN thành URL tuyệt đối để <img> + ImagePreview load được (RN dùng URL gốc).
 * - Alert.alert 1 nút → showAlert (window.alert).
 * - Icon thiếu glyph: document-attach→document-text-outline, create→create-outline,
 *   checkmark-done-outline→checkmark-circle-outline (bộ 159 glyph).
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, useStatusBarHeight } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { RENDER_ORIGIN } from "@/api/client";
import { getPendingCredentials, reviewCredential, getPendingProfileChanges, reviewProfileChange } from "@/api/misc";

// ====================================================================
// Admin Review Screen — gộp 2 tab:
//   1. Credential submissions (worker gửi bằng cấp)
//   2. Profile change requests (worker yêu cầu sửa hồ sơ)
// Đồng bộ với web (admin_dashboard.html phần credential + profile change)
// ====================================================================

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
};

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  approved: COLORS.success,
  rejected: COLORS.error,
};

/** Ảnh /media/... của backend cần origin tuyệt đối khi chạy trên domain Zalo */
const absMedia = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${RENDER_ORIGIN}${url}`;
};

interface ReviewRow {
  id: number | string;
  status?: string;
  created_at?: string;
  admin_review?: string;
  reviewed_at?: string;
  worker_name?: string;
  worker_username?: string;
  // credential
  description?: string;
  certificate_photo?: string;
  // profile change
  proposed_changes?: Record<string, any>;
}

interface ReviewModal {
  type: "approve" | "reject";
  item?: ReviewRow;
  adminNote: string;
}

const AdminReviewScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [activeTab, setActiveTab] = useState("credentials"); // credentials | profile_changes
  const [statusFilter, setStatusFilter] = useState("pending");
  const [data, setData] = useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null);

  const fetchData = useCallback(async () => {
    try {
      let res: any;
      if (activeTab === "credentials") {
        res = await getPendingCredentials(statusFilter);
      } else {
        res = await getPendingProfileChanges(statusFilter);
      }
      setData(res.data || []);
    } catch (e: any) {
      console.error("Admin review fetch error:", e);
      showAlert("Lỗi", "Không tải được dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter, fetchData]);

  const handleReview = async (item: ReviewRow | undefined, action?: string) => {
    if (!item || !action) return;
    setActionLoading(`${item.id}-${action}`);
    try {
      const adminReview = reviewModal?.adminNote || "";
      if (activeTab === "credentials") {
        // Backend chấp nhận action='approve'|'reject' + admin_review + qualifications (tuỳ chọn)
        await reviewCredential(item.id, { action, admin_review: adminReview });
      } else {
        await reviewProfileChange(item.id, { action, admin_review: adminReview });
      }
      showAlert("✅ Thành công", action === "approve" ? "Đã duyệt." : "Đã từ chối.");
      setReviewModal(null);
      fetchData();
    } catch (e: any) {
      showAlert("Lỗi", e?.response?.data?.error || "Thao tác thất bại.");
    } finally {
      setActionLoading(null);
    }
  };

  const openReviewModal = (item: ReviewRow, action: "approve" | "reject") => {
    setReviewModal({ type: action, item, adminNote: "" });
  };

  const renderUserHeader = (item: ReviewRow) => (
    <div style={S.cardTop}>
      <div style={S.userInfo}>
        <div style={S.avatar}>
          <span style={S.avatarText}>{item.worker_username?.[0]?.toUpperCase() || "?"}</span>
        </div>
        <div>
          <div style={S.workerName}>{item.worker_name}</div>
          <div style={S.workerUsername}>@{item.worker_username}</div>
        </div>
      </div>
    </div>
  );

  const renderStatusBar = (item: ReviewRow) => {
    const statusColor = STATUS_COLORS[item.status || ""] || COLORS.textMuted;
    return (
      <div style={S.statusBar}>
        <div style={{ ...S.statusBadge, background: `${statusColor}20` }}>
          <div style={{ ...S.statusDot, background: statusColor }} />
          <div style={{ ...S.statusText, color: statusColor }}>{STATUS_LABELS[item.status || ""] || item.status}</div>
        </div>
        <div style={S.timeText}>{item.created_at}</div>
      </div>
    );
  };

  const renderActionRow = (item: ReviewRow) =>
    item.status === "pending" ? (
      <div style={S.actionRow}>
        <Touchable
          style={{
            ...S.actionBtn,
            ...S.approveBtn,
            ...(actionLoading === `${item.id}-approve` ? { opacity: 0.6 } : {}),
          }}
          onPress={() => openReviewModal(item, "approve")}
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
        <Touchable style={{ ...S.actionBtn, ...S.rejectBtn }} onPress={() => openReviewModal(item, "reject")} activeOpacity={0.85}>
          <Icon name="close" size={16} color={COLORS.error} />
          <span style={{ ...S.actionBtnText, color: COLORS.error }}>Từ chối</span>
        </Touchable>
      </div>
    ) : null;

  const renderReviewBox = (item: ReviewRow, label: string) =>
    item.admin_review && item.status !== "pending" ? (
      <div style={S.reviewBox}>
        <div style={S.reviewLabel}>{label}:</div>
        <div style={S.reviewText}>{item.admin_review}</div>
        {label === "Đánh giá admin" && item.reviewed_at && <div style={S.reviewTime}>Đã duyệt: {item.reviewed_at}</div>}
      </div>
    ) : null;

  const renderCredential = (item: ReviewRow) => {
    const photoUrl = absMedia(item.certificate_photo);
    return (
      <div key={String(item.id)} style={S.card}>
        {renderUserHeader(item)}

        {item.description && (
          <div style={S.descBox}>
            <div style={S.descLabel}>Mô tả:</div>
            <div style={S.descText}>{item.description}</div>
          </div>
        )}

        {photoUrl && (
          <div style={S.photoBox}>
            <div style={S.photoLabel}>📸 Ảnh bằng cấp:</div>
            <Touchable
              onPress={() => nav.openModal("ImagePreview", { uri: photoUrl, title: `Bằng cấp - ${item.worker_name}` })}
              activeOpacity={0.85}
            >
              <img src={photoUrl} alt="" style={{ ...S.certImage, objectFit: "contain" }} />
            </Touchable>
          </div>
        )}

        {renderStatusBar(item)}
        {renderActionRow(item)}
        {renderReviewBox(item, "Đánh giá admin")}
      </div>
    );
  };

  const renderProfileChange = (item: ReviewRow) => {
    const changes = item.proposed_changes || {};
    const changeKeys = Object.keys(changes);

    return (
      <div key={String(item.id)} style={S.card}>
        {renderUserHeader(item)}

        <div style={S.changesBox}>
          <div style={S.changesLabel}>📝 Yêu cầu thay đổi:</div>
          {changeKeys.map((key) => (
            <div key={key} style={S.changeRow}>
              <div style={S.changeKey}>{key}:</div>
              <div style={S.changeValue}>{String(changes[key])}</div>
            </div>
          ))}
        </div>

        {renderStatusBar(item)}
        {renderActionRow(item)}
        {renderReviewBox(item, "Ghi chú admin")}
      </div>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden" }}>
      <StatusBarSpacer />

      <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Duyệt hồ sơ & bằng cấp</div>
        <div style={{ marginRight: 8 }}>
          <Icon name="document-text-outline" size={22} color="#fff" />
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          { key: "credentials", label: "Bằng cấp", icon: "ribbon" },
          { key: "profile_changes", label: "Sửa hồ sơ", icon: "create-outline" },
        ].map((tab) => {
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
              <Icon name={tab.icon} size={14} color={isActive ? COLORS.primary : COLORS.textMuted} />
              <div style={{ ...S.tabText, ...(isActive ? S.tabTextActive : {}) }}>{tab.label}</div>
            </Touchable>
          );
        })}
      </div>

      {/* Status filter */}
      <div style={S.filterRow}>
        {["pending", "approved", "rejected", "all"].map((s) => (
          <Touchable
            key={s}
            style={{ ...S.filterChip, ...(statusFilter === s ? S.filterChipActive : {}) }}
            onPress={() => {
              setStatusFilter(s);
              setIsLoading(true);
            }}
          >
            <div style={{ ...S.filterText, ...(statusFilter === s ? S.filterTextActive : {}) }}>
              {s === "all" ? "Tất cả" : s === "pending" ? "Chờ duyệt" : s === "approved" ? "Đã duyệt" : "Từ chối"}
            </div>
          </Touchable>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>
            <div style={S.countText}>{data.length} bản ghi</div>
            {data.length === 0 ? (
              <div style={S.emptyState}>
                <Icon name="checkmark-circle-outline" size={40} color={COLORS.success} />
                <div style={S.emptyText}>Không có bản ghi nào</div>
              </div>
            ) : (
              data.map((item) => (activeTab === "credentials" ? renderCredential(item) : renderProfileChange(item)))
            )}
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewModal && (
        <div
          style={S.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setReviewModal(null);
          }}
        >
          <div style={S.modalContent}>
            <div style={S.modalTitle}>{reviewModal.type === "approve" ? "✅ Duyệt" : "❌ Từ chối"}</div>
            <div style={S.modalHint}>
              {activeTab === "credentials" ? "Bằng cấp" : "Yêu cầu sửa hồ sơ"} của{" "}
              <span style={{ fontWeight: 700 }}>{reviewModal.item?.worker_name}</span>
            </div>
            <div style={S.modalInputLabel}>Ghi chú admin (tuỳ chọn):</div>
            <textarea
              style={S.modalInput}
              value={reviewModal.adminNote || ""}
              onChange={(text) => setReviewModal({ ...reviewModal, adminNote: text.target.value })}
              placeholder="VD: Bằng cấp hợp lệ, đã xác minh."
              maxLength={500}
              rows={3}
            />
            <div style={S.modalActions}>
              <Touchable style={S.modalCancelBtn} onPress={() => setReviewModal(null)}>
                <div style={S.modalCancelText}>Huỷ</div>
              </Touchable>
              <Touchable
                style={{ ...S.modalConfirmBtn, ...(reviewModal.type === "reject" ? { background: COLORS.error } : {}) }}
                onPress={() => handleReview(reviewModal.item, reviewModal.type)}
                disabled={actionLoading !== null}
              >
                {actionLoading ? (
                  <Spinner size={18} color="#fff" />
                ) : (
                  <div style={S.modalConfirmText}>{reviewModal.type === "approve" ? "Duyệt" : "Từ chối"}</div>
                )}
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
    alignItems: "center",
    padding: "0 16px 16px",
    background: COLORS.primary,
    gap: 10,
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
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800, flex: 1 },
  tabs: {
    display: "flex",
    flexDirection: "row",
    background: COLORS.surface,
    padding: "0 16px 12px",
    gap: SIZES.xs,
    borderBottom: `1px solid ${COLORS.border}`,
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
  filterRow: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    padding: "10px 16px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  filterChip: {
    padding: "5px 12px",
    borderRadius: 12,
    background: COLORS.background,
    border: `1px solid ${COLORS.border}`,
  },
  filterChipActive: { background: COLORS.primary, borderColor: COLORS.primary },
  filterText: { ...typo("caption"), color: COLORS.textSecondary, fontWeight: 600 },
  filterTextActive: { color: "#fff", fontWeight: 800 },
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
  cardTop: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userInfo: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  avatarText: { color: "#fff", ...typo("h5"), fontWeight: 800 },
  workerName: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  workerUsername: { ...typo("caption"), color: COLORS.textMuted },
  descBox: {
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  descLabel: { ...typo("overline"), color: COLORS.textMuted, fontWeight: 700 },
  descText: { ...typo("bodySmall"), color: COLORS.textPrimary },
  photoBox: { display: "flex", flexDirection: "column", gap: 6 },
  photoLabel: { ...typo("buttonSmall"), color: COLORS.textSecondary },
  certImage: {
    width: "100%",
    height: 180,
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
    display: "block",
  },
  statusBar: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    padding: "4px 10px",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typo("buttonSmall"), fontWeight: 700 },
  timeText: { ...typo("caption"), color: COLORS.textMuted },
  actionRow: { display: "flex", flexDirection: "row", gap: 8 },
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
  actionBtnText: { ...typo("buttonSmall"), fontWeight: 700 },
  reviewBox: {
    background: "#FFFBEB",
    borderRadius: SIZES.radiusSm,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderLeft: `3px solid ${COLORS.warning}`,
  },
  reviewLabel: { ...typo("overline"), color: COLORS.warning, fontWeight: 700 },
  reviewText: { ...typo("bodySmall"), color: COLORS.textPrimary },
  reviewTime: { ...typo("caption"), color: COLORS.textMuted, fontStyle: "italic" },
  changesBox: {
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  changesLabel: { ...typo("overline"), color: COLORS.textMuted, fontWeight: 700, marginBottom: 4 },
  changeRow: { display: "flex", flexDirection: "row", gap: 8, paddingTop: 2, paddingBottom: 2 },
  changeKey: { ...typo("bodySmall"), color: COLORS.textSecondary, fontWeight: 600, minWidth: 100 },
  changeValue: { ...typo("body"), color: COLORS.primary, fontWeight: 700, wordBreak: "break-word" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, paddingBottom: 60, gap: 12 },
  emptyText: { ...typo("body"), color: COLORS.textMuted },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 300,
    display: "flex",
  },
  modalContent: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: 20,
    boxShadow: SHADOWS.large,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: { ...typo("h4"), color: COLORS.textPrimary, marginBottom: 8 },
  modalHint: { ...typo("bodySmall"), color: COLORS.textSecondary, marginBottom: 16 },
  modalInputLabel: { ...typo("buttonSmall"), color: COLORS.textSecondary, marginBottom: 4 },
  modalInput: {
    width: "100%",
    minHeight: 80,
    border: `1px solid ${COLORS.border}`,
    borderRadius: SIZES.radiusSm,
    padding: "10px 12px",
    ...TYPO.body,
    lineHeight: "22px",
    color: COLORS.textPrimary,
    background: "#fff",
    outline: "none",
    resize: "vertical",
  },
  modalActions: { display: "flex", flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 },
  modalCancelBtn: {
    padding: "10px 16px",
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
  },
  modalCancelText: { ...typo("button"), color: COLORS.textSecondary },
  modalConfirmBtn: {
    padding: "10px 20px",
    borderRadius: SIZES.radiusSm,
    background: COLORS.success,
    boxShadow: SHADOWS.small,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { ...typo("button"), color: "#fff" },
};

export default AdminReviewScreen;
