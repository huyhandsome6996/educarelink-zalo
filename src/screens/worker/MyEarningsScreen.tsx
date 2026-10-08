/**
 * MyEarningsScreen — port CHÍNH XÁC mobile/src/screens/Payment/MyEarningsScreen.js (255 dòng).
 * Thu nhập CarePartner: getMyEarnings() + getMyPayments() — backend trả SỐ DẠNG
 * STRING → parseFloat/parseInt trước khi format vi-VN (giữ nguyên như RN).
 * Stats cards (Đã nhận / Chờ giải ngân), card hoa hồng tiền mặt cần nộp →
 * SettlementDetail, recent_payments từ earnings.recent_payments.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar light-content trên nền primary → StatusBarSpacer; header paddingTop
 *    56 của RN → StatusBarSpacer + paddingTop 12.
 *  - RefreshControl (kéo làm mới) không có trên web — bỏ; fetch khi mount
 *    (RN useEffect [] tương đương).
 *  - navigation.navigate('SettlementDetail') giữ nguyên (không có settlementId →
 *    SettlementDetailScreen tự fetch kỳ gần nhất — Fix C2 của RN).
 *  - Icon: mọi glyph RN dùng đều có sẵn (wallet/time/receipt/receipt-outline/
 *    chevron-forward/arrow-back).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getMyEarnings, getMyPayments } from "@/api/misc";

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: COLORS.warning, bg: COLORS.warningBg, label: "Chờ thanh toán" },
  held: { color: COLORS.info, bg: COLORS.infoBg, label: "Đang giữ tiền" },
  completed: { color: COLORS.success, bg: COLORS.successBg, label: "Đã hoàn tất" },
  cancelled: { color: COLORS.textMuted, bg: "#f3f4f6", label: "Đã huỷ" },
  refunded: { color: COLORS.info, bg: COLORS.infoBg, label: "Đã hoàn tiền" },
  payout_failed: { color: COLORS.error, bg: COLORS.errorBg, label: "Giải ngân thất bại" },
};

const METHOD_LABEL: Record<string, string> = {
  momo_escrow: "MoMo",
  cash: "Tiền mặt",
};

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  loadingContainer: {
    flex: 1,
    minHeight: "100dvh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: COLORS.background,
  },
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
    justifyContent: "space-between",
    padding: "12px 16px 16px",
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
  },
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800 },
  body: { flex: 1, overflowY: "auto", padding: 16 },
  statsGrid: { display: "flex", flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    gap: 6,
    border: "1px solid",
    boxShadow: SHADOWS.cardHover,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  statLabel: { ...typo("caption"), color: COLORS.textSecondary, fontWeight: 600 },
  statValue: { ...typo("h4"), fontWeight: 900 },
  owedCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    background: COLORS.warningBg,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 20,
    border: "1px solid #fde68a",
    boxShadow: SHADOWS.cardHover,
  },
  owedIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: COLORS.warning,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  owedContent: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  owedTitle: { ...typo("bodySmall"), color: COLORS.warning, fontWeight: 600 },
  owedValue: { ...typo("h4"), color: COLORS.warning, fontWeight: 900 },
  owedHint: { ...typo("caption"), color: COLORS.textSecondary, fontWeight: 700, letterSpacing: 0.5 },
  sectionTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700, marginBottom: 10 },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 0",
    gap: 10,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: COLORS.primaryLight,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  emptyTitle: { ...typo("h5"), color: COLORS.textPrimary },
  emptyText: { ...typo("bodySmall"), color: COLORS.textMuted, textAlign: "center" },
  paymentCard: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    boxShadow: SHADOWS.cardHover,
    borderLeft: `4px solid ${COLORS.primary}`,
    display: "flex",
    flexDirection: "column",
  },
  paymentTopRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: { borderRadius: SIZES.radiusXs, padding: "3px 8px" },
  statusText: { ...typo("overline"), fontWeight: 700 },
  methodBadge: {
    ...typo("caption"),
    color: COLORS.textSecondary,
    fontWeight: 600,
    background: COLORS.background,
    padding: "3px 8px",
    borderRadius: SIZES.radiusXs,
  },
  paymentTask: {
    ...typo("h5"),
    color: COLORS.textPrimary,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  paymentAmountsRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTop: `1px solid ${COLORS.border}`,
  },
  amountLabel: { ...typo("overline"), color: COLORS.textMuted },
  amountValue: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 700 },
};

const MyEarningsScreen: React.FC = () => {
  const nav = useNav();
  const [earnings, setEarnings] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [earnRes, payRes] = await Promise.all([getMyEarnings(), getMyPayments()]);
      setEarnings(earnRes);
      setPayments((payRes as any) || []);
    } catch (e) {
      console.error("Lỗi tải thu nhập:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div style={S.loadingContainer}>
        <Spinner size={36} color={COLORS.primary} />
      </div>
    );
  }

  const totalEarned = parseFloat(earnings?.total_earned || 0);
  const pendingPayout = parseFloat(earnings?.pending_payout || 0);
  const owed = parseFloat(earnings?.cash_commission_owed || 0);
  const recentPayments = earnings?.recent_payments || [];

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      {/* Header */}
      <div style={S.header}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Thu nhập của tôi</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={S.body}>
        {/* Stats Cards */}
        <div style={S.statsGrid}>
          <div style={{ ...S.statCard, background: COLORS.successBg, borderColor: "#bbf7d0" }}>
            <div style={{ ...S.statIconCircle, background: COLORS.success }}>
              <Icon name="wallet" size={20} color="#fff" />
            </div>
            <div style={S.statLabel}>Đã nhận</div>
            <div style={{ ...S.statValue, color: COLORS.success }}>
              {totalEarned.toLocaleString("vi-VN")}đ
            </div>
          </div>

          <div style={{ ...S.statCard, background: COLORS.infoBg, borderColor: "#bfdbfe" }}>
            <div style={{ ...S.statIconCircle, background: COLORS.info }}>
              <Icon name="time" size={20} color="#fff" />
            </div>
            <div style={S.statLabel}>Chờ giải ngân</div>
            <div style={{ ...S.statValue, color: COLORS.info }}>
              {pendingPayout.toLocaleString("vi-VN")}đ
            </div>
          </div>
        </div>

        {/* Cash commission owed */}
        {owed > 0 && (
          <Touchable
            style={S.owedCard}
            // Fix C2: screen 'SettlementList' không được đăng ký trong AppNavigator.
            // Tên đúng là 'SettlementDetail'. Khi không có settlementId cụ thể,
            // SettlementDetailScreen sẽ tự fetch & hiển thị kỳ gần nhất.
            // Trước đây bấm "Xem chi tiết" sẽ crash/silent fail vì navigate
            // tới screen không tồn tại.
            onPress={() => nav.navigate("SettlementDetail")}
            activeOpacity={0.85}
          >
            <div style={S.owedIconCircle}>
              <Icon name="receipt" size={22} color="#fff" />
            </div>
            <div style={S.owedContent}>
              <div style={S.owedTitle}>Hoa hồng tiền mặt cần nộp</div>
              <div style={S.owedValue}>{owed.toLocaleString("vi-VN")}đ</div>
              <div style={S.owedHint}>Cuối tháng hệ thống sẽ gửi mã QR MoMo → Xem chi tiết</div>
            </div>
            <Icon name="chevron-forward" size={20} color={COLORS.warning} />
          </Touchable>
        )}

        {/* Recent payments */}
        <div style={S.sectionTitle}>Giao dịch gần đây</div>
        {recentPayments.length === 0 ? (
          <div style={S.emptyState}>
            <div style={S.emptyIconCircle}>
              <Icon name="receipt-outline" size={36} color={COLORS.primary} />
            </div>
            <div style={S.emptyTitle}>Chưa có giao dịch</div>
            <div style={S.emptyText}>Hoàn thành công việc đầu tiên để nhận thanh toán</div>
          </div>
        ) : (
          recentPayments.map((payment: any) => {
            const st = STATUS_STYLE[payment.status] || STATUS_STYLE.pending;
            return (
              <Touchable
                key={payment.id}
                style={S.paymentCard}
                onPress={() => nav.navigate("PaymentDetail", { paymentId: payment.id })}
                activeOpacity={0.8}
              >
                <div style={S.paymentTopRow}>
                  <div style={{ ...S.statusBadge, background: st.bg }}>
                    <div style={{ ...S.statusText, color: st.color }}>{st.label}</div>
                  </div>
                  <div style={S.methodBadge}>
                    {METHOD_LABEL[payment.method] || payment.method}
                  </div>
                </div>
                <div style={S.paymentTask}>{payment.task_title}</div>
                <div style={S.paymentAmountsRow}>
                  <div>
                    <div style={S.amountLabel}>Tổng</div>
                    <div style={S.amountValue}>
                      {parseInt(payment.amount).toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                  <div>
                    <div style={S.amountLabel}>Bạn nhận</div>
                    <div style={{ ...S.amountValue, color: COLORS.success }}>
                      {parseInt(payment.worker_payout_amount).toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                  <div>
                    <div style={S.amountLabel}>Hoa hồng</div>
                    <div style={{ ...S.amountValue, color: COLORS.warning }}>
                      {parseInt(payment.commission_amount).toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                </div>
              </Touchable>
            );
          })
        )}

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
};

export default MyEarningsScreen;
