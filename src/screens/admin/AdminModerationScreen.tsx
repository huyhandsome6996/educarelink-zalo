/**
 * AdminModerationScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminModerationScreen.js (208 dòng).
 * 2 tab: "Kiểm duyệt" (getModerationQueue('needs_review') + overrideModeration
 * admin_approved/admin_rejected) và "Khiếu nại" (getComplaints('pending') +
 * aiAnalyzeComplaint + resolveComplaint resolved/dismissed).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web; refetch khi đổi tab.
 * - Alert.alert 2 nút (Huỷ / Xác nhận) → window.confirm 2 nút.
 * - Alert.alert 1 nút → showAlert (window.alert).
 * - overrideModeration zalo API có tham số adminNote — RN mặc định '' → truyền ''.
 * - Icon thiếu glyph: checkmark-done-outline→checkmark-circle-outline (bộ 159 glyph).
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, NotificationBell, useStatusBarHeight } from "@/components/ui";
import { COLORS, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getModerationQueue, overrideModeration, getComplaints, resolveComplaint, aiAnalyzeComplaint } from "@/api/misc";

const TABS = [
  { key: "moderation", label: "Kiểm duyệt", icon: "shield-checkmark-outline" },
  { key: "complaints", label: "Khiếu nại", icon: "alert-circle-outline" },
];

interface ModerationRow {
  id: number | string;
  task?: number | string;
  task_title?: string;
  ai_verdict?: string;
  ai_suggestion?: string;
}

interface ComplaintRow {
  id: number | string;
  complaint_type?: string;
  title?: string;
  description?: string;
  complainant_name?: string;
  reported_user_name?: string;
  ai_analyzed?: boolean;
  ai_priority?: string;
  ai_analysis?: string;
}

type QueueRow = ModerationRow & ComplaintRow;

const AdminModerationScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [activeTab, setActiveTab] = useState("moderation");
  const [data, setData] = useState<QueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      if (activeTab === "moderation") {
        const res = await getModerationQueue("needs_review");
        setData(res.data || []);
      } else {
        const res = await getComplaints("pending");
        setData(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [activeTab, fetchData]);

  const handleOverride = (id: number | string, status: string) => {
    const ok = window.confirm(
      `${status === "admin_approved" ? "Duyệt công việc" : "Từ chối công việc"}\n\n${
        status === "admin_approved" ? "Cho phép công việc này hiển thị?" : "Từ chối công việc này?"
      }`
    );
    if (!ok) return;
    (async () => {
      try {
        await overrideModeration(id, status, "");
        showAlert("✅ Đã xử lý");
        fetchData();
      } catch (e) {
        showAlert("Lỗi", "Không thể xử lý.");
      }
    })();
  };

  const handleResolve = (id: number | string, status: string) => {
    const ok = window.confirm(
      `${status === "resolved" ? "Giải quyết khiếu nại" : "Bác bỏ khiếu nại"}\n\nXác nhận?`
    );
    if (!ok) return;
    (async () => {
      try {
        await resolveComplaint(id, { status, admin_response: "" });
        showAlert("✅ Đã xử lý");
        fetchData();
      } catch (e) {
        showAlert("Lỗi", "Không thể xử lý.");
      }
    })();
  };

  const handleAIAnalyze = async (id: number | string) => {
    try {
      await aiAnalyzeComplaint(id);
      showAlert("✅ AI đã phân tích xong");
      fetchData();
    } catch (e) {
      showAlert("Lỗi", "AI không khả dụng.");
    }
  };

  const renderItem = (item: QueueRow) => {
    if (activeTab === "moderation") {
      return (
        <div key={String(item.id)} style={S.card}>
          <div style={S.cardHeader}>
            <div style={{ ...S.statusBadge, ...S.statusNeedsReview }}>
              <span style={S.statusBadgeText}>Cần duyệt</span>
            </div>
          </div>
          <div style={S.cardTitle}>{item.task_title || `Task #${item.task}`}</div>
          <div style={S.cardDesc}>AI: {item.ai_verdict || "Chưa có"}</div>
          {item.ai_suggestion ? <div style={S.cardSuggestion}>💡 {item.ai_suggestion}</div> : null}
          <div style={S.cardActions}>
            <Touchable style={{ ...S.actionBtn, ...S.approveBtn }} onPress={() => handleOverride(item.id, "admin_approved")}>
              <Icon name="checkmark" size={16} color="#fff" />
              <span style={S.actionBtnTextWhite}>Duyệt</span>
            </Touchable>
            <Touchable style={{ ...S.actionBtn, ...S.rejectBtn }} onPress={() => handleOverride(item.id, "admin_rejected")}>
              <Icon name="close" size={16} color={COLORS.error} />
              <span style={S.actionBtnTextRed}>Từ chối</span>
            </Touchable>
          </div>
        </div>
      );
    }
    return (
      <div key={String(item.id)} style={S.card}>
        <div style={S.cardHeader}>
          <div style={{ ...S.statusBadge, ...S.statusPending }}>
            <span style={S.statusBadgeText}>{item.complaint_type}</span>
          </div>
          {item.ai_analyzed && (
            <div style={{ ...S.statusBadge, ...S.statusAI }}>
              <span style={S.statusBadgeText}>AI: {item.ai_priority}</span>
            </div>
          )}
        </div>
        <div style={S.cardTitle}>{item.title}</div>
        <div style={S.cardDesc}>{item.description?.substring(0, 100)}</div>
        <div style={S.cardMeta}>
          Từ: {item.complainant_name} → {item.reported_user_name}
        </div>
        {item.ai_analysis ? <div style={S.cardSuggestion}>🤖 {item.ai_analysis}</div> : null}
        <div style={S.cardActions}>
          {!item.ai_analyzed && (
            <Touchable style={{ ...S.actionBtn, ...S.aiBtn }} onPress={() => handleAIAnalyze(item.id)}>
              <Icon name="sparkles" size={14} color={COLORS.primary} />
              <span style={S.actionBtnTextPrimary}>AI phân tích</span>
            </Touchable>
          )}
          <Touchable style={{ ...S.actionBtn, ...S.approveBtn }} onPress={() => handleResolve(item.id, "resolved")}>
            <Icon name="checkmark" size={16} color="#fff" />
            <span style={S.actionBtnTextWhite}>Giải quyết</span>
          </Touchable>
          <Touchable style={{ ...S.actionBtn, ...S.rejectBtn }} onPress={() => handleResolve(item.id, "dismissed")}>
            <Icon name="close" size={16} color={COLORS.error} />
            <span style={S.actionBtnTextRed}>Bác</span>
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
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Kiểm duyệt & Khiếu nại</div>
        <NotificationBell />
      </div>
      <div style={S.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Touchable
              key={tab.key}
              style={{ ...S.tab, ...(isActive ? S.tabActive : {}) }}
              onPress={() => setActiveTab(tab.key)}
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
            {data.length === 0 ? (
              <div style={S.empty}>
                <div style={S.emptyIconCircle}>
                  <Icon name="checkmark-circle-outline" size={40} color={COLORS.primary} />
                </div>
                <div style={S.emptyTitle}>Không có mục nào</div>
                <div style={S.emptyText}>{activeTab === "moderation" ? "Tất cả task đã được duyệt" : "Không có khiếu nại nào"}</div>
              </div>
            ) : (
              data.map(renderItem)
            )}
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
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800, flex: 1, marginLeft: 12 },
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
  tabActive: { background: COLORS.primaryLight },
  tabText: { ...typo("buttonSmall"), color: COLORS.textMuted, fontWeight: 600 },
  tabTextActive: { color: COLORS.primary, fontWeight: 800 },
  list: { padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    borderLeft: `4px solid ${COLORS.warning}`,
  },
  cardHeader: { display: "flex", flexDirection: "row", gap: 6, alignItems: "center" },
  statusBadge: { borderRadius: SIZES.radiusXs, padding: "3px 8px" },
  statusNeedsReview: { background: COLORS.warningBg },
  statusPending: { background: COLORS.errorBg },
  statusAI: { background: COLORS.primaryLight },
  statusBadgeText: { ...typo("overline"), fontWeight: 700, color: COLORS.textPrimary },
  cardTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  cardDesc: { ...typo("bodySmall"), color: COLORS.textSecondary, lineHeight: "18px" },
  cardSuggestion: { ...typo("caption"), color: COLORS.primary, fontStyle: "italic", lineHeight: "16px" },
  cardMeta: { ...typo("caption"), color: COLORS.textMuted },
  cardActions: { display: "flex", flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: SIZES.radiusSm,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  approveBtn: { background: COLORS.success },
  rejectBtn: { background: COLORS.errorBg, border: "1px solid #fecaca" },
  aiBtn: { background: COLORS.primaryLight, border: `1px solid ${COLORS.primarySoft}` },
  actionBtnTextWhite: { color: "#fff", ...typo("buttonSmall") },
  actionBtnTextRed: { color: COLORS.error, ...typo("buttonSmall") },
  actionBtnTextPrimary: { color: COLORS.primary, ...typo("buttonSmall") },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { ...typo("h4"), color: COLORS.textPrimary },
  emptyText: { ...typo("bodySmall"), color: COLORS.textMuted },
};

export default AdminModerationScreen;
