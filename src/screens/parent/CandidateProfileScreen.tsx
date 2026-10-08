/**
 * CandidateProfileScreen — port CHÍNH XÁC mobile/src/screens/Parent/CandidateProfileScreen.js (765 dòng).
 * Thiết kế "Warm Professionalism": hồ sơ CarePartner xem từ luồng ứng viên legacy.
 * Thứ tự khối giữ nguyên RN:
 *  1. Top App Bar trắng: back + 'Hồ sơ CarePartner' + more icon (showComingSoon)
 *  2. Profile card: surfaceContainerLow, radius 24, gradient header bar (primaryFixedDim 30%),
 *     avatar 128px ring 4px + verified badge overlay, name h1,
 *     'CarePartner Được Chứng Nhận', TierBadge hạng thật từ API (B4),
 *     stats row 3 cột (Đánh giá / Giờ chăm sóc / Gia đình)
 *  3. Section 'Kinh nghiệm & Kỹ năng': exp card (icon people) + 4 skill chips
 *  4. Section 'Bằng cấp & Chứng chỉ': cert cards ribbon icon (theo profile.qualifications)
 *  5. AI summary panel: 'Tóm tắt hồ sơ (AI)' + box viền trái primary + disclaimer
 *  6. Section 'Lịch rảnh trong tuần': MOCK cố định (QA-FIX-UI 2.1 — backend chưa có
 *     field availability) — 7 cột T2–CN, Sáng/Chiều, ô rảnh successBg + checkmark
 *  7. Section 'Đánh giá từ phụ huynh (N)': review cards (reviewer avatar, ngày vi-VN,
 *     5 sao, comment clamp 4) / empty chatbubble-ellipses-outline
 *  8. Sticky footer 'Chấp nhận bạn này làm việc' — chỉ khi isPending; confirm →
 *     approveCandidate(applicationId) → alert → navigate('MyTasks')
 * Dữ liệu: getWorkerProfile(workerId) GET /worker/{id}/profile/ — zalo client trả data
 * trực tiếp (không bọc { data } như axios RN); lỗi đọc e.response.data.error.
 * Params: { workerId, applicationId, isPending } (giống route.params RN; isPending là
 * boolean từ navigate hoặc chuỗi "true"/"false" từ hash deep-link → chuẩn hoá).
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Animated.timing fade 250ms (ANIM.timingNormal) → CSS transition opacity + rAF.
 * - ScrollView → scroll div (padding '16px 20px 40px' + spacer 100 đáy như RN).
 * - Platform.OS 'web' branch của RN giữ nguyên: window.confirm + alert().
 * - Icon thiếu glyph (ellipsis-horizontal, medal-outline, diamond-outline) → alias ic().
 * - accessibilityRole/Label của RN không áp dụng được trên Touchable web (bỏ qua — comment).
 * - StatusBar barStyle dark-content + paddingTop insets.top+32 → StatusBarSpacer + paddingTop 32.
 * - Alert.alert 1 nút 'Đã nhận!' → alert(); lỗi load hồ sơ → alert + goBack như RN-web.
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { getWorkerProfile, approveCandidate } from "@/api/tasks";

/** Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      "ellipsis-horizontal": "settings-outline", // more menu — không có trong bộ glyph
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
   Zalo theme thiếu tierBronze/tierDiamond → dùng đúng giá trị fallback của RN. */
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

/** CarePartnerTierBadge — port mobile/src/components/CarePartnerTierBadge.js (B4) */
const TierBadge: React.FC<{ user?: Record<string, any>; style?: React.CSSProperties }> = ({ user, style }) => {
  const tier = resolveTier(user || {});
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px",
        borderRadius: SIZES.radiusXl,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: tier.color,
        background: tier.bg,
        alignSelf: "center",
        ...style,
      }}
    >
      <Icon name={ic(tier.icon || "medal-outline")} size={14} color={tier.color} />
      <span style={{ ...TYPO.caption, fontWeight: 700, color: tier.color }}>{tier.label}</span>
    </div>
  );
};

// QA-FIX-UI 2.1: Mock data lịch rảnh trong tuần — nguyên bản RN dòng 34-38.
// Backend chưa có field availability cho Worker → dùng mock cố định khớp screen.png.
const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const AVAILABILITY_MOCK = {
  morning: [true, true, false, true, false, true, true],
  afternoon: [false, true, true, false, true, true, false],
};

interface CandidateProfileScreenProps {
  workerId?: string | number;
  applicationId?: string | number;
  isPending?: boolean | string;
}

const CandidateProfileScreen: React.FC<CandidateProfileScreenProps> = ({ workerId, applicationId, isPending }) => {
  const nav = useNav();

  // QA-FIX-UI 3.2: fade-in animation khi mount (RN Animated.timing → CSS transition + rAF)
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  // isPending có thể là boolean (navigate trực tiếp) hoặc "true"/"false" (hash deep-link)
  const pending = isPending === true || isPending === "true";

  useEffect(() => {
    (async () => {
      try {
        const data = (await getWorkerProfile(workerId as string | number)) as any;
        setProfile(data);
      } catch (err: any) {
        console.error(err);
        const msg = err?.response?.data?.error || "Không thể tải thông tin hồ sơ.";
        alert(msg);
        nav.goBack();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  const handleApprove = () => {
    const startApprove = async () => {
      setApproving(true);
      try {
        const data: any = await approveCandidate(applicationId as string | number);
        alert(`Đã nhận! ${data?.message}`);
        nav.navigate("MyTasks");
      } catch (e: any) {
        const msg = e?.response?.data?.error || "Thao tác thất bại.";
        alert(`Lỗi: ${msg}`);
      } finally {
        setApproving(false);
      }
    };

    if (
      window.confirm(
        `Xác nhận chấp nhận ${profile?.first_name || profile?.username} làm việc này?\nCác ứng viên khác sẽ tự động bị từ chối.`
      )
    ) {
      startApprove();
    }
  };

  if (isLoading)
    return (
      <Screen bg={COLORS.surfaceWarm} scroll={false}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", marginTop: 100 }}>
          <Spinner size={24} color={COLORS.primary} />
        </div>
      </Screen>
    );
  if (!profile) return null;

  const displayName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.username;
  const rating = profile.avg_rating || 0;
  const reviewCount = profile.review_count || 0;
  // B4 — không còn mock tier theo review_count: badge dưới dùng hạng thật
  // từ API (tier / tier_label), luôn hiển thị, mặc định Hạng Đồng.

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
          <span style={{ ...S.appBarTitle, color: COLORS.onSurface }}>Hồ sơ CarePartner</span>
          <Touchable style={S.appBarBtn} onPress={() => showComingSoon("Báo cáo/Blokir CarePartner")}>
            <Icon name={ic("ellipsis-horizontal")} size={22} color={COLORS.onSurfaceVariant} />
          </Touchable>
        </div>

        {/* RN ScrollView → scroll div */}
        <div
          className="edc-scroll"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}
        >
          <div style={S.scrollContent}>
            {/* Profile Card — surfaceContainerLow bg, radius 24, gradient header */}
            <div style={S.profileCard}>
              {/* Gradient header bar */}
              <div style={S.profileGradientBar} />

              {/* Avatar 128px với ring 4px */}
              <div style={S.avatarRing}>
                <div style={S.avatar}>
                  <span style={S.avatarText}>{displayName?.[0]?.toUpperCase() || "?"}</span>
                </div>
                {/* Verified badge overlay */}
                <div style={S.verifiedBadge}>
                  <Icon name="shield-checkmark" size={14} color="#fff" />
                </div>
              </div>

              <span style={{ ...S.name, color: COLORS.onSurface, ...clampLine(2) }}>{displayName}</span>

              <div style={S.verifiedRow}>
                <Icon name="shield-checkmark" size={16} color={COLORS.secondary} />
                <span style={{ ...S.verifiedText, color: COLORS.onSurfaceVariant }}>CarePartner Được Chứng Nhận</span>
              </div>

              {/* B4 — Hạng CarePartner thật từ API (luôn hiển thị, mặc định Hạng Đồng) */}
              <TierBadge user={profile} style={S.tierBadge} />

              {/* Stats row — 3 cột: rating, hours, families */}
              <div style={S.statsRow}>
                <div style={S.statItem}>
                  <span style={{ ...S.statValue, color: COLORS.primary }}>{rating > 0 ? rating.toFixed(1) : "N/A"}</span>
                  <div style={S.statSubRow}>
                    <Icon name="star" size={12} color={COLORS.ratingStar} />
                    <span style={{ ...S.statLabel, color: COLORS.onSurfaceVariant }}>Đánh giá</span>
                  </div>
                </div>
                <div style={S.statDivider} />
                <div style={S.statItem}>
                  <span style={{ ...S.statValue, color: COLORS.primary }}>{reviewCount * 2}+</span>
                  <span style={{ ...S.statLabel, color: COLORS.onSurfaceVariant }}>Giờ chăm sóc</span>
                </div>
                <div style={S.statDivider} />
                <div style={S.statItem}>
                  <span style={{ ...S.statValue, color: COLORS.primary }}>{reviewCount}</span>
                  <span style={{ ...S.statLabel, color: COLORS.onSurfaceVariant }}>Gia đình</span>
                </div>
              </div>
            </div>

            {/* Section: Kinh nghiệm & Kỹ năng */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Kinh nghiệm & Kỹ năng</span>

              {/* Experience card */}
              <div style={S.expCard}>
                <div style={S.expIconCircle}>
                  <Icon name="people" size={22} color={COLORS.secondaryDark} />
                </div>
                <div style={S.expContent}>
                  <span style={{ ...S.expTitle, color: COLORS.onSurface }}>
                    {reviewCount > 0 ? `${reviewCount}+ việc đã hoàn thành` : "Mới tham gia"}
                  </span>
                  <span style={{ ...S.expDesc, color: COLORS.onSurfaceVariant }}>
                    Chuyên chăm sóc trẻ, hỗ trợ bài tập, và đồng hành cùng gia đình. Đã được xác thực danh tính và
                    được phụ huynh tin tưởng.
                  </span>
                </div>
              </div>

              {/* Skills chips */}
              <div style={S.skillsRow}>
                {["Sơ cứu cơ bản", "Hỗ trợ bài tập", "Chăm sóc trẻ", "Đưa đón an toàn"].map((skill) => (
                  <div key={skill} style={S.skillChip}>
                    <span style={{ ...S.skillChipText, color: COLORS.onSurface }}>{skill}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Bằng cấp & Chứng chỉ */}
            {profile.qualifications?.length > 0 && (
              <div style={S.section}>
                <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Bằng cấp & Chứng chỉ</span>
                <div style={S.certList}>
                  {profile.qualifications.map((q: string, idx: number) => (
                    <div key={idx} style={S.certCard}>
                      <div style={S.certIconCircle}>
                        <Icon name="ribbon" size={18} color={COLORS.primary} />
                      </div>
                      <span style={{ ...S.certText, color: COLORS.onSurface }}>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Profile Summary */}
            {profile.ai_profile_summary && (
              <div style={S.section}>
                <div style={S.aiTitleRow}>
                  <div style={S.aiIconCircle}>
                    <Icon name="sparkles" size={16} color={COLORS.primary} />
                  </div>
                  <span style={{ ...S.aiTitle, color: COLORS.primary }}>Tóm tắt hồ sơ (AI)</span>
                </div>
                <div style={S.aiBox}>
                  <span style={{ ...S.aiText, color: COLORS.onSurface }}>{profile.ai_profile_summary}</span>
                  <span style={{ ...S.aiDisclaimer, color: COLORS.onSurfaceVariant }}>
                    * Tóm tắt được tạo bởi AI, chỉ tham khảo.
                  </span>
                </div>
              </div>
            )}

            {/* Section: Lịch rảnh trong tuần — MOCK (QA-FIX-UI 2.1)
                Backend chưa có field availability cho Worker → dùng mock data cố định.
                Khi backend thêm field thật, thay AVAILABILITY_MOCK bằng profile.availability. */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Lịch rảnh trong tuần</span>
              <div style={S.availabilityCard}>
                {/* Header row: 7 cột ngày T2–CN */}
                <div style={S.availHeaderRow}>
                  {DAYS.map((d) => (
                    <div key={d} style={S.availDayCell}>
                      <span style={{ ...S.availDayLabel, color: COLORS.onSurfaceVariant }}>{d}</span>
                    </div>
                  ))}
                </div>
                {/* Morning row */}
                <div style={S.availSlotBlock}>
                  <span style={{ ...S.availSlotLabel, color: COLORS.onSurfaceVariant }}>Sáng (08:00 - 12:00)</span>
                  <div style={S.availRow}>
                    {AVAILABILITY_MOCK.morning.map((avail, idx) => (
                      <div
                        key={`m-${idx}`}
                        style={{ ...S.availCell, ...(avail ? S.availCellAvailable : S.availCellBusy) }}
                      >
                        {avail && <Icon name="checkmark" size={14} color={COLORS.successDeep} />}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Afternoon row */}
                <div style={S.availSlotBlock}>
                  <span style={{ ...S.availSlotLabel, color: COLORS.onSurfaceVariant }}>Chiều (13:00 - 17:00)</span>
                  <div style={S.availRow}>
                    {AVAILABILITY_MOCK.afternoon.map((avail, idx) => (
                      <div
                        key={`a-${idx}`}
                        style={{ ...S.availCell, ...(avail ? S.availCellAvailable : S.availCellBusy) }}
                      >
                        {avail && <Icon name="checkmark" size={14} color={COLORS.successDeep} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Đánh giá từ phụ huynh */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>
                Đánh giá từ phụ huynh ({reviewCount})
              </span>
              {profile.reviews?.length === 0 || !profile.reviews ? (
                <div style={S.emptyReviews}>
                  <Icon name="chatbubble-ellipses-outline" size={32} color={COLORS.outlineVariant} />
                  <span style={{ ...S.emptyReviewsText, color: COLORS.onSurfaceVariant }}>
                    Chưa có lượt đánh giá nào cho CarePartner này.
                  </span>
                </div>
              ) : (
                <div style={S.reviewList}>
                  {profile.reviews.map((r: any, idx: number) => (
                    <div key={idx} style={S.reviewCard}>
                      <div style={S.reviewHeader}>
                        <div style={S.reviewerInfo}>
                          <div style={S.reviewerAvatar}>
                            <span style={{ ...S.reviewerAvatarText, color: COLORS.primary }}>
                              {r.reviewer_name?.[0]?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div>
                            <span style={{ ...S.reviewerName, color: COLORS.onSurface, ...clampLine(1) }}>
                              {r.reviewer_name}
                            </span>
                            <span style={{ ...S.reviewDate, color: COLORS.onSurfaceVariant }}>
                              {new Date(r.created_at).toLocaleDateString("vi-VN", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        <div style={S.starsRow}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Icon
                              key={i}
                              name={i <= r.rating ? "star" : "star-outline"}
                              size={12}
                              color={COLORS.ratingStar}
                            />
                          ))}
                        </div>
                      </div>
                      <span style={{ ...S.reviewComment, color: COLORS.onSurfaceVariant, ...clampLine(4) }}>
                        {r.comment}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: 100 }} />
          </div>
        </div>

        {/* Sticky footer — 'Chấp nhận' button (pending only) */}
        {pending && (
          <div style={S.footer}>
            <Touchable
              style={{ ...S.approveBtn, ...(approving ? { opacity: 0.7 } : null) }}
              onPress={handleApprove}
              disabled={approving}
              activeOpacity={0.85}
            >
              {approving ? (
                <Spinner size={20} color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={20} color="#fff" />
                  <span style={{ ...S.approveBtnText, color: COLORS.textOnPrimary }}>
                    Chấp nhận bạn này làm việc
                  </span>
                </>
              )}
            </Touchable>
          </div>
        )}
      </div>
    </Screen>
  );
};

// ============================================================
// STYLESHEET — port 1:1 StyleSheet.create của RN (dòng 373-765)
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
    background: COLORS.surfaceContainer,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  appBarTitle: { ...TYPO.h3, flex: 1, textAlign: "center" },
  // === SCROLL ===
  scrollContent: { padding: "16px 20px 40px" },
  // === PROFILE CARD ===
  profileCard: {
    background: COLORS.surfaceContainerLow, // surface-container-low
    borderRadius: 24,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflow: "hidden",
    boxShadow: SHADOWS.small,
    marginBottom: 24,
    position: "relative",
  },
  profileGradientBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    background: COLORS.primaryFixedDim, // primary-fixed-dim
    opacity: 0.3,
  },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    background: COLORS.surface,
    borderWidth: 4,
    borderStyle: "solid",
    borderColor: COLORS.surface,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    boxShadow: SHADOWS.medium,
    zIndex: 1,
    position: "relative",
    flexShrink: 0,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    background: COLORS.primary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { ...TYPO.h1, fontSize: 42, color: COLORS.textOnPrimary },
  verifiedBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.secondary,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: COLORS.surface,
  },
  name: {
    ...TYPO.h1,
    marginBottom: 8,
    textAlign: "center",
    zIndex: 1,
  },
  verifiedRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  verifiedText: { ...TYPO.body },
  // B4 — spacing cho CarePartnerTierBadge (màu/viền nằm trong component)
  tierBadge: { marginBottom: 8 },
  // === STATS ROW ===
  statsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: COLORS.outlineVariant,
  },
  statItem: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
  statValue: { ...TYPO.h3, marginBottom: 4 },
  statSubRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel: { ...TYPO.caption },
  statDivider: { width: 1, height: 40, background: COLORS.outlineVariant },
  // === SECTIONS ===
  section: { marginBottom: 24 },
  sectionTitle: { ...TYPO.h2, marginBottom: 16, display: "block" },
  // === EXPERIENCE CARD ===
  expCard: {
    background: COLORS.surfaceContainer,
    borderRadius: 20,
    padding: 16,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    boxShadow: SHADOWS.small,
    marginBottom: 16,
  },
  expIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: COLORS.secondaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  expContent: { flex: 1, minWidth: 0 },
  expTitle: { ...TYPO.h4, marginBottom: 4, display: "block" },
  expDesc: { ...TYPO.body, fontSize: 13, lineHeight: "20px", display: "block" },
  // === SKILLS ===
  skillsRow: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    background: COLORS.surfaceContainer,
    padding: "6px 14px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.outlineVariant,
  },
  skillChipText: { ...TYPO.body, fontSize: 13 },
  // === CERTIFICATES ===
  certList: { display: "flex", flexDirection: "column", gap: 8 },
  certCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    background: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.outlineVariant,
  },
  certIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  certText: { ...TYPO.body, flex: 1, minWidth: 0 },
  // === AI SUMMARY ===
  aiTitleRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  aiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  aiTitle: { ...TYPO.h4, fontWeight: 700 },
  aiBox: {
    background: COLORS.primaryLight,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftStyle: "solid",
    borderLeftColor: COLORS.primary,
    boxShadow: SHADOWS.small,
    display: "flex",
    flexDirection: "column",
  },
  aiText: { ...TYPO.body, lineHeight: "22px", fontStyle: "italic" },
  aiDisclaimer: { ...TYPO.caption, fontStyle: "italic", marginTop: 8 },
  // === REVIEWS ===
  emptyReviews: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  emptyReviewsText: { ...TYPO.bodySmall, textAlign: "center" },
  reviewList: { display: "flex", flexDirection: "column", gap: 12 },
  reviewCard: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: COLORS.outlineVariant,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  reviewHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewerInfo: { display: "flex", flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  reviewerAvatarText: { ...TYPO.h5, fontWeight: 800 },
  reviewerName: { ...TYPO.body, fontWeight: 700 },
  reviewDate: { ...TYPO.caption, fontWeight: 400 },
  starsRow: { display: "flex", flexDirection: "row", gap: 2, flexShrink: 0 },
  reviewComment: { ...TYPO.body, fontSize: 14, lineHeight: "20px" },
  // === FOOTER ===
  footer: {
    padding: "20px 20px 36px",
    background: COLORS.surface,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: COLORS.outlineVariant,
  },
  approveBtn: {
    background: COLORS.primary,
    borderRadius: 14,
    height: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: SHADOWS.large,
  },
  approveBtnText: { ...TYPO.h4 },
  // === AVAILABILITY SECTION (QA-FIX-UI 2.1) ===
  availabilityCard: {
    background: COLORS.primaryLight, // #FFF4ED — primaryLight (khớp design HTML)
    borderRadius: 20,
    padding: 16,
  },
  availHeaderRow: { display: "flex", flexDirection: "row", gap: 4, marginBottom: 12 },
  availDayCell: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  availDayLabel: { ...TYPO.caption, fontWeight: 700 },
  availSlotBlock: { marginBottom: 8 },
  availSlotLabel: { ...TYPO.caption, fontWeight: 400, marginBottom: 6, display: "block" },
  availRow: { display: "flex", flexDirection: "row", gap: 4 },
  availCell: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  availCellAvailable: {
    background: COLORS.successBg, // #ECFDF5 — xanh nhạt (gần design #EAFBEF)
  },
  availCellBusy: {
    background: COLORS.surfaceContainer, // surface-variant (xám nhạt — ô bận)
  },
};

export default CandidateProfileScreen;
