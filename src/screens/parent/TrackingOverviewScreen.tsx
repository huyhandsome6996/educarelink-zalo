/**
 * TrackingOverviewScreen — port CHÍNH XÁC mobile/src/screens/Parent/TrackingOverviewScreen.js (453 dòng).
 * Tab "Theo dõi" của Phụ huynh — tổng hợp các task đang in_progress, mỗi task có
 * CTA "Theo dõi trực tiếp" → LiveTracking với taskId. Empty state tử tế khi trống.
 *
 * Dữ liệu: getMyTasksAsParent() (/parent/my-tasks/) — lọc status 'in_progress' như RN.
 * KHÔNG polling dữ liệu ở màn này trong RN (chỉ NotificationBell poll 30s — đã có trong ui.tsx),
 * fetch 1 lần khi mount + refetch khi pull-to-refresh (RN RefreshControl).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web; màn fetch lại khi mount/focus.
 * - Animated fade + translateY card mount → CSS transition 250ms (ANIM.timingNormal).
 * - NotificationBell RN bản này render icon trắng (kontrast thấp trên app bar trắng);
 *   dùng NotificationBell của ui.tsx (variant plain — icon primary) theo yêu cầu port.
 * - Empty CTA: theo spec task → nav JobTypeSelect (bản RN navigate('ParentHome')).
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, StatusBarSpacer, Screen, NotificationBell } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, TYPO, ANIM } from "@/theme";
import { useNav } from "@/navigation/router";
import { getMyTasksAsParent } from "@/api/tasks";

// Map status → label/icon (sync với MyTasksScreen)
const STATUS_INFO: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  in_progress: {
    label: "Đang diễn ra",
    icon: "locate",
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  tutoring: "Gia sư",
  pickup: "Đưa đón",
  sitting: "Đồng hành cùng trẻ",
  extracurricular: "Ngoại khoá",
};

/** Icon thiếu glyph → glyph gần nhất cùng nghĩa (không được sửa ionicons.ts) */
const ic = (name: string) =>
  ({ "add-circle-outline": "add-circle" } as Record<string, string>)[name] ?? name;

interface TrackTask {
  id?: number | string;
  title?: string;
  status?: string;
  category?: string;
  address?: string;
  caretaker_name?: string;
  caretaker?: { full_name?: string };
}

const TrackingOverviewScreen: React.FC = () => {
  const nav = useNav();
  const [tasks, setTasks] = useState<TrackTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fade-in animation (RN Animated.timing 250ms → CSS transition)
  const [faded, setFaded] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => {
      cancelAnimationFrame(r);
      mountedRef.current = false;
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = (await getMyTasksAsParent()) as any;
      // Chỉ giữ lại task in_progress — tab này dành cho theo dõi trực tiếp
      const inProgress = (res || []).filter((t: TrackTask) => t.status === "in_progress");
      if (mountedRef.current) setTasks(inProgress);
    } catch (e) {
      console.error("TrackingOverview fetch error:", e);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = useCallback(() => {
    // RN: RefreshControl pull-to-refresh — web không có; giữ logic refetch
    setRefreshing(true);
    fetchTasks();
  }, [fetchTasks]);

  const handleTrackTask = (task: TrackTask) => {
    nav.navigate("LiveTracking", { taskId: task.id });
  };

  const caretakerNameOf = (item: TrackTask) =>
    item.caretaker_name || item.caretaker?.full_name || "CarePartner";

  const renderEmpty = () => (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 32px 24px",
      }}
    >
      <div style={TS.emptyIconWrap}>
        <Icon name="locate-outline" size={56} color={COLORS.primary} />
      </div>
      <div style={{ ...TS.emptyTitle, ...TYPO.h2, lineHeight: "28px", marginBottom: 8 }}>Chưa có nhiệm vụ nào đang theo dõi</div>
      <div
        style={{
          ...TYPO.body,
          lineHeight: "22px",
          color: COLORS.onSurfaceVariant,
          textAlign: "center",
          marginBottom: 24,
          maxWidth: 280,
        }}
      >
        Khi có CarePartner bắt đầu thực hiện nhiệm vụ của bạn, bạn sẽ thấy danh sách theo dõi trực
        tiếp tại đây.
      </div>
      {/* RN navigate('ParentHome') — theo spec task 5-c chuyển thẳng vào luồng tạo việc */}
      <Touchable
        onPress={() => nav.navigate("JobTypeSelect")}
        activeOpacity={0.9}
        style={TS.emptyCta}
      >
        <Icon name={ic("add-circle-outline")} size={18} color={COLORS.textOnPrimary} />
        <span style={TS.emptyCtaText}>Tạo nhiệm vụ mới</span>
      </Touchable>
    </div>
  );

  return (
    <Screen bg={COLORS.surfaceWarm} scroll={false}>
      <StatusBarSpacer />
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
        {/* Top App Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 12px",
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.outlineVariant}`,
          }}
        >
          <div style={{ width: 44 }} />
          <div style={{ ...TYPO.h3, lineHeight: "24px", color: COLORS.onSurface, fontWeight: 700 }}>Theo dõi</div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: 44, justifyContent: "flex-end" }}>
            <NotificationBell variant="plain" />
          </div>
        </div>

        {/* Summary banner */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            background: COLORS.primaryLight,
            borderBottom: `1px solid ${COLORS.outlineVariant}`,
          }}
        >
          <Icon name="information-circle-outline" size={18} color={COLORS.primary} />
          <span style={{ ...TYPO.caption, lineHeight: "16px", color: COLORS.onSurfaceVariant, fontWeight: 500, flex: 1 }}>
            {tasks.length > 0
              ? `${tasks.length} nhiệm vụ đang được theo dõi trực tiếp`
              : "Không có nhiệm vụ nào đang được theo dõi"}
          </span>
        </div>

        {isLoading ? (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Spinner size={30} color={COLORS.primary} />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              // RN listContent: paddingHorizontal 20, paddingTop 20, paddingBottom 40 (+84 TabBar fixed)
              padding: "20px 20px 124px",
              opacity: faded ? 1 : 0,
              transform: faded ? "translateY(0)" : "translateY(12px)",
              transition: `opacity ${ANIM.timingNormal}ms, transform ${ANIM.timingNormal}ms`,
            }}
          >
            {tasks.length === 0
              ? renderEmpty()
              : tasks.map((item, index) => {
                  const statusInfo = STATUS_INFO[item.status || ""] || STATUS_INFO.in_progress;
                  const categoryLabel = CATEGORY_LABELS[item.category || ""] || item.category || "Dịch vụ";
                  return (
                    <div
                      key={String(item.id)}
                      style={{
                        ...TS.taskCard,
                        marginBottom: index === tasks.length - 1 ? 0 : SIZES.md,
                      }}
                    >
                      {/* Header row: category + status pill */}
                      <div style={TS.cardHeader}>
                        <div style={TS.categoryRow}>
                          <div style={TS.categoryIconBox}>
                            <Icon name="location" size={16} color={COLORS.primary} />
                          </div>
                          <div
                            style={{
                              ...TYPO.caption,
                              color: COLORS.onSurfaceVariant,
                              fontWeight: 600,
                              flex: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {categoryLabel}
                          </div>
                        </div>
                        <div
                          style={{
                            ...TS.statusPill,
                            background: statusInfo.bg,
                            borderRadius: SIZES.radiusFull,
                          }}
                        >
                          <Icon name={statusInfo.icon} size={12} color={statusInfo.color} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color }}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Title + address */}
                      <div
                        style={{
                          ...TYPO.h3,
                          lineHeight: "24px",
                          color: COLORS.onSurface,
                          fontWeight: 700,
                          marginBottom: 6,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.title || "Nhiệm vụ không có tiêu đề"}
                      </div>
                      {item.address ? (
                        <div style={TS.addressRow}>
                          <Icon name="location-outline" size={14} color={COLORS.outline} />
                          <span
                            style={{
                              ...TYPO.caption,
                              lineHeight: "16px",
                              color: COLORS.outline,
                              flex: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.address}
                          </span>
                        </div>
                      ) : null}

                      {/* CarePartner info */}
                      <div style={TS.caretakerRow}>
                        <div style={TS.caretakerAvatar}>
                          <Icon name="person" size={16} color={COLORS.primary} />
                        </div>
                        <span
                          style={{
                            ...TYPO.body,
                            lineHeight: "22px",
                            color: COLORS.onSurface,
                            fontWeight: 600,
                            flex: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {caretakerNameOf(item)}
                        </span>
                        <span style={TS.liveDot} />
                        <span style={{ fontSize: 11, color: COLORS.success, fontWeight: 700 }}>Đang thực hiện</span>
                      </div>

                      {/* CTA: Theo dõi trực tiếp */}
                      <Touchable
                        onPress={() => handleTrackTask(item)}
                        activeOpacity={0.9}
                        style={TS.trackBtn}
                      >
                        <Icon name="navigate" size={18} color={COLORS.textOnPrimary} />
                        <span style={TS.trackBtnText}>Theo dõi trực tiếp</span>
                        <Icon name="chevron-forward" size={16} color={COLORS.textOnPrimary} />
                      </Touchable>
                    </div>
                  );
                })}
          </div>
        )}
      </div>
    </Screen>
  );
};

/* ============ Stylesheet (1:1 với RN styles) ============ */
const TS: Record<string, React.CSSProperties> = {
  // === TASK CARD ===
  taskCard: {
    background: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  cardHeader: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  categoryRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  categoryIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  statusPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: "4px 10px",
    flexShrink: 0,
  },
  addressRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  caretakerRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTop: `1px solid ${COLORS.outlineVariant}`,
    marginBottom: 12,
  },
  caretakerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, background: COLORS.success, flexShrink: 0 },
  // === TRACK BUTTON ===
  trackBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: COLORS.primary,
    padding: "12px 0",
    borderRadius: 14,
    boxShadow: SHADOWS.large,
  },
  trackBtnText: {
    ...TYPO.body,
    lineHeight: "22px",
    color: COLORS.textOnPrimary,
    fontWeight: 700,
    flex: 1,
    textAlign: "center",
  },
  // === EMPTY STATE ===
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: { color: COLORS.onSurface, textAlign: "center" },
  emptyCta: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: COLORS.primary,
    padding: "12px 24px",
    borderRadius: 14,
    boxShadow: SHADOWS.large,
  },
  emptyCtaText: { ...TYPO.body, lineHeight: "22px", color: COLORS.textOnPrimary, fontWeight: 700 },
};

export default TrackingOverviewScreen;
