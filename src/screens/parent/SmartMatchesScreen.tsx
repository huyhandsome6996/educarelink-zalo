/**
 * SmartMatchesScreen — port CHÍNH XÁC mobile/src/screens/Parent/SmartMatchesScreen.js (551 dòng).
 * Feature A2: Smart Job Matching — danh sách CarePartner hệ thống gợi ý cho 1 task
 * (khoảng cách, khung giờ rảnh, tải việc). Pattern CandidatesScreen + Warm
 * Professionalism: rank medal top 3, avatar, availability window, rank reason.
 * Dữ liệu: getSmartMatches(taskId) (@/api/tasks). Params: taskId, taskTitle.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Animated.timing fade 250ms → CSS transition opacity + rAF.
 * - FlatList → map array thường (danh sách gợi ý ngắn).
 * - Image avatar → <img> + overlay chữ cái (giữ nguyên structure RN).
 * - Icon thiếu glyph (medal-outline, search-outline) → glyph gần nhất (ic()).
 * - RN paddingTop insets.top + 12 → <StatusBarSpacer /> + paddingTop 12.
 */
import React, { useState, useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, Screen, useStatusBarHeight } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { getSmartMatches } from "@/api/tasks";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      "medal-outline": "medal",
      "search-outline": "search",
    } as Record<string, string>
  )[name] ?? name;

// Rank medal config — gold / silver / bronze cho top 3
const RANK_CONFIG = [
  { bg: COLORS.tierGoldBg, color: COLORS.tierGold, icon: "trophy" },
  { bg: COLORS.tierSilverBg, color: COLORS.tierSilver, icon: "medal" },
  { bg: "#EDE9FE", color: "#7C3AED", icon: "medal-outline" },
];

// Format distance: metres → "Xm" or "X.Xkm"
const formatDistance = (meters: any): string => {
  if (meters == null) return "";
  const m = Number(meters);
  if (isNaN(m)) return "";
  if (m >= 1000) {
    const km = m / 1000;
    return `${km.toFixed(1)}km`;
  }
  return `${Math.round(m)}m`;
};

interface SmartMatchesScreenProps {
  taskId?: string | number;
  taskTitle?: string;
}

const SmartMatchesScreen: React.FC<SmartMatchesScreenProps> = ({ taskId, taskTitle }) => {
  const nav = useNav();
  const statusBarH = useStatusBarHeight();

  // Fade-in animation
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const [matches, setMatches] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = (await getSmartMatches(taskId as string | number)) as any;
      // Backend could return { matches: [...], message: "..." } or just a list
      if (Array.isArray(data)) {
        setMatches(data);
      } else if (data && Array.isArray(data.matches)) {
        setMatches(data.matches);
        setMessage(data.message || "");
      } else {
        setMatches([]);
        setMessage(data?.message || "Không có gợi ý phù hợp.");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || "Không thể tải gợi ý.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const fetchRef = useRef(fetchMatches);
  fetchRef.current = fetchMatches;

  // Avatar fallback: hiện chữ cái đầu + icon nếu không có avatar_url
  const renderAvatar = (item: any) => {
    const avatarUrl = item.avatar_url;
    const name = item.display_name || "C";
    if (avatarUrl) {
      return (
        <div style={S.avatar}>
          <img
            src={avatarUrl}
            alt={name}
            style={S.avatarImage}
            onError={() => {}}
          />
          <div style={{ ...S.avatarOverlay }}>
            <span style={{ ...S.avatarText, color: COLORS.textOnPrimary }}>{name[0]?.toUpperCase() || "?"}</span>
          </div>
        </div>
      );
    }
    return (
      <div style={S.avatar}>
        <span style={{ ...S.avatarText, color: COLORS.textOnPrimary }}>{name[0]?.toUpperCase() || "?"}</span>
      </div>
    );
  };

  // Render một match card — dùng đúng contract từ backend:
  // worker_id, display_name, avatar_url, distance_m, distance_text,
  // availability_window, workload_day, workload_week, rank_reason
  const renderMatch = (item: any, index: number) => {
    const displayName = item.display_name || "CarePartner";
    const rank = index + 1;
    const medal = RANK_CONFIG[index] || null;
    const distance = item.distance_text || (item.distance_m != null ? formatDistance(item.distance_m) : "");
    const availability = item.availability_window || "";
    const dayJobs = item.workload_day ?? 0;
    const weekJobs = item.workload_week ?? 0;
    const reason = item.rank_reason || "";

    return (
      <div key={item.worker_id?.toString() || `match_${index}`} style={S.card}>
        {/* Top row: rank + avatar + name + distance */}
        <div style={S.cardTop}>
          {/* Rank badge */}
          <div
            style={{
              ...S.rankBadge,
              background: medal ? medal.bg : COLORS.background,
            }}
          >
            {medal ? (
              <Icon name={ic(medal.icon)} size={medal.icon === "trophy" ? 22 : 18} color={medal.color} />
            ) : (
              <span style={{ ...TYPO.h4, fontSize: 18, color: COLORS.textMuted }}>{rank}</span>
            )}
          </div>

          {/* Avatar — dùng avatar_url từ API, fallback initials */}
          {renderAvatar(item)}

          {/* Name + distance */}
          <div style={S.cardInfo}>
            <span style={{ ...S.cardName, color: COLORS.onSurface, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayName}
            </span>
            <div style={S.cardMetaRow}>
              {distance ? (
                <div style={S.metaChip}>
                  <Icon name="location-outline" size={12} color={COLORS.primary} />
                  <span style={{ ...S.metaChipText, color: COLORS.onSurfaceVariant }}>{distance}</span>
                </div>
              ) : null}
              {dayJobs > 0 || weekJobs > 0 ? (
                <div style={S.metaChip}>
                  <Icon name="briefcase-outline" size={12} color={COLORS.onSurfaceVariant} />
                  <span style={{ ...S.metaChipText, color: COLORS.onSurfaceVariant }}>
                    {dayJobs} việc hôm nay{weekJobs > 0 ? `, ${weekJobs} việc tuần này` : ""}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Availability window */}
        {availability ? (
          <div style={{ ...S.availabilityRow, background: COLORS.successBg }}>
            <Icon name="calendar-outline" size={14} color={COLORS.success} />
            <span style={{ ...S.availabilityText, color: COLORS.successDeep }}>{availability}</span>
          </div>
        ) : null}

        {/* Rank reason */}
        {reason ? (
          <div style={{ ...S.reasonBox, background: COLORS.surfaceContainerLow }}>
            <Icon name="sparkles" size={12} color={COLORS.primary} style={{ marginTop: 1 }} />
            <span style={{ ...S.reasonText, color: COLORS.onSurfaceVariant }}>{reason}</span>
          </div>
        ) : null}

        {/* "Xem hồ sơ" button */}
        <Touchable
          style={{ ...S.viewProfileBtn, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}
          onPress={() => {
            const workerId = item.worker_id;
            if (workerId) {
              nav.navigate("CandidateProfile", {
                workerId,
                isPending: false,
              });
            }
          }}
          activeOpacity={0.85}
        >
          <span style={{ ...S.viewProfileBtnText, color: COLORS.primary }}>Xem hồ sơ</span>
          <Icon name="arrow-forward" size={16} color={COLORS.primary} />
        </Touchable>
      </div>
    );
  };

  return (
    <Screen bg={COLORS.surfaceWarm} scroll={false}>
      <div
        style={{
          opacity: faded ? 1 : 0,
          transition: "opacity 250ms",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* RN paddingTop insets.top + 12 */}
        <div style={{ height: statusBarH + 12 }} />

        {/* App Bar */}
        <div style={S.appBar}>
          <Touchable onPress={nav.goBack} hitSlop={12} style={S.appBarBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
          </Touchable>
          <span style={{ ...S.appBarTitle, color: COLORS.onSurface }}>Gợi ý phù hợp</span>
          <span style={{ ...S.appBarSubtitle, color: COLORS.onSurfaceVariant }}>{taskTitle || ""}</span>
          <Touchable
            onPress={() => fetchRef.current()}
            style={S.appBarBtn}
            disabled={isLoading}
          >
            <Icon name="refresh" size={20} color={COLORS.primary} style={isLoading ? { opacity: 0.4 } : undefined} />
          </Touchable>
        </div>

        {/* Banner thông tin matching */}
        <div style={{ ...S.aiBanner, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
          <div style={S.aiBannerLeft}>
            <Icon name="sparkles" size={16} color={COLORS.primary} />
            <span style={{ ...S.aiBannerTitle, color: COLORS.primary }}>Smart Matching</span>
          </div>
          <span style={{ ...S.aiBannerText, color: COLORS.primaryDark }}>
            Hệ thống gợi ý dựa trên khoảng cách, khung giờ rảnh và tải việc hiện tại.
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={S.centerContainer}>
            <Spinner size={36} color={COLORS.primary} />
            <span style={{ ...S.loadingText, color: COLORS.textMuted }}>Đang tìm CarePartner phù hợp...</span>
          </div>
        ) : error ? (
          <div style={S.centerContainer}>
            <div style={{ ...S.errorIconCircle, background: COLORS.errorBg }}>
              <Icon name="cloud-offline-outline" size={40} color={COLORS.error} />
            </div>
            <span style={{ ...S.errorTitle, color: COLORS.onSurface }}>Không thể tải gợi ý</span>
            <span style={{ ...S.errorText, color: COLORS.onSurfaceVariant, textAlign: "center" }}>{error}</span>
            <Touchable style={{ ...S.retryBtn, background: COLORS.primary }} onPress={() => fetchRef.current()} activeOpacity={0.85}>
              <Icon name="refresh" size={18} color={COLORS.textOnPrimary} />
              <span style={{ ...S.retryBtnText, color: COLORS.textOnPrimary }}>Thử lại</span>
            </Touchable>
          </div>
        ) : matches.length === 0 ? (
          <div style={S.centerContainer}>
            <div style={{ ...S.emptyIconCircle, background: COLORS.primaryLight }}>
              <Icon name={ic("search-outline")} size={40} color={COLORS.primary} />
            </div>
            <span style={{ ...S.emptyTitle, color: COLORS.onSurface }}>Chưa có gợi ý</span>
            <span style={{ ...S.emptyText, color: COLORS.onSurfaceVariant, textAlign: "center" }}>
              {message || "Hiện chưa có CarePartner phù hợp cho yêu cầu này. Hãy thử lại sau."}
            </span>
          </div>
        ) : (
          <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={S.list}>{matches.map((item, idx) => renderMatch(item, idx))}</div>
          </div>
        )}
      </div>
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
    padding: "0 12px 12px",
    background: COLORS.surface,
    position: "relative",
  },
  appBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  appBarTitle: { ...TYPO.h3, color: COLORS.onSurface, flex: 1 },
  appBarSubtitle: {
    ...TYPO.caption,
    color: COLORS.onSurfaceVariant,
    fontWeight: 400,
    position: "absolute",
    bottom: 2,
    left: 58,
    right: 58,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "center",
  },
  // === AI BANNER ===
  aiBanner: {
    margin: "12px 20px 0",
    padding: 14,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderStyle: "solid",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  aiBannerLeft: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  aiBannerTitle: { ...TYPO.h5 },
  aiBannerText: { ...TYPO.bodySmall, lineHeight: "18px" },
  // === CENTER CONTAINERS ===
  centerContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "0 40px",
  },
  loadingText: { ...TYPO.bodySmall, color: COLORS.textMuted, marginTop: 12 },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    boxShadow: SHADOWS.small,
  },
  errorTitle: { ...TYPO.h4, marginTop: 12 },
  errorText: { ...TYPO.bodySmall, marginTop: 4 },
  retryBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: SIZES.radiusFull,
    padding: "12px 24px",
    marginTop: 20,
    boxShadow: SHADOWS.large,
  },
  retryBtnText: { ...TYPO.buttonSmall },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    boxShadow: SHADOWS.small,
  },
  emptyTitle: { ...TYPO.h4, marginTop: 12 },
  emptyText: { ...TYPO.bodySmall, marginTop: 4, maxWidth: 280 },
  // === LIST ===
  list: { padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 12 },
  // === CARD ===
  card: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.outlineVariant,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: SHADOWS.small,
  },
  cardTop: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 },
  // === RANK BADGE ===
  rankBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  // === AVATAR ===
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  },
  avatarImage: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    objectFit: "cover",
  },
  avatarOverlay: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    background: "rgba(0,0,0,0.25)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { ...TYPO.h3 },
  // === CARD INFO ===
  cardInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  cardName: { ...TYPO.h4, display: "block" },
  cardMetaRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaChip: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { ...TYPO.caption, fontSize: 11, fontWeight: 400 },
  // === AVAILABILITY ===
  availabilityRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: SIZES.radiusSm,
    alignSelf: "flex-start",
  },
  availabilityText: { ...TYPO.bodySmall },
  // === REASON ===
  reasonBox: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    borderRadius: SIZES.radiusSm,
    padding: 10,
  },
  reasonText: { flex: 1, minWidth: 0, ...TYPO.bodySmall, lineHeight: "18px" },
  // === VIEW PROFILE BUTTON ===
  viewProfileBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: SIZES.radiusSm,
    padding: "10px 0",
    borderWidth: 1.5,
    borderStyle: "solid",
  },
  viewProfileBtnText: { ...TYPO.buttonSmall },
};

export default SmartMatchesScreen;
