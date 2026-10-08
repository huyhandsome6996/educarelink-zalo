/**
 * AdminPaymentsScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminPaymentsScreen.js (621 dòng).
 * 3 tab (RN): "Tổng quan" (getPaymentOverview: MoMo config, stats, dòng tiền, kỳ thanh toán
 * + nút chạy monthly settlement), "Giao dịch" (getAllPayments + chips filter status +
 * retryPayout khi payout_failed), "Audit log" (getPaymentLogs 100 bản ghi mới nhất).
 * Modal chạy settlement với năm/tháng (để trống = tháng trước).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web.
 * - RN chỉ refetch payments khi bấm "Tất cả" (closure cũ — chip status khác chỉ setState,
 *   thực tế phải pull-to-refresh mới lấy dữ liệu mới); trên web thêm useEffect refetch khi
 *   filterStatus đổi (bỏ lần mount đầu) để chip filter hoạt động đúng ý đồ nghiệp vụ.
 * - Alert.alert 2 nút (retry payout) → window.confirm; Alert 1 nút → showAlert.
 * - Modal fade của RN → overlay fixed hiển thị tức thời (không animation).
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, useStatusBarHeight } from "@/components/ui";
import { COLORS, TYPO, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import {
  getPaymentOverview,
  getAllPayments,
  retryPayout,
  regenerateSettlementQR,
  runMonthlySettlement,
  getPaymentLogs,
} from "@/api/misc";

// ====================================================================
// Admin Payments Screen — đồng bộ với web (admin_dashboard.html phần payment)
// Dashboard tổng quan + list payments + retry payout + regenerate QR
// + run monthly settlement + audit logs
// ====================================================================

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ thanh toán",
  held: "Đang giữ tiền",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
  refunded: "Đã hoàn tiền",
  payout_failed: "Giải ngân thất bại",
};

const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.warning,
  held: COLORS.info,
  completed: COLORS.success,
  cancelled: COLORS.textMuted,
  refunded: COLORS.info,
  payout_failed: COLORS.error,
};

const METHOD_LABELS: Record<string, string> = {
  momo_escrow: "MoMo Escrow",
  cash: "Tiền mặt",
};

interface PaymentOverview {
  momo_configured?: boolean;
  momo_sandbox?: boolean;
  commission_rate?: string | number;
  total_payments?: number;
  by_method?: Record<string, number>;
  pending_payouts_failed?: number;
  total_revenue_commission?: string | number;
  total_payout_to_workers?: string | number;
  total_held_in_escrow?: string | number;
  settlements?: {
    total?: number;
    qr_generated?: number;
    paid?: number;
    overdue?: number;
    total_owed?: string | number;
  };
}

interface PaymentRow {
  id: number | string;
  method?: string;
  task?: number | string;
  task_title?: string;
  amount?: string | number;
  commission_amount?: string | number;
  worker_payout_amount?: string | number;
  parent_full_name?: string;
  parent_name?: string;
  worker_full_name?: string;
  worker_name?: string;
  status?: string;
  momo_result_code?: string | number | null;
}

interface LogRow {
  id: number | string;
  event_type?: string;
  created_at?: string;
  message?: string;
  payment?: number | string | null;
  settlement?: number | string | null;
  actor?: number | string | null;
}

const AdminPaymentsScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [activeTab, setActiveTab] = useState("overview"); // overview | payments | logs
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [showRunSettlementModal, setShowRunSettlementModal] = useState(false);
  const [settlementYear, setSettlementYear] = useState("");
  const [settlementMonth, setSettlementMonth] = useState("");

  const fetchOverview = async () => {
    try {
      const res = await getPaymentOverview();
      setOverview(res.data);
    } catch (e: any) {
      console.error("fetchOverview error:", e);
    }
  };

  const fetchPayments = async (statusOverride?: string) => {
    try {
      const params: Record<string, any> = {};
      const st = statusOverride !== undefined ? statusOverride : filterStatus;
      if (st) params.status = st;
      if (filterMethod) params.method = filterMethod;
      const res = await getAllPayments(params);
      setPayments(res.data || []);
    } catch (e: any) {
      console.error("fetchPayments error:", e);
      showAlert("Lỗi", "Không tải được danh sách thanh toán.");
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await getPaymentLogs();
      setLogs((res.data || []).slice(0, 100));
    } catch (e: any) {
      console.error("fetchLogs error:", e);
    }
  };

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchOverview(), fetchPayments(), fetchLogs()]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RN: chip "Tất cả" mới gọi fetchPayments (stale closure); web refetch khi filter đổi
  const firstFilterRun = useRef(true);
  useEffect(() => {
    if (firstFilterRun.current) {
      firstFilterRun.current = false;
      return;
    }
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const handleRetryPayout = (paymentId: number | string) => {
    const ok = window.confirm("Thử lại giải ngân\n\nBạn có chắc muốn thử lại giải ngân cho payment này?");
    if (!ok) return;
    (async () => {
      setActionLoading(`retry-${paymentId}`);
      try {
        await retryPayout(paymentId);
        showAlert("✅ Thành công", "Đã thử lại giải ngân.");
        fetchPayments();
        fetchOverview();
      } catch (e: any) {
        showAlert("Lỗi", e?.response?.data?.error || "Thử lại thất bại.");
      } finally {
        setActionLoading(null);
      }
    })();
  };

  const handleRunSettlement = async () => {
    setShowRunSettlementModal(false);
    setActionLoading("settlement");
    try {
      const payload: Record<string, any> = {};
      if (settlementYear) payload.year = parseInt(settlementYear);
      if (settlementMonth) payload.month = parseInt(settlementMonth);
      const res = await runMonthlySettlement(payload);
      const stats = res.data || {};
      showAlert(
        "✅ Hoàn tất",
        `Đã tạo ${stats.settlements_created || 0} kỳ thanh toán.\nTổng hoa hồng: ${(stats.total_commission || 0).toLocaleString("vi-VN")}đ`
      );
      fetchOverview();
    } catch (e: any) {
      showAlert("Lỗi", e?.response?.data?.error || "Run settlement thất bại.");
    } finally {
      setActionLoading(null);
      setSettlementYear("");
      setSettlementMonth("");
    }
  };

  const formatVND = (amount?: string | number | null) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount || 0;
    return num.toLocaleString("vi-VN") + "đ";
  };

  const renderOverview = () => {
    if (!overview)
      return (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      );

    return (
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ ...S.overviewWrap, paddingTop: 16 }}>
          {/* MoMo status */}
          <div style={{ ...S.card, borderLeft: `4px solid ${overview.momo_configured ? COLORS.success : COLORS.warning}` }}>
            <div style={S.cardHeader}>
              <Icon name="card-outline" size={20} color={COLORS.primary} />
              <div style={S.cardTitle}>MoMo Configuration</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Trạng thái:</div>
              <div style={{ ...S.value, color: overview.momo_configured ? COLORS.success : COLORS.warning, fontWeight: 700 }}>
                {overview.momo_configured ? "✅ Đã cấu hình" : "⚠️ Chưa cấu hình"}
              </div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Environment:</div>
              <div style={S.value}>{overview.momo_sandbox ? "Sandbox (test)" : "Production"}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Hoa hồng nền tảng:</div>
              <div style={S.value}>{overview.commission_rate ? parseFloat(String(overview.commission_rate)) * 100 : 20}%</div>
            </div>
          </div>

          {/* Tổng quan payments */}
          <div style={S.sectionTitle}>📊 Tổng quan thanh toán</div>
          <div style={S.statsGrid}>
            <div style={S.statCard}>
              <div style={S.statValue}>{overview.total_payments || 0}</div>
              <div style={S.statLabel}>Tổng giao dịch</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statValue}>{overview.by_method?.momo_escrow || 0}</div>
              <div style={S.statLabel}>MoMo Escrow</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statValue}>{overview.by_method?.cash || 0}</div>
              <div style={S.statLabel}>Tiền mặt</div>
            </div>
            <div style={{ ...S.statCard, background: COLORS.errorBg }}>
              <div style={{ ...S.statValue, color: COLORS.error }}>{overview.pending_payouts_failed || 0}</div>
              <div style={S.statLabel}>Giải ngân fail</div>
            </div>
          </div>

          {/* Tiền */}
          <div style={S.sectionTitle}>💰 Dòng tiền</div>
          <div style={S.card}>
            <div style={S.row}>
              <div style={S.label}>💰 Doanh thu hoa hồng:</div>
              <div style={{ ...S.value, color: COLORS.success, fontWeight: 800 }}>{formatVND(overview.total_revenue_commission)}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>💸 Đã trả carepartner:</div>
              <div style={S.value}>{formatVND(overview.total_payout_to_workers)}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>🔒 Đang giữ trong escrow:</div>
              <div style={{ ...S.value, color: COLORS.warning, fontWeight: 700 }}>{formatVND(overview.total_held_in_escrow)}</div>
            </div>
          </div>

          {/* Settlements */}
          <div style={S.sectionTitle}>📋 Kỳ thanh toán hoa hồng</div>
          <div style={S.card}>
            <div style={S.row}>
              <div style={S.label}>Tổng số kỳ:</div>
              <div style={S.value}>{overview.settlements?.total || 0}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Đã sinh QR:</div>
              <div style={S.value}>{overview.settlements?.qr_generated || 0}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Đã thanh toán:</div>
              <div style={{ ...S.value, color: COLORS.success, fontWeight: 700 }}>{overview.settlements?.paid || 0}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Quá hạn:</div>
              <div style={{ ...S.value, color: COLORS.error, fontWeight: 700 }}>{overview.settlements?.overdue || 0}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Tổng nợ đang chờ:</div>
              <div style={{ ...S.value, color: COLORS.warning, fontWeight: 800 }}>{formatVND(overview.settlements?.total_owed)}</div>
            </div>
          </div>

          {/* Action: Run monthly settlement */}
          <Touchable
            style={{ ...S.actionBtn, background: COLORS.primary }}
            onPress={() => setShowRunSettlementModal(true)}
            disabled={actionLoading === "settlement"}
            activeOpacity={0.85}
          >
            {actionLoading === "settlement" ? (
              <Spinner size={20} color="#fff" />
            ) : (
              <>
                <Icon name="calendar" size={18} color="#fff" />
                <div style={S.actionBtnText}>Chạy monthly settlement</div>
              </>
            )}
          </Touchable>

          <div style={{ height: 40 }} />
        </div>
      </div>
    );
  };

  const renderPayment = (item: PaymentRow) => {
    const statusColor = STATUS_COLORS[item.status || ""] || COLORS.textMuted;
    const canRetry = item.status === "payout_failed";
    const isMomo = item.method === "momo_escrow";
    return (
      <div key={String(item.id)} style={S.card}>
        <div style={S.cardTop}>
          <div style={{ ...S.methodBadge, background: isMomo ? "#D82D8B" : COLORS.success }}>
            <Icon name={isMomo ? "card-outline" : "cash-outline"} size={14} color="#fff" />
            <div style={S.methodText}>{METHOD_LABELS[item.method || ""]}</div>
          </div>
          <div style={S.paymentId}>#{item.id}</div>
        </div>

        <div style={S.taskTitle}>{item.task_title || `Task #${item.task}`}</div>

        <div style={S.paymentAmounts}>
          <div style={S.amountRow}>
            <div style={S.amountLabel}>Tổng:</div>
            <div style={S.amountValue}>{formatVND(item.amount)}</div>
          </div>
          <div style={S.amountRow}>
            <div style={S.amountLabel}>Hoa hồng:</div>
            <div style={{ ...S.amountValue, color: COLORS.success }}>{formatVND(item.commission_amount)}</div>
          </div>
          <div style={S.amountRow}>
            <div style={S.amountLabel}>Carepartner nhận:</div>
            <div style={{ ...S.amountValue, color: COLORS.primary, fontWeight: 800 }}>{formatVND(item.worker_payout_amount)}</div>
          </div>
        </div>

        <div style={S.partiesRow}>
          <div style={S.partyBox}>
            <div style={S.partyLabel}>Phụ huynh</div>
            <div style={S.partyName}>{item.parent_full_name || item.parent_name}</div>
          </div>
          <Icon name="arrow-forward" size={14} color={COLORS.textMuted} />
          <div style={S.partyBox}>
            <div style={S.partyLabel}>Carepartner</div>
            <div style={S.partyName}>{item.worker_full_name || item.worker_name || "(chưa có)"}</div>
          </div>
        </div>

        <div style={S.statusBar}>
          <div style={{ ...S.statusBadge, background: `${statusColor}20` }}>
            <div style={{ ...S.statusDot, background: statusColor }} />
            <div style={{ ...S.statusText, color: statusColor }}>{STATUS_LABELS[item.status || ""] || item.status}</div>
          </div>
          {item.momo_result_code != null && <div style={S.momoCode}>resultCode: {item.momo_result_code}</div>}
        </div>

        {canRetry && (
          <Touchable
            style={{ ...S.retryBtn, ...(actionLoading === `retry-${item.id}` ? { opacity: 0.6 } : {}) }}
            onPress={() => handleRetryPayout(item.id)}
            disabled={actionLoading === `retry-${item.id}`}
            activeOpacity={0.85}
          >
            {actionLoading === `retry-${item.id}` ? (
              <Spinner size={16} color="#fff" />
            ) : (
              <>
                <Icon name="refresh" size={14} color="#fff" />
                <div style={S.retryBtnText}>Thử lại giải ngân</div>
              </>
            )}
          </Touchable>
        )}
      </div>
    );
  };

  const renderLog = (item: LogRow) => {
    const eventColor = item.event_type?.includes("failed")
      ? COLORS.error
      : item.event_type?.includes("completed") || item.event_type?.includes("paid")
      ? COLORS.success
      : item.event_type?.includes("created") || item.event_type?.includes("generated")
      ? COLORS.primary
      : COLORS.textMuted;
    return (
      <div key={String(item.id)} style={S.logCard}>
        <div style={S.logTop}>
          <div style={{ ...S.logBadge, background: `${eventColor}20` }}>
            <div style={{ ...S.logEventText, color: eventColor }}>{item.event_type}</div>
          </div>
          <div style={S.logTime}>{item.created_at?.replace("T", " ").slice(0, 19) || ""}</div>
        </div>
        {item.message && <div style={S.logMessage}>{item.message}</div>}
        {(item.payment || item.settlement) && (
          <div style={S.logTarget}>
            {item.payment ? `Payment #${item.payment}` : `Settlement #${item.settlement}`}
            {item.actor ? ` • by User#${item.actor}` : " • by system"}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden" }}>
      <StatusBarSpacer />

      {/* Header */}
      <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
        <Touchable onPress={nav.goBack} style={S.backBtn}>
          <Icon name="arrow-back" size={22} color="#fff" />
        </Touchable>
        <div style={S.headerTitle}>Quản lý Thanh toán</div>
        <div style={{ marginRight: 8 }}>
          <Icon name="card-outline" size={22} color="#fff" />
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          { key: "overview", label: "Tổng quan", icon: "stats-chart" },
          { key: "payments", label: "Giao dịch", icon: "cash-outline" },
          { key: "logs", label: "Audit log", icon: "list" },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Touchable
              key={tab.key}
              style={{ ...S.tab, ...(isActive ? S.tabActive : {}) }}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Icon name={tab.icon} size={14} color={isActive ? COLORS.primary : COLORS.textMuted} />
              <div style={{ ...S.tabText, ...(isActive ? S.tabTextActive : {}) }}>{tab.label}</div>
            </Touchable>
          );
        })}
      </div>

      {/* Filter row — chỉ hiện ở tab payments */}
      {activeTab === "payments" && (
        <div style={S.filterRow}>
          <Touchable
            style={{ ...S.filterChip, ...(!filterStatus ? S.filterChipActive : {}) }}
            onPress={() => {
              setFilterStatus("");
              fetchPayments("");
            }}
          >
            <div style={{ ...S.filterText, ...(!filterStatus ? S.filterTextActive : {}) }}>Tất cả</div>
          </Touchable>
          {["pending", "held", "completed", "payout_failed", "refunded"].map((s) => (
            <Touchable
              key={s}
              style={{ ...S.filterChip, ...(filterStatus === s ? S.filterChipActive : {}) }}
              onPress={() => {
                setFilterStatus(s);
              }}
            >
              <div style={{ ...S.filterText, ...(filterStatus === s ? S.filterTextActive : {}) }}>{STATUS_LABELS[s]}</div>
            </Touchable>
          ))}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      ) : activeTab === "overview" ? (
        renderOverview()
      ) : (
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>
            {(() => {
              const rows: Array<PaymentRow | LogRow> = activeTab === "payments" ? payments : logs;
              if (rows.length === 0) {
                return (
                  <div style={S.emptyState}>
                    <Icon name="receipt-outline" size={40} color={COLORS.textMuted} />
                    <div style={S.emptyText}>Không có dữ liệu</div>
                  </div>
                );
              }
              return activeTab === "payments"
                ? payments.map((it) => renderPayment(it as PaymentRow))
                : logs.map((it) => renderLog(it as LogRow));
            })()}
          </div>
        </div>
      )}

      {/* Run settlement modal */}
      {showRunSettlementModal && (
        <div
          style={S.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRunSettlementModal(false);
          }}
        >
          <div style={S.modalContent}>
            <div style={S.modalTitle}>Chạy monthly settlement</div>
            <div style={S.modalHint}>Để trống cả 2 field = chạy cho tháng trước. Hoặc điền cụ thể năm/tháng.</div>
            <div style={S.modalInputRow}>
              <div style={{ flex: 1 }}>
                <div style={S.modalInputLabel}>Năm (vd: 2026)</div>
                <input
                  style={S.modalInput}
                  value={settlementYear}
                  onChange={(e) => setSettlementYear(e.target.value)}
                  inputMode="numeric"
                  placeholder="2026"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={S.modalInputLabel}>Tháng (1-12)</div>
                <input
                  style={S.modalInput}
                  value={settlementMonth}
                  onChange={(e) => setSettlementMonth(e.target.value)}
                  inputMode="numeric"
                  placeholder="6"
                />
              </div>
            </div>
            <div style={S.modalActions}>
              <Touchable style={S.modalCancelBtn} onPress={() => setShowRunSettlementModal(false)}>
                <div style={S.modalCancelText}>Huỷ</div>
              </Touchable>
              <Touchable style={S.modalConfirmBtn} onPress={handleRunSettlement}>
                <div style={S.modalConfirmText}>Chạy</div>
              </Touchable>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    alignItems: "center",
    padding: "0 16px 16px",
    background: COLORS.primary,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusSm,
    background: "rgba(255,255,255,0.15)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTitle: { ...typo("h4"), color: "#fff", fontWeight: 800, flex: 1 },
  tabs: {
    display: "flex",
    flexDirection: "row",
    background: COLORS.surface,
    padding: "0 16px 12px",
    gap: SIZES.xs,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  tab: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    display: "flex",
    alignItems: "center",
    borderRadius: SIZES.radiusSm,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    background: COLORS.background,
  },
  tabActive: { background: COLORS.primaryLight, boxShadow: SHADOWS.small },
  tabText: { ...typo("buttonSmall"), color: COLORS.textMuted, fontWeight: 600 },
  tabTextActive: { color: COLORS.primary, fontWeight: 800 },
  filterRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: "10px 16px",
    background: COLORS.surface,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  filterChip: {
    padding: "4px 10px",
    borderRadius: 12,
    background: COLORS.background,
    border: `1px solid ${COLORS.border}`,
  },
  filterChipActive: {
    background: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { ...typo("caption"), color: COLORS.textSecondary, fontWeight: 600 },
  filterTextActive: { color: "#fff", fontWeight: 800 },
  overviewWrap: { padding: 16, display: "flex", flexDirection: "column", gap: 14 },
  card: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    borderLeft: `4px solid ${COLORS.primary}`,
    boxShadow: SHADOWS.cardHover,
  },
  cardHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 6 },
  label: { ...typo("bodySmall"), color: COLORS.textSecondary },
  value: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 600, textAlign: "right" },
  sectionTitle: { ...typo("h4"), color: COLORS.textPrimary, marginTop: 6, marginBottom: 4 },
  statsGrid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    flex: 1,
    minWidth: "47%",
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: SHADOWS.small,
  },
  statValue: { ...typo("h2"), color: COLORS.primary, fontWeight: 800, lineHeight: "28px" },
  statLabel: { ...typo("caption"), color: COLORS.textSecondary, marginTop: 4 },
  actionBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: SIZES.radiusMd,
    paddingTop: 14,
    paddingBottom: 14,
    marginTop: 10,
    boxShadow: SHADOWS.small,
  },
  actionBtnText: { color: "#fff", ...typo("button"), fontSize: 15 },
  // Payment card
  cardTop: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  methodBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    padding: "3px 8px",
  },
  methodText: { color: "#fff", ...typo("overline"), fontWeight: 800, fontSize: 10 },
  paymentId: { ...typo("caption"), color: COLORS.textMuted },
  taskTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700, marginBottom: 8 },
  paymentAmounts: {
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 10,
  },
  amountRow: { display: "flex", flexDirection: "row", justifyContent: "space-between" },
  amountLabel: { ...typo("bodySmall"), color: COLORS.textSecondary },
  amountValue: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 600 },
  partiesRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    background: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: 10,
    marginBottom: 10,
  },
  partyBox: { flex: 1, minWidth: 0 },
  partyLabel: { ...typo("overline"), color: COLORS.textMuted },
  partyName: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 600 },
  statusBar: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    padding: "4px 10px",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typo("buttonSmall"), fontWeight: 700 },
  momoCode: { ...typo("caption"), color: COLORS.textMuted },
  retryBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: COLORS.warning,
    borderRadius: SIZES.radiusSm,
    paddingTop: 10,
    paddingBottom: 10,
    marginTop: 8,
    boxShadow: SHADOWS.small,
  },
  retryBtnText: { color: "#fff", ...typo("buttonSmall"), fontWeight: 700 },
  // Log card
  logCard: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusSm,
    padding: 12,
    borderLeft: `3px solid ${COLORS.primary}`,
    boxShadow: SHADOWS.small,
  },
  logTop: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  logBadge: { borderRadius: 8, padding: "2px 8px" },
  logEventText: { ...typo("overline"), fontWeight: 800, fontSize: 10 },
  logTime: { ...typo("caption"), color: COLORS.textMuted, fontSize: 10 },
  logMessage: { ...typo("bodySmall"), color: COLORS.textPrimary, marginTop: 4 },
  logTarget: { ...typo("caption"), color: COLORS.textSecondary, marginTop: 4, fontStyle: "italic" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, paddingBottom: 60, gap: 12 },
  emptyText: { ...typo("body"), color: COLORS.textMuted },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 300,
    display: "flex",
  },
  modalContent: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: 20,
    boxShadow: SHADOWS.large,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: { ...typo("h4"), color: COLORS.textPrimary, marginBottom: 8 },
  modalHint: { ...typo("bodySmall"), color: COLORS.textSecondary, marginBottom: 16 },
  modalInputRow: { display: "flex", flexDirection: "row", gap: 10, marginBottom: 16 },
  modalInputLabel: { ...typo("caption"), color: COLORS.textSecondary, marginBottom: 4 },
  modalInput: {
    width: "100%",
    border: `1px solid ${COLORS.border}`,
    borderRadius: SIZES.radiusSm,
    padding: "10px 12px",
    ...TYPO.body,
    lineHeight: "22px",
    color: COLORS.textPrimary,
    background: "#fff",
    outline: "none",
  },
  modalActions: { display: "flex", flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  modalCancelBtn: {
    padding: "10px 16px",
    borderRadius: SIZES.radiusSm,
    background: COLORS.background,
  },
  modalCancelText: { ...typo("button"), color: COLORS.textSecondary },
  modalConfirmBtn: {
    padding: "10px 20px",
    borderRadius: SIZES.radiusSm,
    background: COLORS.primary,
    boxShadow: SHADOWS.small,
  },
  modalConfirmText: { ...typo("button"), color: "#fff" },
};

export default AdminPaymentsScreen;
