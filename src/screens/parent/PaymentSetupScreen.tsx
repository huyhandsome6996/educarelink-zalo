/**
 * PaymentSetupScreen — port CHÍNH XÁC mobile/src/screens/Payment/PaymentSetupScreen.js (305 dòng).
 * Modal "Thiết lập thanh toán" (presentation:'modal' trong AppNavigator — mở bằng
 * nav.openModal('PaymentSetup'), đóng bằng nav.goBack()).
 * Chọn phương thức: momo_escrow / payos (VietQR) / cash → setupPayment / setupPayOS
 * → điều hướng đúng RN (open checkout URL → alert → goBack).
 * Params: taskId, taskTitle, taskPrice (giống route.params RN).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Linking.openURL → window.open(url, '_blank'). Zalo production: đổi tại 2 điểm
 *   gọi window.open sang zmp-sdk openWebview (giữ comment tại chỗ).
 * - Alert.alert 1 nút OK + onPress goBack → window.confirm (OK = confirm + goBack,
 *   huỷ = ở lại màn hình — action duy nhất của RN vẫn được thực hiện).
 * - Alert.alert 1 nút OK thuần (lỗi/chưa chọn) → showAlert(title, msg).
 * - Icon thiếu glyph (trending-down) → glyph gần nhất (ic()).
 * - RN paddingTop 56 của header → <StatusBarSpacer /> + paddingTop 16.
 */
import React, { useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { setupPayment, setupPayOS } from "@/api/misc";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      "trending-down": "stats-chart-outline",
    } as Record<string, string>
  )[name] ?? name;

const money = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

interface PaymentSetupScreenProps {
  taskId?: string | number;
  taskTitle?: string;
  taskPrice?: string | number;
}

const PaymentSetupScreen: React.FC<PaymentSetupScreenProps> = ({ taskId, taskTitle, taskPrice }) => {
  const nav = useNav();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const price = parseInt(String(taskPrice), 10) || 0;
  const commission = Math.round(price * 0.2);
  const workerGets = price - commission;

  const handleSubmit = async () => {
    if (!selectedMethod) {
      showAlert("Chưa chọn", "Vui lòng chọn phương thức thanh toán.");
      return;
    }
    setIsLoading(true);
    try {
      if (selectedMethod === "payos") {
        // PayOS flow — tạo payment link, mở checkout URL
        const data = (await setupPayOS(taskId as string | number)) as any;
        if (data?.checkout_url) {
          // Zalo production: window.open → zmp-sdk openWebview
          window.open(data.checkout_url, "_blank");
          // RN: Alert 1 nút OK → onPress goBack. Web: confirm (OK → goBack).
          if (
            window.confirm(
              "🔗 Đang chuyển tới PayOS\n\n" +
                `Quét QR VietQR bằng app ngân hàng để chuyển khoản ${money(price)}.\n\n` +
                "Tiền sẽ được GIỮ đến khi Carepartner hoàn thành công việc."
            )
          ) {
            nav.goBack();
          }
        } else {
          showAlert("Lỗi", "Không tạo được payment link PayOS.");
        }
      } else {
        // MoMo / Cash flow
        const payment = (await setupPayment(taskId as string | number, selectedMethod)) as any;

        if (selectedMethod === "momo_escrow") {
          if (!payment?.momo_configured) {
            showAlert(
              "MoMo chưa sẵn sàng",
              'Hệ thống chưa cấu hình MoMo. Vui lòng chọn "PayOS" hoặc "Tiền mặt".'
            );
          } else if (payment?.momo_pay_url) {
            // Zalo production: window.open → zmp-sdk openWebview
            window.open(payment.momo_pay_url, "_blank");
            // RN: Alert 1 nút OK → onPress goBack. Web: confirm (OK → goBack).
            if (
              window.confirm(
                "Đã tạo giao dịch\n\nĐang chuyển bạn tới MoMo. Sau khi thanh toán, tiền sẽ được giữ đến khi Carepartner hoàn thành."
              )
            ) {
              nav.goBack();
            }
          }
        } else {
          // cash
          if (
            window.confirm(
              "✅ Đã ghi nhận\n\nCông việc sẽ thanh toán tiền mặt. Sau khi hoàn thành, hoa hồng 20% sẽ được tổng hợp và gửi QR cho bạn vào cuối tháng."
            )
          ) {
            nav.goBack();
          }
        }
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Không thể thiết lập thanh toán.";
      showAlert("Lỗi", msg);
    } finally {
      setIsLoading(false);
    }
  };

  const METHODS = [
    {
      id: "momo_escrow",
      icon: "wallet",
      label: "MoMo Escrow",
      desc: "Phụ huynh trả qua MoMo — tiền được GIỮ. Carepartner xong việc → tự động chuyển 80% cho Carepartner, 20% hoa hồng cho nền tảng.",
      color: COLORS.primary,
      recommended: true,
      badge: "",
    },
    {
      id: "payos",
      icon: "qr-code",
      label: "PayOS VietQR",
      desc: "Phụ huynh quét QR bằng app ngân hàng (BIDV, VCB, MB...) — MIỄN PHÍ 100%. Tiền được GIỮ. Carepartner xong việc → admin chuyển 80% cho Carepartner.",
      color: COLORS.info,
      recommended: false,
      badge: "MIỄN PHÍ",
    },
    {
      id: "cash",
      icon: "cash-outline",
      label: "Tiền mặt",
      desc: "Phụ huynh trả trực tiếp cho Carepartner sau khi xong việc. Cuối tháng, hệ thống gửi mã QR MoMo để Carepartner thanh toán 20% hoa hồng cho nền tảng.",
      color: COLORS.success,
      recommended: false,
      badge: "",
    },
  ];

  return (
    <Screen bg={COLORS.background} scroll={false}>
      <StatusBarSpacer />
      {/* Header */}
      <div style={{ ...S.header, borderBottom: `1px solid ${COLORS.border}` }}>
        <Touchable onPress={nav.goBack} style={{ ...S.backBtn, background: COLORS.background }}>
          <Icon name="close" size={22} color={COLORS.textSecondary} />
        </Touchable>
        <span style={{ ...S.headerTitle, color: COLORS.textPrimary }}>Thiết lập thanh toán</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Body scroll */}
      <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16, boxSizing: "border-box" }}>
        {/* Task summary */}
        <div style={{ ...S.taskCard, background: COLORS.surface, borderLeft: `4px solid ${COLORS.primary}` }}>
          <Icon name="briefcase-outline" size={20} color={COLORS.primary} />
          <div style={S.taskInfo}>
            <span style={{ ...S.taskTitle, color: COLORS.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
              {taskTitle || `Công việc #${taskId}`}
            </span>
            <span style={{ ...S.taskPrice, color: COLORS.primary, marginTop: 2 }}>{money(price)}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ ...S.breakdownCard, background: COLORS.surface }}>
          <span style={{ ...S.breakdownTitle, color: COLORS.textPrimary }}>Chi tiết thanh toán</span>
          <div style={S.breakdownRow}>
            <span style={{ ...S.breakdownLabel, color: COLORS.textSecondary }}>Tổng tiền phụ huynh trả</span>
            <span style={{ ...S.breakdownValue, color: COLORS.textPrimary }}>{money(price)}</span>
          </div>
          <div style={{ ...S.breakdownRow, background: COLORS.warningBg }}>
            <div style={S.breakdownLabelRow}>
              <Icon name={ic("trending-down")} size={14} color={COLORS.warning} />
              <span style={{ ...S.breakdownLabel, color: COLORS.warning }}>Hoa hồng nền tảng (20%)</span>
            </div>
            <span style={{ ...S.breakdownValue, color: COLORS.warning }}>{money(commission)}</span>
          </div>
          <div style={{ ...S.breakdownRow, background: COLORS.successBg }}>
            <div style={S.breakdownLabelRow}>
              <Icon name="trending-up" size={14} color={COLORS.success} />
              <span style={{ ...S.breakdownLabel, color: COLORS.success }}>Carepartner nhận</span>
            </div>
            <span style={{ ...S.breakdownValue, color: COLORS.success, fontWeight: 900 }}>{money(workerGets)}</span>
          </div>
        </div>

        {/* Method options */}
        <span style={{ ...S.sectionLabel, color: COLORS.textMuted }}>Chọn phương thức thanh toán</span>
        {METHODS.map((method) => {
          const isSelected = selectedMethod === method.id;
          return (
            <Touchable
              key={method.id}
              style={{
                ...S.methodCard,
                background: isSelected ? COLORS.primaryLight : COLORS.surface,
                borderColor: isSelected ? COLORS.primary : COLORS.border,
              }}
              onPress={() => setSelectedMethod(method.id)}
              activeOpacity={0.85}
            >
              <div style={{ ...S.methodIconCircle, background: `${method.color}15` }}>
                <Icon name={method.icon} size={24} color={method.color} />
              </div>
              <div style={S.methodContent}>
                <div style={S.methodHeader}>
                  <span style={{ ...S.methodLabel, color: COLORS.textPrimary }}>{method.label}</span>
                  {method.recommended && (
                    <div style={{ ...S.recommendedBadge, background: COLORS.primary }}>
                      <span style={{ ...S.recommendedText, color: "#fff" }}>Khuyên dùng</span>
                    </div>
                  )}
                  {method.badge ? (
                    <div style={{ ...S.recommendedBadge, background: COLORS.success }}>
                      <span style={{ ...S.recommendedText, color: "#fff" }}>{method.badge}</span>
                    </div>
                  ) : null}
                </div>
                <span style={{ ...S.methodDesc, color: COLORS.textSecondary, lineHeight: "18px" }}>{method.desc}</span>
              </div>
              <div style={{ ...S.radioOuter, borderColor: isSelected ? COLORS.primary : COLORS.border }}>
                {isSelected && <div style={{ ...S.radioInner, background: COLORS.primary }} />}
              </div>
            </Touchable>
          );
        })}

        <div style={{ ...S.infoBox, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
          <Icon name="information-circle" size={18} color={COLORS.primary} />
          <span style={{ ...S.infoText, color: COLORS.primaryDark }}>
            Với MoMo Escrow: tiền được GIỮ an toàn. Chỉ chuyển cho Carepartner khi công việc hoàn thành. Nếu huỷ
            việc khi đang giữ tiền → hoàn 100% cho phụ huynh.
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ ...S.footer, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}` }}>
        <Touchable
          style={{
            ...S.submitBtn,
            background: COLORS.primary,
            opacity: !selectedMethod || isLoading ? 0.6 : 1,
          }}
          onPress={handleSubmit}
          disabled={!selectedMethod || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <Spinner size={24} color="#fff" />
          ) : (
            <>
              <Icon name="checkmark-circle" size={20} color="#fff" />
              <span style={{ ...S.submitText, color: "#fff", fontSize: 16 }}>Xác nhận thiết lập</span>
            </>
          )}
        </Touchable>
      </div>
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px 16px",
    background: COLORS.surface,
    boxShadow: SHADOWS.small,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTitle: { ...TYPO.h4, fontWeight: 800 },
  taskCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 12,
    boxShadow: SHADOWS.cardHover,
  },
  taskInfo: { flex: 1, minWidth: 0 },
  taskTitle: { ...TYPO.h5, fontWeight: 600 },
  taskPrice: { ...TYPO.h4, fontWeight: 900, display: "block" },
  breakdownCard: {
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    boxShadow: SHADOWS.cardHover,
  },
  breakdownTitle: { ...TYPO.h5, fontWeight: 700, marginBottom: 4 },
  breakdownRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: SIZES.radiusSm,
    gap: 10,
  },
  breakdownLabelRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  breakdownLabel: { ...TYPO.bodySmall, flexShrink: 1 },
  breakdownValue: { ...TYPO.h5, fontWeight: 700, flexShrink: 0 },
  sectionLabel: { ...TYPO.overline, marginBottom: 10, display: "block" },
  methodCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    marginBottom: 10,
    border: "2px solid",
    boxShadow: SHADOWS.small,
  },
  methodIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  methodContent: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  methodHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  methodLabel: { ...TYPO.h5, fontWeight: 700 },
  recommendedBadge: {
    borderRadius: SIZES.radiusXl,
    padding: "2px 8px",
  },
  recommendedText: { ...TYPO.overline, fontSize: 9, fontWeight: 700 },
  methodDesc: { ...TYPO.bodySmall },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    border: "2px solid",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  infoBox: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: SIZES.radiusMd,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
    border: "1px solid",
  },
  infoText: { flex: 1, ...TYPO.bodySmall, lineHeight: "20px" },
  footer: { padding: "20px 20px 36px" },
  submitBtn: {
    borderRadius: SIZES.radiusMd,
    height: 56,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    boxShadow: SHADOWS.large,
  },
  submitText: { ...TYPO.button },
};

export default PaymentSetupScreen;
