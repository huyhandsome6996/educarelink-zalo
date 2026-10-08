/**
 * SettlementDetailScreen — port CHÍNH XÁC mobile/src/screens/Payment/SettlementDetailScreen.js (286 dòng).
 * Kỳ thanh toán hoa hồng 20% tiền mặt: getSettlementDetail(settlementId); không có
 * settlementId → getSettlements() và hiển thị kỳ gần nhất (RN giữ nguyên).
 * QR MoMo + nút mở MoMo (window.open — RN Platform.OS==='web' cũng thế),
 * overdue warning, paid info, info box.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - StatusBar light-content trên nền primary → StatusBarSpacer; header paddingTop
 *    56 của RN → StatusBarSpacer + paddingTop 12.
 *  - Alert.alert → showAlert(); Linking.openURL (nhánh native) gộp vào
 *    window.open (mọi nền tảng zalo là web).
 *  - expo-image Image → <img> (resizeMode contain → objectFit contain).
 *  - Icon: mọi glyph RN dùng đều có sẵn (wallet/warning/checkmark-circle/
 *    information-circle/receipt-outline/briefcase-outline/calendar-outline/arrow-back).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Spinner, showAlert, StatusBarSpacer, Touchable } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getSettlements, getSettlementDetail } from "@/api/misc";

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: COLORS.warning, bg: COLORS.warningBg, label: "Chờ sinh QR" },
  qr_generated: { color: COLORS.info, bg: COLORS.infoBg, label: "Đã có QR — chờ thanh toán" },
  paid: { color: COLORS.success, bg: COLORS.successBg, label: "Đã thanh toán" },
  overdue: { color: COLORS.error, bg: COLORS.errorBg, label: "Quá hạn" },
  cancelled: { color: COLORS.textMuted, bg: "#f3f4f6", label: "Đã huỷ" },
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
  emptyContainer: {
    flex: 1,
    minHeight: "100dvh",
    background: COLORS.background,
    display: "flex",
    flexDirection: "column",
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
  periodCard: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: SHADOWS.cardHover,
  },
  periodHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  periodLabel: { ...typo("overline"), color: COLORS.textMuted },
  periodValue: { ...typo("h4"), color: COLORS.textPrimary, fontWeight: 800 },
  statusBadge: { borderRadius: SIZES.radiusXl, padding: "4px 10px" },
  statusText: { ...typo("caption"), fontWeight: 700 },
  amountRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusSm,
    padding: 14,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  amountLabel: { ...typo("bodySmall"), color: COLORS.primaryDark, fontWeight: 600 },
  amountValue: { ...typo("h3"), color: COLORS.primary, fontWeight: 900 },
  statsRow: { display: "flex", flexDirection: "row", gap: 16 },
  statItem: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6 },
  statText: { ...typo("bodySmall"), color: COLORS.textSecondary, fontWeight: 600 },
  qrCard: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    boxShadow: SHADOWS.cardHover,
  },
  qrTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  qrDesc: { ...typo("bodySmall", { lineHeight: "20px" }), color: COLORS.textSecondary, textAlign: "center" },
  qrImageWrap: {
    width: 240,
    height: 240,
    borderRadius: SIZES.radiusMd,
    background: COLORS.background,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    border: `2px solid ${COLORS.primarySoft}`,
    overflow: "hidden",
    boxSizing: "border-box",
  },
  qrImage: { width: 220, height: 220, objectFit: "contain" },
  openMoMoBtn: {
    background: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 50,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: "0 24px",
    width: "100%",
    boxShadow: SHADOWS.large,
    boxSizing: "border-box",
  },
  openMoMoBtnText: { color: "#fff", ...typo("button", { fontSize: 15 }) },
  warningBox: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    background: COLORS.errorBg,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginBottom: 16,
    border: "1px solid #fecaca",
  },
  warningText: { flex: 1, ...typo("bodySmall", { lineHeight: "20px" }), color: COLORS.error },
  paidBox: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    background: COLORS.successBg,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginBottom: 16,
    border: "1px solid #bbf7d0",
  },
  paidText: { flex: 1, ...typo("bodySmall"), color: COLORS.success, fontWeight: 600 },
  infoBox: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    background: COLORS.primaryLight,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginBottom: 20,
    border: `1px solid ${COLORS.primarySoft}`,
  },
  infoText: { flex: 1, ...typo("bodySmall", { lineHeight: "20px" }), color: COLORS.primaryDark },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "60px 24px",
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
  emptyTitle: { ...typo("h5"), color: COLORS.textPrimary },
  emptyText: { ...typo("bodySmall", { lineHeight: "20px" }), color: COLORS.textMuted, textAlign: "center" },
};

const SettlementDetailScreen: React.FC<{ settlementId?: string }> = ({ settlementId }) => {
  const nav = useNav();
  const [settlement, setSettlement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (settlementId) {
          const res: any = await getSettlementDetail(settlementId);
          setSettlement(res);
        } else {
          // No specific ID → list all settlements
          const res: any = await getSettlements();
          if (res && res.length > 0) {
            setSettlement(res[0]); // Show latest
          }
        }
      } catch (e) {
        if (settlementId) {
          console.error(e);
          showAlert("Lỗi", "Không thể tải thông tin kỳ thanh toán.");
          nav.goBack();
        } else {
          console.error(e);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId]);

  if (isLoading) {
    return (
      <div style={S.loadingContainer}>
        <Spinner size={36} color={COLORS.primary} />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div style={S.emptyContainer}>
        <StatusBarSpacer />
        <div style={S.header}>
          <Touchable onPress={nav.goBack} style={S.backBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.textPrimary} />
          </Touchable>
          <div style={S.headerTitle}>Kỳ thanh toán</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={S.emptyState}>
          <div style={S.emptyIconCircle}>
            <Icon name="receipt-outline" size={40} color={COLORS.primary} />
          </div>
          <div style={S.emptyTitle}>Chưa có kỳ thanh toán</div>
          <div style={S.emptyText}>
            Khi bạn hoàn thành công việc thanh toán tiền mặt, hoa hồng 20% sẽ được tổng hợp vào cuối
            tháng và gửi QR cho bạn tại đây.
          </div>
        </div>
      </div>
    );
  }

  const st = STATUS_STYLE[settlement.status] || STATUS_STYLE.pending;
  const total = parseInt(settlement.total_amount) || 0;
  const dueAt = settlement.due_at ? new Date(settlement.due_at) : null;
  const isOverdue =
    settlement.status === "overdue" ||
    (dueAt && dueAt < new Date() && settlement.status === "qr_generated");
  const canPay = settlement.status === "qr_generated" || settlement.status === "overdue";

  const openMoMo = async () => {
    if (settlement.momo_pay_url) {
      try {
        // RN Platform.OS === 'web' → window.open (zalo luôn là web)
        window.open(settlement.momo_pay_url, "_blank");
      } catch (e) {
        showAlert("Lỗi", "Không thể mở MoMo. Vui lòng thử lại.");
      }
    } else {
      showAlert("Chưa có QR", "Vui lòng liên hệ Admin để được tạo QR thanh toán.");
    }
  };

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      {/* Header */}
      <div style={S.header}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Kỳ thanh toán hoa hồng</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={S.body}>
        {/* Period + Status */}
        <div style={S.periodCard}>
          <div style={S.periodHeader}>
            <div>
              <div style={S.periodLabel}>Kỳ thanh toán</div>
              <div style={S.periodValue}>
                Tháng {String(settlement.period_month).padStart(2, "0")}/{settlement.period_year}
              </div>
            </div>
            <div style={{ ...S.statusBadge, background: st.bg }}>
              <div style={{ ...S.statusText, color: st.color }}>{st.label}</div>
            </div>
          </div>

          <div style={S.amountRow}>
            <div style={S.amountLabel}>Tổng hoa hồng cần nộp</div>
            <div style={{ ...S.amountValue, ...(isOverdue ? { color: COLORS.error } : {}) }}>
              {total.toLocaleString("vi-VN")}đ
            </div>
          </div>

          <div style={S.statsRow}>
            <div style={S.statItem}>
              <Icon name="briefcase-outline" size={16} color={COLORS.primary} />
              <div style={S.statText}>{settlement.total_tasks} công việc</div>
            </div>
            {dueAt && (
              <div style={S.statItem}>
                <Icon
                  name="calendar-outline"
                  size={16}
                  color={isOverdue ? COLORS.error : COLORS.warning}
                />
                <div style={{ ...S.statText, ...(isOverdue ? { color: COLORS.error } : {}) }}>
                  Hạn:{" "}
                  {dueAt.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        {settlement.momo_qr_code_url && canPay && (
          <div style={S.qrCard}>
            <div style={S.qrTitle}>Quét QR để thanh toán</div>
            <div style={S.qrDesc}>
              Mở app MoMo → Quét mã → Quét mã QR bên dưới → Nhập số tiền{" "}
              {total.toLocaleString("vi-VN")}đ
            </div>
            <div style={S.qrImageWrap}>
              <img src={settlement.momo_qr_code_url} style={S.qrImage} alt="QR" />
            </div>
            <Touchable style={S.openMoMoBtn} onPress={openMoMo} activeOpacity={0.85}>
              <Icon name="wallet" size={20} color="#fff" />
              <div style={S.openMoMoBtnText}>Mở MoMo app</div>
            </Touchable>
          </div>
        )}

        {/* Overdue warning */}
        {isOverdue && (
          <div style={S.warningBox}>
            <Icon name="warning" size={20} color={COLORS.error} />
            <div style={S.warningText}>
              Kỳ thanh toán đã quá hạn. Vui lòng thanh toán sớm để tránh khoá tài khoản.
            </div>
          </div>
        )}

        {/* Paid info */}
        {settlement.status === "paid" && settlement.paid_at && (
          <div style={S.paidBox}>
            <Icon name="checkmark-circle" size={20} color={COLORS.success} />
            <div style={S.paidText}>
              Đã thanh toán vào {new Date(settlement.paid_at).toLocaleString("vi-VN")}
            </div>
          </div>
        )}

        {/* Info */}
        <div style={S.infoBox}>
          <Icon name="information-circle" size={18} color={COLORS.primary} />
          <div style={S.infoText}>
            Đây là tổng hợp hoa hồng 20% từ các công việc thanh toán tiền mặt trong tháng. Hệ thống
            tự động sinh QR vào ngày 1 hàng tháng.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementDetailScreen;
