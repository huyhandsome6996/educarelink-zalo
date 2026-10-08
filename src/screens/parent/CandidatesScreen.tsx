/**
 * CandidatesScreen — port CHÍNH XÁC mobile/src/screens/Parent/CandidatesScreen.js (707 dòng).
 * Thiết kế "Warm Professionalism" (Stitch AI): danh sách ứng viên theo task của phụ huynh.
 * Thứ tự khối giữ nguyên RN:
 *  1. Top App Bar trắng: back + 'Ứng viên' + filter icon (showComingSoon)
 *  2. Task title sub-bar (document-text-outline + caption) — khi có taskTitle
 *  3. Search bar (radius 14, border outline-variant, icon search, nút clear)
 *  4. Filter chips pill ngang: Tất cả / Đã xác thực / Đánh giá cao / Gần bạn
 *     (active = primary bg; chip != 'all' → showComingSoon như RN)
 *  5. AI Insights Panel: sparkles header + nút refresh (force refresh),
 *     summary + insight cards (avatar, name, score pill theo ngưỡng 80/50, reason, highlight)
 *     + disclaimer — chỉ render khi có pending hoặc đang loading AI (nguyên văn RN)
 *  6. Section title "N CarePartner đã ứng tuyển"
 *  7. Candidate cards: avatar tròn 56 (initials) + badge checkmark khi accepted,
 *     tên + shield-checkmark, TierBadge hạng CarePartner (B4 — worker_tier thật từ API),
 *     rating 5 sao + "(N đánh giá)", status chip (Đã chọn/Chờ thanh toán/Chờ duyệt),
 *     nút "Chọn {tên}" (pending only) → confirm → approveCandidate → VIETQR gate
 *     (next_step='create_payos_payment' → setupPayOS → PaymentQR)
 *  8. Empty state: people-outline + "Chưa có ứng viên" (nguyên văn RN)
 * Dữ liệu: getCandidates(taskId) GET /parent/tasks/{id}/candidates/ (TaskApplicationSerializer:
 * worker, worker_name, worker_tier, worker_tier_label, status, id) — zalo client trả data
 * trực tiếp (không bọc { data } như axios RN). Rating từng worker qua getWorkerProfile(c.worker).
 * AI: getCandidateRecommendations(taskId[, force]) — @/api/misc (AI_TIMEOUT 60s).
 * Params: { taskId, taskTitle, refreshTs } (PaymentQRScreen set refreshTs khi huỷ lựa chọn QR
 * → reload danh sách như RN).
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Animated.timing fade 250ms (ANIM.timingNormal) → CSS transition opacity + rAF.
 * - FlatList + ListHeaderComponent/ListEmptyComponent → scroll div + map + empty block.
 * - Platform.OS 'web' branch của RN giữ nguyên: window.confirm cho approve, alert() cho lỗi.
 * - Icon thiếu glyph (filter, medal-outline, diamond-outline) → alias cục bộ ic().
 * - accessibilityRole/Label của RN không áp dụng được trên Touchable web (bỏ qua — comment).
 * - StatusBar barStyle dark-content + paddingTop insets.top+32 → StatusBarSpacer + paddingTop 32.
 */
import React, { useState, useEffect, useMemo } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { getCandidates, approveCandidate, getWorkerProfile } from "@/api/tasks";
import { getCandidateRecommendations, setupPayOS } from "@/api/misc";

/** Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      filter: "list", // biểu tượng phễu lọc — không có trong bộ glyph
      "medal-outline": "medal",
      "diamond-outline": "diamond",
    } as Record<string, string>
  )[name] ?? name;

/** RN utils/comingSoon.js — Alert 1 nút "Đã hiểu" */
const showComingSoon = (featureName?: string) => {
  window.alert(
    featureName
      ? `Thông báo\n\nTính năng "${featureName}" đang được phát triển. Vui lòng quay lại sau!`
      : "Thông báo\n\nTính năng đang được phát triển. Vui lòng quay lại sau!"
  );
};

/** numberOfLines(n) của RN → web clamp dòng */
const clampLine = (n: number): React.CSSProperties =>
  n === 1
    ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }
    : {
        display: "-webkit-box",
        WebkitLineClamp: n,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

/* ── B4 — Hạng CarePartner (port mobile/src/utils/carePartnerTier.js) ──
   Map code backend → label + màu badge UI. Zalo theme thiếu tierBronze/tierDiamond
   → dùng đúng giá trị fallback của RN (carePartnerTier.js dòng 10-11, 31-32). */
const TIER_META: Record<string, { code: string; label: string; color: string; bg: string; icon: string }> = {
  bronze: { code: "bronze", label: "Hạng Đồng", color: "#8B5A2B", bg: "#F5E6D3", icon: "medal-outline" },
  silver: { code: "silver", label: "Hạng Bạc", color: COLORS.tierSilver || "#7d6a5d", bg: COLORS.tierSilverBg || "#f0e6df", icon: "medal-outline" },
  gold: { code: "gold", label: "Hạng Vàng", color: COLORS.tierGold || "#a67c00", bg: COLORS.tierGoldBg || "#fff4d6", icon: "star" },
  diamond: { code: "diamond", label: "Hạng Kim cương", color: "#0E7490", bg: "#E0F7FA", icon: "diamond-outline" },
};

/** resolveTier — đọc tier/worker_tier/worker_tier_label từ API (nguyên bản RN) */
function resolveTier(source: Record<string, any> = {}) {
  const code = String(source.worker_tier || source.tier || source.workerTier || "bronze")
    .toString()
    .toLowerCase()
    .trim();
  const base = TIER_META[code] || TIER_META.bronze;
  const label = source.worker_tier_label || source.tier_label || source.tierLabel || base.label;
  return { ...base, label, code: base.code };
}

/** CarePartnerTierBadge — port mobile/src/components/CarePartnerTierBadge.js (B4).
    size 'sm' dùng trong card danh sách, 'md' trong profile header. */
export const TierBadge: React.FC<{
  user?: Record<string, any>;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}> = ({ user, size = "md", style }) => {
  const tier = resolveTier(user || {});
  const isSmall = size === "sm";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: isSmall ? 4 : 6,
        padding: isSmall ? "3px 8px" : "5px 12px",
        borderRadius: isSmall ? 999 : SIZES.radiusXl,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: tier.color,
        background: tier.bg,
        alignSelf: isSmall ? "flex-start" : "center",
        ...style,
      }}
    >
      <Icon name={ic(tier.icon || "medal-outline")} size={isSmall ? 11 : 14} color={tier.color} />
      <span style={{ ...TYPO.caption, fontWeight: 700, ...(isSmall ? { fontSize: 10 } : null), color: tier.color }}>
        {tier.label}
      </span>
    </div>
  );
};

// Filter chips — cosmetic (không thay đổi logic filter hiện tại) — nguyên bản RN dòng 33-38
const FILTER_CHIPS = [
  { id: "all", label: "Tất cả", icon: "apps" },
  { id: "verified", label: "Đã xác thực", icon: "shield-checkmark" },
  { id: "high-rated", label: "Đánh giá cao", icon: "star" },
  { id: "nearby", label: "Gần bạn", icon: "location" },
];

interface CandidatesScreenProps {
  taskId?: string | number;
  taskTitle?: string;
  refreshTs?: string | number;
}

const CandidatesScreen: React.FC<CandidatesScreenProps> = ({ taskId, taskTitle, refreshTs }) => {
  const nav = useNav();

  // QA-FIX-UI 3.2: fade-in animation khi mount (RN Animated.timing → CSS transition + rAF)
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const [candidates, setCandidates] = useState<any[]>([]);
  const [workerRatings, setWorkerRatings] = useState<Record<string | number, { avg: number; count: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load danh sách ứng viên — nguyên bản RN useEffect [taskId, refreshTs]
  // (zalo client trả data trực tiếp, không qua res.data của axios RN)
  useEffect(() => {
    (async () => {
      try {
        const data = (await getCandidates(taskId as string | number)) as any[];
        setCandidates(Array.isArray(data) ? data : []);
        (Array.isArray(data) ? data : []).forEach((c: any) => {
          getWorkerProfile(c.worker)
            .then((profileRes: any) => {
              setWorkerRatings((prev) => ({
                ...prev,
                [c.worker]: {
                  avg: profileRes.avg_rating || 0,
                  count: profileRes.review_count || 0,
                },
              }));
            })
            .catch(() => {});
        });

        const hasPending = (Array.isArray(data) ? data : []).some((c: any) => c.status === "pending");
        if (hasPending) {
          setAiLoading(true);
          // RN .finally → lib es6 không có Promise.finally → .then sau catch (chạy luôn)
          getCandidateRecommendations(taskId as string | number)
            .then((r: any) => setAiInsights(r))
            .catch((e: any) => console.warn("AI insights failed:", e))
            .then(() => setAiLoading(false));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, refreshTs]);

  const reloadAIInsights = () => {
    setAiLoading(true);
    // RN .finally → lib es6 không có Promise.finally → .then sau catch (chạy luôn)
    getCandidateRecommendations(taskId as string | number, true)
      .then((r: any) => setAiInsights(r))
      .catch((e: any) => console.warn(e))
      .then(() => setAiLoading(false));
  };

  // Approve — nguyên bản RN handleApprove (nhánh Platform.OS === 'web'):
  // confirm → approveCandidate → VIETQR gate next_step='create_payos_payment'
  // → setupPayOS → PaymentQR; legacy fallback alert + goBack. RN truyền thêm
  // workerData (không dùng) — bỏ tham số thứ 3.
  const handleApprove = async (appId: string | number, workerName: string) => {
    const startApprove = async () => {
      try {
        const data: any = await approveCandidate(appId);
        // ── VIETQR GATE: chọn xong → PHẢI thanh toán QR để xác nhận ──
        if (data?.next_step === "create_payos_payment") {
          try {
            const pay: any = await setupPayOS(data.task_id || taskId);
            nav.navigate("PaymentQR", {
              paymentId: pay.payment_id,
              taskId: data.task_id || taskId,
              taskTitle: taskTitle || "",
              taskPrice: pay.amount,
              workerName: workerName,
              checkoutUrl: pay.checkout_url,
              qrCode: pay.qr_code || null,
              qrExpiresAt: pay.qr_expires_at || null,
            });
            return;
          } catch (payErr: any) {
            const payMsg =
              payErr?.response?.data?.error ||
              "Không tạo được mã QR PayOS. Vui lòng thử lại từ danh sách công việc của bạn.";
            alert(`Lỗi: ${payMsg}`);
            return;
          }
        }
        // Legacy fallback (không còn xảy ra với backend mới nhưng giữ phòng hờ)
        alert(`Đã nhận! ${data?.message || "Thành công"}`);
        nav.goBack();
      } catch (e: any) {
        const msg = e?.response?.data?.error || "Thao tác thất bại.";
        alert(`Lỗi: ${msg}`);
      }
    };

    if (
      window.confirm(
        `Chọn ${workerName}?\nSau khi chọn, bạn sẽ thanh toán qua QR VietQR để XÁC NHẬN đặt lịch. Chưa thanh toán = chưa giữ chỗ.`
      )
    ) {
      startApprove();
    }
  };

  // Filter candidates by search query (cosmetic)
  const filteredCandidates = candidates.filter(
    (c: any) => !searchQuery || c.worker_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render 1 card ứng viên — nguyên văn RN renderCandidate
  const renderCandidate = (c: any) => {
    const rating = workerRatings[c.worker];
    return (
      <Touchable
        key={c.id?.toString()}
        style={S.card}
        activeOpacity={0.8}
        onPress={() =>
          nav.navigate("CandidateProfile", {
            workerId: c.worker,
            applicationId: c.id,
            isPending: c.status === "pending",
          })
        }
      >
        {/* Top row: avatar + name + rating + verified + status chip */}
        <div style={S.cardTop}>
          {/* Avatar tròn 56px với initials */}
          <div style={S.avatarBox}>
            <div style={S.avatar}>
              <span style={S.avatarText}>{c.worker_name?.[0]?.toUpperCase() || "?"}</span>
            </div>
            {c.status === "accepted" && (
              <div style={S.avatarBadge}>
                <Icon name="checkmark" size={10} color="#fff" />
              </div>
            )}
          </div>

          <div style={S.cardInfo}>
            <div style={S.cardNameRow}>
              <span style={{ ...S.cardName, ...clampLine(1) }}>{c.worker_name}</span>
              <Icon name="shield-checkmark" size={14} color={COLORS.secondary} />
            </div>
            {/* B4 — Hạng CarePartner thật từ API (worker_tier/worker_tier_label) */}
            <TierBadge user={c} size="sm" />
            <div style={S.cardRatingRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon
                  key={i}
                  name={rating?.avg >= i ? "star" : "star-outline"}
                  size={12}
                  color={COLORS.ratingStar}
                />
              ))}
              <span style={S.cardRatingText}>{rating?.avg?.toFixed(1) || "N/A"}</span>
              <span style={S.cardTripsText}>({rating?.count || 0} đánh giá)</span>
            </div>
          </div>

          <div
            style={{
              ...S.statusChip,
              ...(c.status === "accepted"
                ? S.statusAccepted
                : c.status === "payment_pending"
                ? S.statusPaymentPending
                : S.statusPending),
            }}
          >
            <span
              style={{
                ...S.statusChipText,
                ...(c.status === "accepted"
                  ? S.statusTextAccepted
                  : c.status === "payment_pending"
                  ? S.statusTextPaymentPending
                  : S.statusTextPending),
              }}
            >
              {c.status === "accepted" ? "Đã chọn" : c.status === "payment_pending" ? "Chờ thanh toán" : "Chờ duyệt"}
            </span>
          </div>
        </div>

        {/* Approve button — chỉ hiện khi pending */}
        {c.status === "pending" && (
          <Touchable
            style={S.approveBtn}
            onPress={() => handleApprove(c.id, c.worker_name)}
            activeOpacity={0.85}
          >
            <Icon name="checkmark-circle" size={18} color="#fff" />
            <span style={S.approveBtnText}>Chọn {c.worker_name}</span>
          </Touchable>
        )}
      </Touchable>
    );
  };

  // ListHeaderComponent — AI insights panel + section title (useMemo như RN)
  const listHeaderComponent = useMemo(
    () => (
      <>
        {/* AI INSIGHTS PANEL — giữ nguyên logic, restyle màu */}
        {(aiLoading || (aiInsights?.has_ai && aiInsights?.recommendations?.length > 0)) && (
          <div style={S.aiPanel}>
            <div style={S.aiPanelHeader}>
              <div style={S.aiPanelHeaderLeft}>
                <Icon name="sparkles" size={16} color={COLORS.primary} />
                <span style={S.aiPanelTitle}>AI đánh giá ứng viên</span>
              </div>
              <Touchable onPress={reloadAIInsights} disabled={aiLoading} hitSlop={10}>
                <Icon name="refresh" size={14} color={COLORS.primary} />
              </Touchable>
            </div>

            {aiLoading && !aiInsights ? (
              <div style={S.aiLoadingBox}>
                <Spinner size={20} color={COLORS.primary} />
                <span style={S.aiLoadingText}>AI đang phân tích các ứng viên...</span>
              </div>
            ) : (
              <>
                {aiInsights?.summary ? <span style={S.aiSummary}>{aiInsights.summary}</span> : null}
                {aiInsights?.recommendations?.map((rec: any, idx: number) => {
                  const w = rec.worker;
                  if (!w) return null;
                  const score = rec.match_score || 0;
                  const scoreColor = score >= 80 ? COLORS.success : score >= 50 ? COLORS.warning : COLORS.textMuted;
                  const scoreLabel = score >= 80 ? "Rất phù hợp" : score >= 50 ? "Phù hợp" : "Ít phù hợp";
                  const displayName = (w.first_name || w.last_name)
                    ? `${w.first_name} ${w.last_name || ""}`.trim()
                    : w.username;
                  return (
                    <div key={`ai_${idx}`} style={S.aiInsightCard}>
                      <div style={S.aiInsightHeader}>
                        <div style={S.aiInsightAvatar}>
                          <span style={S.aiInsightAvatarText}>{displayName?.[0]?.toUpperCase() || "?"}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={S.aiInsightName}>{displayName}</span>
                          <div
                            style={{
                              ...S.aiInsightScore,
                              background: `${scoreColor}20`,
                              borderColor: scoreColor,
                            }}
                          >
                            <span style={{ ...S.aiInsightScoreText, color: scoreColor }}>
                              {scoreLabel} · {score}/100
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={S.aiInsightReason}>{rec.reason}</span>
                      {rec.highlight && rec.highlight !== "—" ? (
                        <div style={S.aiInsightHighlight}>
                          <Icon name="star" size={11} color={COLORS.success} />
                          <span style={S.aiInsightHighlightText}>{rec.highlight}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <span style={S.aiDisclaimer}>* Gợi ý AI chỉ tham khảo. Quyền quyết định thuộc về bạn.</span>
              </>
            )}
          </div>
        )}

        <span style={S.sectionTitle}>{filteredCandidates.length} CarePartner đã ứng tuyển</span>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aiLoading, aiInsights, filteredCandidates.length]
  );

  return (
    <Screen bg={COLORS.surfaceWarm} scroll={false}>
      <StatusBarSpacer />

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
        {/* RN StatusBar barStyle="dark-content" backgroundColor surfaceWarm → Screen bg */}

        {/* Top App Bar — trắng (RN paddingTop insets.top + 32 → StatusBarSpacer + paddingTop 32) */}
        <div style={{ ...S.appBar, paddingTop: 32 }}>
          <Touchable
            onPress={nav.goBack}
            style={S.appBarBtn}
            hitSlop={12}
            /* accessibilityRole="button" accessibilityLabel="Quay lại" (RN) */
          >
            <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
          </Touchable>
          <span style={{ ...S.appBarTitle, color: COLORS.onSurface }}>Ứng viên</span>
          <Touchable style={S.appBarBtn} onPress={() => showComingSoon("Bộ lọc nâng cao")}>
            <Icon name={ic("filter")} size={20} color={COLORS.primary} />
          </Touchable>
        </div>

        {/* Task title sub-bar */}
        {taskTitle ? (
          <div style={S.taskBar}>
            <Icon name="document-text-outline" size={14} color={COLORS.onSurfaceVariant} />
            <span style={{ ...S.taskBarText, color: COLORS.onSurfaceVariant, ...clampLine(1) }}>{taskTitle}</span>
          </div>
        ) : null}

        {/* Search bar + filter chips */}
        <div style={S.searchSection}>
          <div style={S.searchBox}>
            <Icon name="search" size={18} color={COLORS.onSurfaceVariant} style={S.searchIcon} />
            <input
              style={S.searchInput}
              placeholder="Tìm kiếm CarePartner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <Touchable onPress={() => setSearchQuery("")} hitSlop={10}>
                <Icon name="close-circle" size={16} color={COLORS.outlineVariant} />
              </Touchable>
            ) : null}
          </div>

          {/* Filter chips — horizontal scroll (RN horizontal ScrollView) */}
          <div className="edc-scroll" style={S.chipRowScroll}>
            <div style={S.chipRow}>
              {FILTER_CHIPS.map((chip) => (
                <Touchable
                  key={chip.id}
                  style={{ ...S.chip, ...(activeFilter === chip.id ? S.chipActive : null) }}
                  onPress={() => {
                    setActiveFilter(chip.id);
                    if (chip.id !== "all") showComingSoon(`Lọc theo ${chip.label}`);
                  }}
                  activeOpacity={0.85}
                >
                  <Icon
                    name={chip.icon}
                    size={14}
                    color={activeFilter === chip.id ? "#ffffff" : COLORS.onSurfaceVariant}
                    style={{ marginRight: 4 }}
                  />
                  <span style={{ ...S.chipText, ...(activeFilter === chip.id ? S.chipTextActive : null) }}>
                    {chip.label}
                  </span>
                </Touchable>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
            <Spinner size={24} color={COLORS.primary} />
          </div>
        ) : (
          /* RN FlatList → scroll div giữ ListHeader + items + ListEmpty */
          <div className="edc-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            <div style={S.list}>
              {listHeaderComponent}

              {filteredCandidates.map((c: any) => renderCandidate(c))}

              {filteredCandidates.length === 0 && (
                <div style={S.empty}>
                  <div style={S.emptyIconCircle}>
                    <Icon name="people-outline" size={40} color={COLORS.primary} />
                  </div>
                  <span style={{ ...S.emptyTitle, color: COLORS.onSurface }}>Chưa có ứng viên</span>
                  <span style={{ ...S.emptyText, color: COLORS.onSurfaceVariant }}>
                    Các CarePartner sẽ sớm ứng tuyển. Hãy kiên nhẫn chờ đợi!
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
};

// ============================================================
// STYLESHEET — port 1:1 StyleSheet.create của RN (dòng 428-707)
// ============================================================
const S: Record<string, React.CSSProperties> = {
  container: { flex: 1, background: COLORS.surfaceWarm },
  // === APP BAR ===
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px 12px",
    background: COLORS.surface,
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
  appBarTitle: { ...TYPO.h3, flex: 1, textAlign: "center" },
  // === TASK BAR ===
  taskBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: "8px 20px",
    background: COLORS.surfaceContainerLow,
  },
  taskBarText: { ...TYPO.caption, flex: 1 },
  // === SEARCH SECTION ===
  searchSection: {
    padding: "20px 20px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  searchBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: COLORS.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.outlineVariant,
    borderRadius: 14,
    padding: "0 14px",
    height: 44,
    boxShadow: SHADOWS.small,
  },
  searchIcon: { marginRight: 10, flexShrink: 0 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    ...TYPO.body,
    color: COLORS.onSurface,
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
  },
  // === CHIPS ===
  /** RN horizontal ScrollView — web: scroll ngang ẩn scrollbar */
  chipRowScroll: { overflowX: "auto" },
  chipRow: { display: "flex", flexDirection: "row", gap: 8, paddingRight: 20, width: "max-content" },
  chip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 999,
    background: COLORS.surfaceContainer,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  chipActive: {
    background: COLORS.primary,
    boxShadow: SHADOWS.small,
  },
  chipText: { ...TYPO.caption, color: COLORS.onSurfaceVariant },
  chipTextActive: { color: COLORS.textOnPrimary },
  // === LIST ===
  list: { padding: "0 20px 40px", display: "flex", flexDirection: "column", gap: 12 },
  sectionTitle: { ...TYPO.h3, color: COLORS.onSurface, marginTop: 8, marginBottom: 4 },
  // === CARD ===
  card: {
    background: COLORS.surface, // surface-container-lowest
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.outlineVariant,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: SHADOWS.small,
  },
  cardTop: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 },
  avatarBox: { position: "relative", flexShrink: 0 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  avatarText: { ...TYPO.h3, color: COLORS.textOnPrimary },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    background: COLORS.secondary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: COLORS.surface,
  },
  cardInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  cardNameRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  cardName: { ...TYPO.h4, color: COLORS.onSurface, flex: 1 },
  cardRatingRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 2 },
  // B4 — khoảng thở giữa badge hạng và hàng rating
  cardTierRow: { marginTop: 2, marginBottom: 2 },
  cardRatingText: {
    ...TYPO.caption,
    color: COLORS.onSurface,
    fontWeight: 700,
    marginLeft: 4,
  },
  cardTripsText: { fontSize: 10, color: COLORS.onSurfaceVariant, fontWeight: 500 },
  // === STATUS CHIP ===
  statusChip: { padding: "6px 12px", borderRadius: 999, flexShrink: 0 },
  statusAccepted: { background: COLORS.secondaryLight },
  statusPending: { background: COLORS.warningBg },
  // VIETQR gate: application đã được chọn — đang chờ phụ huynh thanh toán QR
  statusPaymentPending: { background: "#EFF6FF" }, // blue-50
  statusTextPaymentPending: { color: COLORS.info },
  statusChipText: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTextAccepted: { color: COLORS.secondaryDark },
  statusTextPending: { color: COLORS.warning },
  // === APPROVE BUTTON ===
  approveBtn: {
    background: COLORS.primary,
    borderRadius: 14,
    height: 46,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: SHADOWS.large,
  },
  approveBtnText: { ...TYPO.buttonSmall, color: COLORS.textOnPrimary },
  // === EMPTY STATE ===
  empty: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    boxShadow: SHADOWS.small,
  },
  emptyTitle: { ...TYPO.h4 },
  emptyText: { ...TYPO.bodySmall, textAlign: "center", padding: "0 20px" },
  // === AI INSIGHTS PANEL ===
  aiPanel: {
    background: COLORS.primaryLight,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.primarySoft,
  },
  aiPanelHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  aiPanelHeaderLeft: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  aiPanelTitle: { ...TYPO.h5, color: COLORS.primary, fontWeight: 700 },
  aiLoadingBox: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 8,
  },
  aiLoadingText: { ...TYPO.bodySmall, color: COLORS.primary },
  aiSummary: { ...TYPO.bodySmall, color: COLORS.onSurfaceVariant, marginBottom: 10, lineHeight: "18px", display: "block" },
  aiInsightCard: {
    background: COLORS.surface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  aiInsightHeader: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 6,
  },
  aiInsightAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  aiInsightAvatarText: { color: COLORS.primary, fontWeight: 800, fontSize: 13 },
  aiInsightName: { ...TYPO.bodySmall, fontWeight: 700, color: COLORS.onSurface, marginBottom: 3, display: "block" },
  aiInsightScore: {
    alignSelf: "flex-start",
    display: "inline-flex",
    padding: "2px 6px",
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "solid",
    width: "fit-content",
  },
  aiInsightScoreText: { ...TYPO.caption, fontSize: 10, fontWeight: 700 },
  aiInsightReason: { ...TYPO.caption, color: COLORS.onSurfaceVariant, lineHeight: "16px", marginBottom: 4, display: "block" },
  aiInsightHighlight: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: COLORS.secondaryLight,
    borderRadius: 6,
    padding: "3px 6px",
    alignSelf: "flex-start",
    width: "fit-content",
  },
  aiInsightHighlightText: { ...TYPO.caption, color: COLORS.secondaryDark, fontSize: 10, fontWeight: 700 },
  aiDisclaimer: {
    ...TYPO.caption,
    color: COLORS.onSurfaceVariant,
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "center",
    display: "block",
  },
};

export default CandidatesScreen;
