/**
 * MyComplaintsScreen — port CHÍNH XÁC mobile/src/screens/Worker/MyComplaintsScreen.js (310 dòng).
 * List khiếu nại worker đã gửi + status (pending/investigating/resolved/dismissed),
 * AI analysis, admin response, evidence thumbnails (expo-image → <img>),
 * nút "Tạo khiếu nại mới" → modal Complaint.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar light-content trên nền primary → StatusBarSpacer; header paddingTop
 *    56 của RN (gồm status bar) → StatusBarSpacer + paddingTop 12.
 *  - useFocusEffect/useEffect mount → fetch khi mount (router chỉ render
 *    top-of-stack nên mount == focus); RefreshControl (kéo làm mới) không có
 *    trên web — bỏ, dữ liệu vẫn tự tải khi mở màn.
 *  - navigation.navigate('ImagePreview'/'Complaint') với presentation:'modal'
 *    → nav.openModal(...) (router MODAL_ROUTES render phủ toàn màn, không tab bar).
 *  - expo-image Image → <img>; numberOfLines → CSS line-clamp.
 *  - Icon thiếu glyph → alias cục bộ: documents→document-text,
 *    documents-outline→document-text-outline, videocam→play, document→document-text.
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getMyComplaints } from "@/api/misc";

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  documents: "document-text",
  "documents-outline": "document-text-outline",
  videocam: "play",
  document: "document-text",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  exploitation: "Bóc lột",
  abuse: "Ngược đãi",
  harassment: "Quấy rối",
  non_payment: "Không trả tiền",
  fraud: "Gian lận",
  unsafe: "Không an toàn",
  other: "Khác",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  investigating: "Đang điều tra",
  resolved: "Đã giải quyết",
  dismissed: "Bị bác bỏ",
};

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  investigating: COLORS.info,
  resolved: COLORS.success,
  dismissed: COLORS.textMuted,
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

/** numberOfLines RN → CSS line-clamp */
const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: n,
  overflow: "hidden",
});

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
    padding: "12px 16px 16px",
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
  },
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800, flex: 1 },
  actionBar: {
    background: COLORS.surface,
    padding: "10px 16px",
    borderBottom: `1px solid ${COLORS.border}`,
  },
  newComplaintBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    padding: "12px 0",
    boxShadow: SHADOWS.small,
  },
  newComplaintText: { color: "#fff", ...typo("button") },
  countText: { ...typo("overline"), color: COLORS.textMuted, marginBottom: 4 },
  card: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    gap: 10,
    borderLeft: `4px solid ${COLORS.error}`,
    boxShadow: SHADOWS.cardHover,
    display: "flex",
    flexDirection: "column",
  },
  cardTop: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.errorBg,
    borderRadius: 10,
    padding: "3px 8px",
  },
  typeText: { color: COLORS.error, fontSize: 10, fontWeight: 800, letterSpacing: 0.8 },
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
  complaintTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  complaintDesc: { ...typo("bodySmall", { lineHeight: "20px" }), color: COLORS.textSecondary },
  taskRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  taskText: { ...typo("caption"), color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.5 },
  metaRow: { display: "flex", flexDirection: "row", gap: 14, flexWrap: "wrap" },
  metaItem: { display: "flex", flexDirection: "column", gap: 2 },
  metaLabel: { ...typo("overline"), color: COLORS.textMuted, fontWeight: 600 },
  metaValue: { ...typo("bodySmall"), color: COLORS.textPrimary },
  aiBox: {
    background: "#EFF6FF",
    borderRadius: SIZES.radiusSm,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    borderLeft: `3px solid ${COLORS.info}`,
  },
  aiHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  aiLabel: { ...typo("buttonSmall"), color: COLORS.info, fontWeight: 700 },
  aiText: { ...typo("bodySmall"), color: COLORS.textPrimary },
  aiSuggestionBox: {
    background: "#FFFBEB",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  aiSuggestionLabel: { ...typo("overline"), color: COLORS.warning, fontWeight: 700 },
  aiSuggestionText: { ...typo("bodySmall"), color: COLORS.textPrimary },
  adminBox: {
    background: "#ECFDF5",
    borderRadius: SIZES.radiusSm,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    borderLeft: `3px solid ${COLORS.success}`,
  },
  adminHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  adminLabel: { ...typo("buttonSmall"), color: COLORS.success, fontWeight: 700 },
  adminText: { ...typo("bodySmall"), color: COLORS.textPrimary },
  adminTime: { ...typo("caption"), color: COLORS.textMuted, fontStyle: "italic" },
  evidenceRow: { display: "flex", flexDirection: "row", gap: 8, overflowX: "auto" },
  evidenceThumb: {
    width: 80,
    height: 80,
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
    objectFit: "cover",
  },
  evidenceFile: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    border: `1px solid ${COLORS.border}`,
    gap: 4,
  },
  evidenceFileText: { ...typo("caption"), color: COLORS.primary, fontWeight: 700 },
  createdAt: { ...typo("caption"), color: COLORS.textMuted, fontStyle: "italic" },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 0",
    gap: 12,
  },
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
  emptyTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  emptyText: { ...typo("bodySmall"), color: COLORS.textMuted, textAlign: "center" },
};

const MyComplaintsScreen: React.FC = () => {
  const nav = useNav();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res: any = await getMyComplaints();
      setComplaints(res || []);
    } catch (e) {
      console.error("getMyComplaints error:", e);
      showAlert("Lỗi", "Không tải được danh sách khiếu nại.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const renderItem = (item: any) => {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textMuted;
    const priorityColor =
      item.priority === "urgent"
        ? COLORS.error
        : item.priority === "high"
        ? COLORS.warning
        : item.priority === "medium"
        ? COLORS.info
        : COLORS.textMuted;

    return (
      <div style={S.card}>
        <div style={S.cardTop}>
          <div style={S.typeBadge}>
            <Icon name="alert-circle" size={14} color={COLORS.error} />
            <div style={S.typeText}>
              {COMPLAINT_TYPE_LABELS[item.complaint_type] || item.complaint_type}
            </div>
          </div>
          <div style={{ ...S.statusBadge, background: statusColor + "20" }}>
            <div style={{ ...S.statusDot, background: statusColor }} />
            <div style={{ ...S.statusText, color: statusColor }}>
              {STATUS_LABELS[item.status] || item.status}
            </div>
          </div>
        </div>

        <div style={S.complaintTitle}>{item.title}</div>
        <div style={{ ...S.complaintDesc, ...clamp(3) }}>{item.description}</div>

        {item.task_title && (
          <div style={S.taskRow}>
            <Icon name="briefcase-outline" size={12} color={COLORS.textMuted} />
            <div style={S.taskText}>{item.task_title}</div>
          </div>
        )}

        <div style={S.metaRow}>
          <div style={S.metaItem}>
            <div style={S.metaLabel}>Ưu tiên:</div>
            <div style={{ ...S.metaValue, color: priorityColor, fontWeight: 700 }}>
              {PRIORITY_LABELS[item.priority] || item.priority}
            </div>
          </div>
          <div style={S.metaItem}>
            <div style={S.metaLabel}>Người bị KN:</div>
            <div style={S.metaValue}>@{item.reported_user_name}</div>
          </div>
          <div style={S.metaItem}>
            <div style={S.metaLabel}>Bằng chứng:</div>
            <div style={S.metaValue}>{item.evidence?.length || 0} file</div>
          </div>
        </div>

        {/* AI Analysis (nếu có) */}
        {item.ai_analysis && (
          <div style={S.aiBox}>
            <div style={S.aiHeader}>
              <Icon name="sparkles" size={14} color={COLORS.primary} />
              <div style={S.aiLabel}>AI phân tích</div>
            </div>
            <div style={S.aiText}>{item.ai_analysis}</div>
            {item.ai_suggestion && (
              <div style={S.aiSuggestionBox}>
                <div style={S.aiSuggestionLabel}>💡 Gợi ý AI:</div>
                <div style={S.aiSuggestionText}>{item.ai_suggestion}</div>
              </div>
            )}
          </div>
        )}

        {/* Admin response */}
        {item.admin_response && (
          <div style={S.adminBox}>
            <div style={S.adminHeader}>
              <Icon name="shield-checkmark" size={14} color={COLORS.success} />
              <div style={S.adminLabel}>Phản hồi admin</div>
            </div>
            <div style={S.adminText}>{item.admin_response}</div>
            {item.resolved_at && (
              <div style={S.adminTime}>
                Xử lý lúc: {item.resolved_at?.replace("T", " ").slice(0, 19)}
              </div>
            )}
          </div>
        )}

        {/* Evidence */}
        {item.evidence && item.evidence.length > 0 && (
          <div style={S.evidenceRow}>
            {item.evidence.map((ev: any) => (
              <Touchable
                key={ev.id}
                onPress={() =>
                  nav.openModal("ImagePreview", { uri: ev.file, title: `Bằng chứng #${ev.id}` })
                }
              >
                {ev.evidence_type === "image" ? (
                  <img src={ev.file} style={S.evidenceThumb} alt="" />
                ) : (
                  <div style={{ ...S.evidenceThumb, ...S.evidenceFile }}>
                    <Icon
                      name={ic(ev.evidence_type === "video" ? "videocam" : "document")}
                      size={20}
                      color={COLORS.primary}
                    />
                    <div style={S.evidenceFileText}>{ev.evidence_type}</div>
                  </div>
                )}
              </Touchable>
            ))}
          </div>
        )}

        <div style={S.createdAt}>Gửi lúc: {item.created_at?.replace("T", " ").slice(0, 19)}</div>
      </div>
    );
  };

  return (
    <div style={S.container}>
      <StatusBarSpacer />

      <div style={S.header}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Khiếu nại của tôi</div>
        <Icon name={ic("documents")} size={22} color="#fff" style={{ marginRight: 8 }} />
      </div>

      <div style={S.actionBar}>
        <Touchable
          style={S.newComplaintBtn}
          onPress={() => nav.openModal("Complaint")}
          activeOpacity={0.85}
        >
          <Icon name="add-circle" size={18} color="#fff" />
          <div style={S.newComplaintText}>Tạo khiếu nại mới</div>
        </Touchable>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: 16, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={S.countText}>{complaints.length} khiếu nại</div>
            {complaints.length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.emptyIconCircle}>
                  <Icon name={ic("documents-outline")} size={40} color={COLORS.primary} />
                </div>
                <div style={S.emptyTitle}>Chưa có khiếu nại</div>
                <div style={{ ...S.emptyText, maxWidth: 280 }}>
                  Nếu bạn gặp vấn đề với phụ huynh, hãy tạo khiếu nại để admin hỗ trợ.
                </div>
              </div>
            ) : (
              complaints.map((item: any) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyComplaintsScreen;
