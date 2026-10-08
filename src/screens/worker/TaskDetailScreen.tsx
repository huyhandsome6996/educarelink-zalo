/**
 * TaskDetailScreen — port CHÍNH XÁC mobile/src/screens/Worker/TaskDetailScreen.js (313 dòng).
 * Chi tiết công việc LEGACY (Task, không phải Booking) cho CarePartner:
 *  - getTaskDetail(taskId) + getMyJobsAsWorker() để kiểm tra đã ứng tuyển
 *  - Banner kiểm duyệt AI (moderation_status !== 'approved' → getTaskModeration)
 *  - Hero (category tag + title + price), info grid 4 ô, mô tả
 *  - Bottom CTA: QA 2026-09-10 #2 — luồng thụ động kiểu Grab: CarePartner KHÔNG tự
 *    ứng tuyển (backend từ chối apply 403 passive_matching_only), nút duy nhất dẫn
 *    tới "XEM ĐƠN ĐƯỢC GIAO" (MyBookings) — đúng hành vi RN hiện tại.
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar dark-content → StatusBarSpacer; header paddingTop 56 của RN =
 *    StatusBarSpacer + 8px (tổng chiều cao thanh trạng thái + đệm).
 *  - theme/categoryIcons.js (renderCategoryIcon) port NỘI TẠY (8 danh mục Ionicons).
 *  - Icon "shield-outline" không có glyph → alias "shield".
 */
import React, { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, TYPO } from "@/theme";
import { useNav } from "@/navigation/router";
import { getTaskDetail, getMyJobsAsWorker } from "@/api/tasks";
import { getTaskModeration } from "@/api/misc";

/* ── Alias icon ── */
const ICON_ALIAS: Record<string, string> = {
  "shield-outline": "shield",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/* ── theme/categoryIcons.js — port nội tệy (chỉ phần dùng trong màn này) ── */
const CATEGORY_ICONS: Record<number, { icon: string; name: string; color: string; bg: string }> = {
  1: { icon: "book", name: "Gia sư", color: COLORS.primary, bg: COLORS.primaryLight },
  2: { icon: "happy", name: "Đón trẻ", color: COLORS.primary, bg: COLORS.primaryLight },
  3: { icon: "sparkles", name: "Dọn dẹp", color: COLORS.primary, bg: COLORS.primaryLight },
  4: { icon: "people", name: "Đồng hành cùng trẻ", color: COLORS.primary, bg: COLORS.primaryLight },
  5: { icon: "bag", name: "Mua sắm hộ", color: COLORS.primary, bg: COLORS.primaryLight },
  6: { icon: "restaurant", name: "Nấu ăn", color: COLORS.primary, bg: COLORS.primaryLight },
  7: { icon: "cube", name: "Chuyển đồ", color: COLORS.primary, bg: COLORS.primaryLight },
  8: { icon: "apps", name: "Khác", color: COLORS.primary, bg: COLORS.primaryLight },
};

/** Helper render icon cho category — giống renderCategoryIcon của RN */
function renderCategoryIcon(categoryId: number, size = 28, color: string | null = null) {
  const cat = CATEGORY_ICONS[categoryId] || CATEGORY_ICONS[8];
  const iconColor = color || cat.color;
  return <Icon name={cat.icon} size={size} color={iconColor} />;
}

// QA 2026-09-10 #1: chỉ 3 danh mục chuẩn
const CATEGORIES = [
  { id: 1, name: "Gia sư", color: COLORS.primary, bg: COLORS.primaryLight },
  { id: 2, name: "Đón trẻ", color: COLORS.primary, bg: COLORS.primaryLight },
  { id: 4, name: "Đồng hành cùng trẻ", color: COLORS.primary, bg: COLORS.primaryLight },
];

/* ── Styles — chuyển 1:1 từ StyleSheet của RN ── */
const ST: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: COLORS.background },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 16px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: COLORS.surfaceAlt,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  headerTitle: { ...TYPO.h4, color: COLORS.textPrimary, fontWeight: 800 },
  headerSpacer: { width: 44 },

  // === MODERATION BANNER ===
  moderationBanner: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    background: COLORS.warningBg,
    padding: 12,
    borderBottom: "1px solid #fde68a",
  },
  moderationText: {
    flex: 1,
    ...TYPO.bodySmall,
    color: COLORS.warning,
    lineHeight: "20px",
    fontWeight: 600,
  },

  // === HERO ===
  hero: {
    background: COLORS.surfaceAlt,
    padding: 24,
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  categoryTag: {
    alignSelf: "flex-start",
    borderRadius: SIZES.radiusSm,
    padding: "6px 12px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    background: COLORS.primaryLight,
    boxShadow: SHADOWS.small,
  },
  categoryTagText: { ...TYPO.caption, color: COLORS.primary },
  title: { ...TYPO.h2, color: COLORS.textPrimary },
  price: { ...TYPO.h1, fontSize: "28px", color: COLORS.primary },

  // === INFO GRID ===
  infoGrid: {
    padding: SIZES.md,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoCard: {
    width: "47%",
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    boxShadow: SHADOWS.cardHover,
  },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: COLORS.surfaceAlt,
  },
  infoLabel: { ...TYPO.overline, color: COLORS.textMuted },
  infoValue: { ...TYPO.bodySmall, color: COLORS.textPrimary, fontWeight: 700 },

  // === DESCRIPTION ===
  descSection: {
    margin: SIZES.md,
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: SHADOWS.small,
    borderLeft: `3px solid ${COLORS.primary}`,
  },
  descTitle: { ...TYPO.h4, color: COLORS.textPrimary, fontWeight: 900 },
  descText: { ...TYPO.body, color: COLORS.textSecondary },

  // === FOOTER ===
  footer: {
    padding: "20px 20px 36px",
    background: COLORS.surface,
    borderTop: `1px solid ${COLORS.border}`,
  },
  applyBtn: {
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 56,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    boxShadow: SHADOWS.large,
  },
  applyBtnText: { color: "#fff", ...TYPO.button, letterSpacing: "0.5px" },
};

const TaskDetailScreen: React.FC<{ taskId?: string | number }> = ({ taskId }) => {
  const navigation = useNav();
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasApplied, setHasApplied] = useState(false); // RN có state nhưng không dùng trong JSX
  // WIRING FIX (2026-08-21): moderation info
  const [moderationInfo, setModerationInfo] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        // Sử dụng endpoint chi tiết task thay vì fetch ALL tasks
        const taskRes: any = await getTaskDetail(taskId as string | number);
        if (!alive) return;
        setTask(taskRes.data);

        // Kiểm tra xem carepartner đã ứng tuyển việc này chưa
        const jobsRes: any = await getMyJobsAsWorker();
        if (!alive) return;
        const alreadyApplied = (jobsRes.data || []).some((job: any) => job.task === taskId);
        setHasApplied(alreadyApplied);

        // WIRING FIX (2026-08-21): Fetch moderation info nếu task bị từ chối/chờ review
        if (taskRes.data.moderation_status && taskRes.data.moderation_status !== "approved") {
          try {
            const modRes: any = await getTaskModeration(taskId as string | number);
            if (!alive) return;
            setModerationInfo(modRes.data);
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    fetchData();
    return () => {
      alive = false;
    };
  }, [taskId]);

  if (isLoading)
    return (
      <div style={{ minHeight: "100dvh", display: "flex", justifyContent: "center", paddingTop: 100 }}>
        <Spinner color={COLORS.primary} />
      </div>
    );
  if (!task)
    return (
      <div style={{ minHeight: "100dvh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: COLORS.textMuted }}>Không tìm thấy công việc này.</div>
      </div>
    );

  const cat = CATEGORIES.find((c) => c.id === task.category) || CATEGORIES[0];

  const INFO_ITEMS = [
    {
      icon: "calendar-outline",
      label: "Thời gian",
      value: new Date(task.scheduled_time).toLocaleString("vi-VN"),
      color: COLORS.primary,
    },
    { icon: "location-outline", label: "Địa điểm", value: task.location, color: COLORS.primary },
    { icon: "person-outline", label: "Phụ huynh", value: task.parent_name, color: COLORS.primary },
    {
      icon: "cash-outline",
      label: "Thù lao",
      value: `${parseInt(task.price).toLocaleString("vi-VN")}đ`,
      color: COLORS.primary,
    },
  ];

  return (
    <div style={{ ...ST.container, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <StatusBarSpacer />

      {/* Header */}
      <div style={ST.header}>
        <Touchable onPress={() => navigation.goBack()} style={ST.backBtn} activeOpacity={0.8}>
          <Icon name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Touchable>
        <div style={ST.headerTitle}>Chi tiết công việc</div>
        <div style={ST.headerSpacer} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
        {/* WIRING FIX (2026-08-21): Banner kiểm duyệt AI */}
        {moderationInfo && moderationInfo.status !== "approved" ? (
          <div style={ST.moderationBanner}>
            <Icon name={ic("shield-outline")} size={18} color={COLORS.warning} />
            <div style={ST.moderationText}>
              {moderationInfo.status === "rejected"
                ? "Việc này không vượt qua kiểm duyệt tự động. Lý do: " +
                  (moderationInfo.ai_verdict || "Nội dung không phù hợp")
                : "Việc này đang chờ Admin xem xét lại."}
            </div>
          </div>
        ) : null}

        {/* Hero */}
        <div style={ST.hero}>
          <div style={ST.categoryTag}>
            {renderCategoryIcon(cat.id, 18, "#fff")}
            <span style={ST.categoryTagText}>{cat.name}</span>
          </div>
          <div style={ST.title}>{task.title}</div>
          <div style={ST.price}>{parseInt(task.price).toLocaleString("vi-VN")}đ</div>
        </div>

        {/* Thông tin */}
        <div style={ST.infoGrid}>
          {INFO_ITEMS.map((item) => (
            <div key={item.label} style={ST.infoCard}>
              <div style={ST.infoIconCircle}>
                <Icon name={item.icon} size={20} color={item.color} />
              </div>
              <div style={ST.infoLabel}>{item.label}</div>
              <div
                style={{
                  ...ST.infoValue,
                  ...(item.label === "Thù lao" ? { color: COLORS.success, fontWeight: 900 } : {}),
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Mô tả */}
        <div style={ST.descSection}>
          <div style={ST.descTitle}>Yêu cầu chi tiết</div>
          <div style={ST.descText}>{task.description}</div>
        </div>
      </div>

      {/* Bottom CTA — QA 2026-09-10 #2: luồng thụ động kiểu Grab.
          Carepartner KHÔNG tự ứng tuyển nữa: phụ huynh chọn từ 8 ứng viên
          AI đề xuất, đơn tự xuất hiện ở MyBookingsScreen chờ cam kết.
          (applyTask + hasApplied/applying giữ nguyên state như RN — chỉ điều hướng.) */}
      <div style={ST.footer}>
        <Touchable
          style={ST.applyBtn}
          onPress={() => navigation.navigate("MyBookings")}
          activeOpacity={0.85}
        >
          <Icon name="notifications" size={20} color="#fff" />
          <span style={ST.applyBtnText}>XEM ĐƠN ĐƯỢC GIAO</span>
        </Touchable>
      </div>

      {/* ===== CONSENT MODAL (cho tracking) — RN để trống ===== */}
    </div>
  );
};

export default TaskDetailScreen;
