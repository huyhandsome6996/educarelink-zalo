/**
 * RewardPointsScreen — port CHÍNH XÁC mobile/src/screens/Parent/RewardPointsScreen.js (527 dòng).
 * Điểm thưởng & Voucher — toàn bộ data là MOCK (backend chưa có model RewardPoint),
 * copy NGUYÊN từ mobile/src/mocks/rewardPointsMock.js → src/mocks/rewardPointsMock.ts.
 * Có banner "Sắp ra mắt" (WIRING FIX 2026-08-21 của RN) để người dùng không hiểu nhầm.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Animated.timing fade 250ms → CSS transition opacity + rAF.
 * - StatusBar + insets.top + 32 → <StatusBarSpacer /> + paddingTop 32.
 * - showComingSoon (Alert 1 nút "Đã hiểu") → showAlert cùng nội dung.
 * - Icon thiếu glyph trong bộ 159 (construct, cafe, fast-food, cart, swap-vertical)
 *   → map glyph Ionicons gần nhất cùng nghĩa (ic() bên dưới).
 */
import React, { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { MOCK_REWARDS, MOCK_VOUCHERS, MOCK_HISTORY } from "@/mocks/rewardPointsMock";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph Ionicons gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      construct: "settings-outline",
      cafe: "restaurant",
      "fast-food": "restaurant",
      cart: "bag",
      "swap-vertical": "sync-outline",
    } as Record<string, string>
  )[name] ?? name;

/** RN utils/comingSoon.js — Alert 1 nút "Đã hiểu" */
const showComingSoon = (featureName?: string) => {
  showAlert(
    "Thông báo",
    featureName
      ? `Tính năng "${featureName}" đang được phát triển. Vui lòng quay lại sau!`
      : "Tính năng đang được phát triển. Vui lòng quay lại sau!"
  );
};

interface Voucher {
  id: number;
  title: string;
  expiry: string;
  pointsRequired: number;
  icon: string;
  iconColor: string;
  iconBg: string;
}

const RewardPointsScreen: React.FC = () => {
  const nav = useNav();

  // QA-FIX-UI 3.2: fade-in animation khi mount (opacity 0→1) — CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const progressPercent = (MOCK_REWARDS.currentPoints / MOCK_REWARDS.nextTierPoints) * 100;
  const pointsToNext = MOCK_REWARDS.nextTierPoints - MOCK_REWARDS.currentPoints;

  const handleRedeem = (voucher: Voucher) => {
    if (MOCK_REWARDS.currentPoints < voucher.pointsRequired) {
      showComingSoon(`Bạn cần thêm ${voucher.pointsRequired - MOCK_REWARDS.currentPoints} điểm để đổi voucher này`);
    } else {
      showComingSoon(`Đổi "${voucher.title}" (${voucher.pointsRequired} pts)`);
    }
  };

  const renderVoucher = (voucher: Voucher) => (
    <div key={voucher.id} style={S.voucherCard}>
      {/* Image / icon placeholder */}
      <div style={{ ...S.voucherImageBox, background: voucher.iconBg }}>
        <Icon name={ic(voucher.icon)} size={32} color={voucher.iconColor} />
      </div>

      <div style={S.voucherInfo}>
        <span style={{ ...S.voucherTitle, color: COLORS.onSurface, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {voucher.title}
        </span>
        <span style={{ ...S.voucherExpiry, color: COLORS.onSurfaceVariant }}>Hết hạn: {voucher.expiry}</span>
        <div style={S.voucherPointsRow}>
          <Icon name="star" size={14} color={COLORS.primary} />
          <span style={{ ...S.voucherPointsText, color: COLORS.primary }}>{voucher.pointsRequired} pts</span>
        </div>
      </div>

      <Touchable
        style={{
          ...S.redeemBtn,
          background: MOCK_REWARDS.currentPoints < voucher.pointsRequired ? COLORS.surfaceContainer : COLORS.primary,
        }}
        onPress={() => handleRedeem(voucher)}
        activeOpacity={0.85}
      >
        <span
          style={{
            ...S.redeemBtnText,
            color: MOCK_REWARDS.currentPoints < voucher.pointsRequired ? COLORS.onSurfaceVariant : COLORS.textOnPrimary,
          }}
        >
          {MOCK_REWARDS.currentPoints >= voucher.pointsRequired ? "Đổi ngay" : "Thiếu điểm"}
        </span>
      </Touchable>
    </div>
  );

  const renderHistoryItem = (item: { id: number; title: string; points: number; date: string; icon: string }) => {
    const isPositive = item.points > 0;
    return (
      <div key={item.id} style={S.historyItem}>
        <div style={{ ...S.historyIcon, background: isPositive ? COLORS.secondaryLight : COLORS.surfaceContainerHigh }}>
          <Icon name={ic(item.icon)} size={16} color={isPositive ? COLORS.secondary : COLORS.onSurfaceVariant} />
        </div>
        <div style={S.historyInfo}>
          <span style={{ ...S.historyTitleStyle, color: COLORS.onSurface, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.title}
          </span>
          <span style={{ ...S.historyDate, color: COLORS.onSurfaceVariant, marginTop: 2 }}>{item.date}</span>
        </div>
        <span style={{ ...S.historyPoints, color: isPositive ? COLORS.secondary : COLORS.errorDeep }}>
          {isPositive ? "+" : ""}
          {item.points} pts
        </span>
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
        <StatusBarSpacer />

        {/* Top App Bar */}
        <div style={S.appBar}>
          <Touchable onPress={nav.goBack} style={S.appBarBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.primary} />
          </Touchable>
          <span style={{ ...S.appBarTitle, color: COLORS.primary }}>Điểm thưởng</span>
          <Touchable style={S.appBarBtn} onPress={() => nav.navigate("Notifications")}>
            <Icon name="notifications-outline" size={22} color={COLORS.primary} />
          </Touchable>
        </div>

        {/* Scroll content */}
        <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: "24px 20px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
            {/* WIRING FIX (2026-08-21): Banner "Sắp ra mắt" — backend chưa có model RewardPoint */}
            <div style={{ ...S.comingSoonBanner, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
              <Icon name={ic("construct")} size={18} color={COLORS.primary} />
              <span style={{ ...S.comingSoonText, color: COLORS.primary }}>
                Tính năng đang được phát triển. Dữ liệu hiển thị dưới đây là minh họa, không phải dữ liệu thật.
              </span>
            </div>

            {/* Title section */}
            <div style={S.titleSection}>
              <span style={{ ...S.title, color: COLORS.onSurface }}>Điểm thưởng của bạn</span>
              <span style={{ ...S.subtitle, color: COLORS.onSurfaceVariant }}>
                Tích lũy điểm để đổi những phần quà hấp dẫn.
              </span>
            </div>

            {/* Hero card — primary bg, điểm hiện tại + progress */}
            <div style={{ ...S.heroCard, background: COLORS.primary }}>
              {/* Decorative blurred circles */}
              <div style={S.heroDecorCircle1} />
              <div style={S.heroDecorCircle2} />

              <div style={S.heroContent}>
                <span style={{ ...S.heroLabel, color: "rgba(255, 255, 255, 0.9)" }}>Số điểm hiện tại</span>
                <div style={S.heroPointsRow}>
                  <span style={{ ...S.heroPoints, color: COLORS.textOnPrimary }}>
                    {MOCK_REWARDS.currentPoints.toLocaleString("vi-VN")}
                  </span>
                  <span style={{ ...S.heroUnit, color: "rgba(255, 255, 255, 0.9)" }}>pts</span>
                </div>
                <span style={{ ...S.heroTier, color: COLORS.textOnPrimary }}>Hạng {MOCK_REWARDS.currentTier}</span>

                {/* Progress bar */}
                <div style={S.progressSection}>
                  <div style={S.progressLabelRow}>
                    <span style={{ ...S.progressText, color: "rgba(255, 255, 255, 0.9)" }}>
                      Hạng {MOCK_REWARDS.nextTier}
                    </span>
                    <span style={{ ...S.progressText, color: "rgba(255, 255, 255, 0.9)" }}>
                      {MOCK_REWARDS.nextTierPoints.toLocaleString("vi-VN")} pts
                    </span>
                  </div>
                  <div style={S.progressBarBg}>
                    <div style={{ ...S.progressBarFill, width: `${progressPercent}%` }} />
                  </div>
                  <span style={{ ...S.progressNote, color: "rgba(255, 255, 255, 0.8)" }}>
                    Còn {pointsToNext} điểm nữa để thăng hạng
                  </span>
                </div>
              </div>
            </div>

            {/* Voucher section */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={S.sectionTitleRow}>
                  <Icon name="gift" size={20} color={COLORS.primary} />
                  <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Ưu đãi của bạn</span>
                </div>
                <Touchable onPress={() => showComingSoon("Xem tất cả voucher")}>
                  <span style={{ ...S.seeAllLink, color: COLORS.primary }}>Xem tất cả</span>
                </Touchable>
              </div>
              <div style={S.voucherList}>{MOCK_VOUCHERS.map(renderVoucher)}</div>
            </div>

            {/* History section */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={S.sectionTitleRow}>
                  <Icon name="time" size={20} color={COLORS.primary} />
                  <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Lịch sử tích điểm</span>
                </div>
              </div>
              <div style={{ ...S.historyList, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
                {MOCK_HISTORY.map(renderHistoryItem)}
              </div>
            </div>

            {/* How to earn section */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Cách tích điểm</span>
              <div style={{ ...S.earnCard, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
                <div style={S.earnItem}>
                  <div style={{ ...S.earnIcon, background: COLORS.secondaryLight }}>
                    <Icon name="checkmark-circle" size={18} color={COLORS.secondary} />
                  </div>
                  <span style={{ ...S.earnText, color: COLORS.onSurface }}>Hoàn thành việc: +50 pts</span>
                </div>
                <div style={S.earnItem}>
                  <div style={{ ...S.earnIcon, background: COLORS.primaryLight }}>
                    <Icon name="star" size={18} color={COLORS.primary} />
                  </div>
                  <span style={{ ...S.earnText, color: COLORS.onSurface }}>Đánh giá 5 sao: +20 pts</span>
                </div>
                <div style={S.earnItem}>
                  <div style={{ ...S.earnIcon, background: COLORS.secondaryLight }}>
                    <Icon name="people" size={18} color={COLORS.secondary} />
                  </div>
                  <span style={{ ...S.earnText, color: COLORS.onSurface }}>Giới thiệu bạn bè: +200 pts</span>
                </div>
              </div>
            </div>

            <div style={{ height: 60 }} />
          </div>
        </div>
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
    borderBottom: `1px solid ${COLORS.outlineVariant}`,
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
  appBarTitle: { ...TYPO.h2, flex: 1, textAlign: "center" },
  // === TITLE SECTION ===
  titleSection: { display: "flex", flexDirection: "column", gap: 4 },
  title: { ...TYPO.h2 },
  subtitle: { ...TYPO.body },
  // === HERO CARD ===
  heroCard: {
    borderRadius: 20,
    padding: 24,
    overflow: "hidden",
    boxShadow: SHADOWS.large,
    position: "relative",
  },
  heroDecorCircle1: {
    position: "absolute",
    top: -32,
    right: -32,
    width: 192,
    height: 192,
    borderRadius: 96,
    background: "rgba(255, 255, 255, 0.1)",
  },
  heroDecorCircle2: {
    position: "absolute",
    bottom: -48,
    left: -48,
    width: 128,
    height: 128,
    borderRadius: 64,
    background: "rgba(0, 0, 0, 0.05)",
  },
  heroContent: { display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, position: "relative" },
  heroLabel: { ...TYPO.h4, marginBottom: 8 },
  heroPointsRow: { display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 6 },
  heroPoints: { fontSize: 48, fontWeight: 900, letterSpacing: -1.5, lineHeight: "50px" },
  heroUnit: { ...TYPO.h3, paddingBottom: 8 },
  heroTier: { ...TYPO.body, fontWeight: 700, marginTop: 4 },
  // === PROGRESS ===
  progressSection: {
    width: "100%",
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid rgba(255, 255, 255, 0.2)",
    boxSizing: "border-box",
  },
  progressLabelRow: { display: "flex", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressText: { ...TYPO.caption },
  progressBarBg: {
    width: "100%",
    height: 12,
    background: "rgba(0, 0, 0, 0.1)",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", background: "#ffffff", borderRadius: 6 },
  progressNote: { ...TYPO.caption, textAlign: "right", marginTop: 8, display: "block" },
  // === SECTIONS ===
  section: { display: "flex", flexDirection: "column", gap: 12 },
  sectionHeader: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { ...TYPO.h3 },
  seeAllLink: { ...TYPO.caption, fontWeight: 700 },
  // === VOUCHER LIST ===
  voucherList: { display: "flex", flexDirection: "column", gap: 12 },
  voucherCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    background: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    border: `1px solid ${COLORS.outlineVariant}`,
    boxShadow: SHADOWS.small,
  },
  voucherImageBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  voucherInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  voucherTitle: { ...TYPO.h4, fontSize: 15 },
  voucherExpiry: { ...TYPO.caption },
  voucherPointsRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  voucherPointsText: { ...TYPO.body, fontSize: 13, fontWeight: 700 },
  redeemBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  redeemBtnText: { ...TYPO.caption, fontWeight: 700 },
  // === HISTORY ===
  historyList: {
    borderRadius: 16,
    padding: 12,
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  historyItem: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: `1px solid ${COLORS.outlineVariant}`,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  historyInfo: { flex: 1, minWidth: 0 },
  historyTitleStyle: { ...TYPO.body, fontSize: 13, fontWeight: 600, display: "block" },
  historyDate: { ...TYPO.caption, display: "block" },
  historyPoints: { ...TYPO.h4, fontSize: 14, fontWeight: 800, flexShrink: 0 },
  // === EARN SECTION ===
  earnCard: {
    borderRadius: 16,
    padding: 16,
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: SHADOWS.small,
  },
  earnItem: { display: "flex", flexDirection: "row", alignItems: "center", gap: 12 },
  earnIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  earnText: { ...TYPO.body, fontSize: 14 },
  // === COMING SOON BANNER ===
  comingSoonBanner: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 12,
    border: "1px solid",
    marginBottom: 16,
  },
  comingSoonText: { flex: 1, ...TYPO.bodySmall, lineHeight: "18px", fontWeight: 600 },
};

export default RewardPointsScreen;
