/**
 * PaymentDetailScreen — port CHÍNH XÁC mobile/src/screens/Payment/PaymentDetailScreen.js (257 dòng).
 * Chi tiết 1 khoản thanh toán: status badge, số tiền, info grid (method, mã MoMo,
 * PayOS Link ID, hoa hồng, payout) + timeline trạng thái.
 * Dữ liệu: getPaymentDetail(paymentId) (@/api/misc). Params: paymentId.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - Animated.timing fade 250ms → CSS transition opacity + rAF.
 * - StatusBar + insets.top + 32 → <StatusBarSpacer /> + paddingTop 32.
 * - Icon thiếu glyph trong bộ 159 (lock-closed, return-down-back) → glyph gần nhất
 *   cùng nghĩa (ic() bên dưới) — không được sửa ionicons.ts.
 */
import React, { useState, useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { getPaymentDetail } from "@/api/misc";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      "lock-closed": "lock-closed-outline",
      "return-down-back": "refresh",
    } as Record<string, string>
  )[name] ?? name;

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "Chờ thanh toán", color: COLORS.warning, bg: COLORS.warningBg, icon: "time" },
  held: { label: "Đang giữ tiền (Escrow)", color: COLORS.info, bg: COLORS.infoBg, icon: "lock-closed" },
  completed: { label: "Đã hoàn tất", color: COLORS.success, bg: COLORS.successBg, icon: "checkmark-circle" },
  cancelled: { label: "Đã huỷ", color: COLORS.textMuted, bg: "#f3f4f6", icon: "close-circle" },
  refunded: { label: "Đã hoàn tiền", color: COLORS.info, bg: COLORS.infoBg, icon: "return-down-back" },
  payout_failed: { label: "Giải ngân thất bại", color: COLORS.error, bg: COLORS.errorBg, icon: "alert-circle" },
};

const METHOD_LABEL: Record<string, string> = {
  momo_escrow: "MoMo (Escrow)",
  cash: "Tiền mặt",
  payos: "PayOS (VietQR)",
};

function buildTimeline(payment: any) {
  const timeline: Array<{ label: string; time: string | null; status: string }> = [];
  const s = payment.status;

  timeline.push({ label: "Tạo giao dịch", time: payment.initiated_at, status: "done" });

  if (s === "pending" && !payment.held_at) {
    timeline.push({ label: "Chờ phụ huynh thanh toán", time: null, status: "pending" });
  }

  if (payment.held_at) {
    timeline.push({ label: "Tiền đã được giữ (Escrow)", time: payment.held_at, status: "done" });
  }

  if (s === "completed" && payment.completed_at) {
    timeline.push({ label: "Giao dịch hoàn tất", time: payment.completed_at, status: "done" });
  } else if (s === "cancelled") {
    timeline.push({ label: "Giao dịch đã huỷ", time: payment.refunded_at, status: "cancelled" });
  } else if (s === "refunded") {
    timeline.push({ label: "Đã hoàn tiền", time: payment.refunded_at, status: "refunded" });
  } else if (s === "payout_failed") {
    timeline.push({ label: "Giải ngân thất bại", time: payment.refunded_at, status: "rejected" });
  } else if (payment.held_at) {
    timeline.push({ label: "Chờ hoàn thành việc để giải ngân", time: null, status: "pending" });
  }

  return timeline;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface PaymentDetailScreenProps {
  paymentId?: string | number;
}

const PaymentDetailScreen: React.FC<PaymentDetailScreenProps> = ({ paymentId }) => {
  const nav = useNav();

  const [payment, setPayment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // QA-FIX-UI 3.2: fade-in animation khi mount — CSS transition
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    if (!paymentId) {
      setIsLoading(false);
      return;
    }
    const fetchPayment = async () => {
      try {
        const data = (await getPaymentDetail(paymentId)) as any;
        setPayment(data);
      } catch (e: any) {
        console.error("[PaymentDetail] Lỗi:", e?.message || e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayment();
  }, [paymentId]);

  if (isLoading) {
    return (
      <Screen bg={COLORS.surfaceWarm} scroll={false}>
        <div style={{ minHeight: "100dvh", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      </Screen>
    );
  }

  if (!payment) {
    return (
      <Screen bg={COLORS.surfaceWarm} scroll={false}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <span style={{ ...TYPO.body, color: COLORS.onSurfaceVariant }}>Không tìm thấy giao dịch này.</span>
          <Touchable onPress={nav.goBack} style={{ marginTop: 12 }}>
            <span style={{ ...TYPO.h4, color: COLORS.primary }}>Quay lại</span>
          </Touchable>
        </div>
      </Screen>
    );
  }

  const st = STATUS_STYLE[payment.status] || STATUS_STYLE.pending;
  const timeline = buildTimeline(payment);
  const methodLabel = METHOD_LABEL[payment.method] || payment.method;

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

        {/* App bar */}
        <div style={S.appBar}>
          <Touchable onPress={nav.goBack} style={S.appBarBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
          </Touchable>
          <span style={{ ...S.appBarTitle, color: COLORS.onSurface }}>Chi tiết thanh toán</span>
          <div style={{ width: 44 }} />
        </div>

        {/* Scroll content */}
        <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status Card */}
            <div style={{ ...S.statusCard, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
              <div style={{ ...S.statusBadge, background: st.bg }}>
                <Icon name={ic(st.icon)} size={20} color={st.color} />
                <span style={{ ...S.statusText, color: st.color }}>{st.label}</span>
              </div>
              <span style={{ ...S.amountBig, color: COLORS.primary }}>
                {parseInt(String(payment.amount), 10).toLocaleString("vi-VN")}đ
              </span>
              <span style={{ ...S.taskTitle, color: COLORS.onSurfaceVariant, textAlign: "center", maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {payment.task_title || "Công việc"}
              </span>
            </div>

            {/* Info Grid */}
            <div style={{ ...S.infoCard, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
              <div style={{ ...S.infoRow, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
                <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>Phương thức</span>
                <span style={{ ...S.infoValue, color: COLORS.onSurface }}>{methodLabel}</span>
              </div>
              {payment.momo_order_id ? (
                <div style={{ ...S.infoRow, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
                  <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>Mã giao dịch MoMo</span>
                  <span style={{ ...S.infoValue, color: COLORS.onSurface, fontSize: 12, maxWidth: "60%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {payment.momo_order_id}
                  </span>
                </div>
              ) : null}
              {payment.payos_payment_link_id ? (
                <div style={{ ...S.infoRow, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
                  <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>PayOS Link ID</span>
                  <span style={{ ...S.infoValue, color: COLORS.onSurface, fontSize: 12, maxWidth: "60%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {payment.payos_payment_link_id}
                  </span>
                </div>
              ) : null}
              {payment.commission_amount ? (
                <div style={{ ...S.infoRow, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
                  <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>
                    Hoa hồng ({payment.commission_rate || 10}%)
                  </span>
                  <span style={{ ...S.infoValue, color: COLORS.warning }}>
                    {parseInt(String(payment.commission_amount), 10).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              ) : null}
              {payment.worker_payout_amount ? (
                <div style={S.infoRow}>
                  <span style={{ ...S.infoLabel, color: COLORS.onSurfaceVariant }}>Carepartner nhận</span>
                  <span style={{ ...S.infoValue, color: COLORS.success }}>
                    {parseInt(String(payment.worker_payout_amount), 10).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              ) : null}
            </div>

            {/* Timeline */}
            <div style={{ ...S.timelineCard, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
              <span style={{ ...S.timelineTitle, color: COLORS.onSurface }}>Trạng thái giao dịch</span>
              {timeline.map((step, idx) => {
                const isLast = idx === timeline.length - 1;
                const isDone = step.status === "done";
                const isPending = step.status === "pending";
                const isRejected =
                  step.status === "rejected" || step.status === "cancelled" || step.status === "refunded";
                return (
                  <div key={idx} style={S.timelineItem}>
                    <div style={S.timelineLeft}>
                      <div
                        style={{
                          ...S.timelineDot,
                          background: isDone
                            ? COLORS.success
                            : isPending
                            ? COLORS.warningBg
                            : isRejected
                            ? COLORS.errorBg
                            : COLORS.surfaceContainerHigh,
                          border: isPending
                            ? `2px solid ${COLORS.warning}`
                            : isRejected
                            ? `2px solid ${COLORS.error}`
                            : undefined,
                        }}
                      >
                        <Icon
                          name={isDone ? "checkmark" : isRejected ? "close" : "time"}
                          size={12}
                          color={isDone ? "#fff" : isRejected ? COLORS.error : COLORS.onSurfaceVariant}
                        />
                      </div>
                      {!isLast && (
                        <div style={{ ...S.timelineLine, background: isDone ? COLORS.success : COLORS.outlineVariant }} />
                      )}
                    </div>
                    <div style={S.timelineContent}>
                      <span style={{ ...S.timelineLabel, color: COLORS.onSurface }}>{step.label}</span>
                      {step.time ? <span style={{ ...S.timelineTime, color: COLORS.onSurfaceVariant }}>{fmtTime(step.time)}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ height: 40 }} />
          </div>
        </div>
      </div>
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "32px 12px 12px",
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
  appBarTitle: { ...TYPO.h3 },
  statusCard: {
    borderRadius: 14,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    border: "1px solid",
    boxShadow: SHADOWS.medium,
    gap: 10,
  },
  statusBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 14px",
  },
  statusText: { ...TYPO.caption, fontWeight: 700 },
  amountBig: { ...TYPO.h1, fontWeight: 900 },
  taskTitle: { ...TYPO.body },
  infoCard: {
    borderRadius: 14,
    padding: 16,
    border: "1px solid",
    boxShadow: SHADOWS.small,
  },
  infoRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
  },
  infoLabel: { ...TYPO.body, flexShrink: 0 },
  infoValue: { ...TYPO.body, fontWeight: 700 },
  timelineCard: {
    borderRadius: 14,
    padding: 16,
    border: "1px solid",
    boxShadow: SHADOWS.small,
  },
  timelineTitle: { ...TYPO.h4, marginBottom: 14, fontWeight: 700, display: "block" },
  timelineItem: { display: "flex", flexDirection: "row", gap: 12, paddingBottom: 16 },
  timelineLeft: { display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  timelineLine: { width: 2, flex: 1, marginTop: 4, minHeight: 20 },
  timelineContent: { flex: 1, paddingTop: 2 },
  timelineLabel: { ...TYPO.body, fontWeight: 500, display: "block" },
  timelineTime: { ...TYPO.caption, fontWeight: 400, marginTop: 2, display: "block" },
};

export default PaymentDetailScreen;
