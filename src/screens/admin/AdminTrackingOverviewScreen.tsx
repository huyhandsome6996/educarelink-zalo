/**
 * AdminTrackingOverviewScreen — port CHÍNH XÁC mobile/src/screens/Admin/AdminTrackingOverviewScreen.js (232 dòng).
 * Tổng quan tracking: stats grid (consent active, live locations, điểm lịch sử, SOS active),
 * card cấu hình Geofence, card Keep-Alive Scheduler (getKeepaliveStats — fail mềm),
 * note SOS. Fetch: getAdminTrackingOverview + getKeepaliveStats (Promise.all).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RefreshControl (pull-to-refresh) → không có trên web.
 * - Alert.alert 1 nút → showAlert (window.alert).
 * - RN import getSOSAlerts nhưng không gọi (backend không có endpoint list-all SOS) — giữ nguyên.
 * - Icon thiếu glyph: server→hardware-chip (bộ 159 glyph, gần nghĩa nhất).
 */
import React, { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, useStatusBarHeight } from "@/components/ui";
import { COLORS, SIZES, SHADOWS, typo } from "@/theme";
import { useNav } from "@/navigation/router";
import { getAdminTrackingOverview } from "@/api/tracking";
import { getKeepaliveStats } from "@/api/misc";

// ====================================================================
// Admin Tracking Overview — đồng bộ với web (admin_dashboard.html phần tracking)
// Xem tổng quan: consents active, live locations, SOS alerts, keepalive stats
// ====================================================================

interface TrackingOverview {
  active_consents?: number;
  active_live_locations?: number;
  total_history_points?: number;
  active_sos?: number;
  geofence_radius_meters?: number;
  total_consents?: number;
  total_sos?: number;
}

interface KeepaliveStats {
  enabled?: boolean;
  interval_minutes?: number;
  stats?: {
    last_ping?: string;
    last_status?: string;
    last_latency_ms?: number;
    total_pings?: number;
    successful?: number;
    failed?: number;
  };
}

const AdminTrackingOverviewScreen: React.FC = () => {
  const nav = useNav();
  const sbH = useStatusBarHeight();
  const [overview, setOverview] = useState<TrackingOverview | null>(null);
  const [keepalive, setKeepalive] = useState<KeepaliveStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [ovRes, kaRes] = await Promise.all([
        getAdminTrackingOverview(),
        getKeepaliveStats().catch(() => ({ data: null })),
      ]);
      setOverview(ovRes.data);
      setKeepalive(kaRes.data);

      // Fetch SOS alerts active — try với một số task phổ biến (không có endpoint list all SOS)
      // Backend không có endpoint list-all SOS nên ta dựa vào overview.active_sos
      // Hiển thị count trước, list chi tiết cần admin mở từng task
    } catch (e: any) {
      console.error("Admin tracking fetch error:", e);
      showAlert("Lỗi", "Không tải được dữ liệu tracking.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = (
    <div style={{ ...S.header, paddingTop: Math.max(6, 56 - sbH) }}>
      <Touchable onPress={nav.goBack} style={S.backBtn}>
        <Icon name="arrow-back" size={22} color="#fff" />
      </Touchable>
      <div style={S.headerTitle}>Tracking Overview</div>
      <div style={{ marginRight: 8 }}>
        <Icon name="locate" size={22} color="#fff" />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden" }}>
        <StatusBarSpacer />
        {header}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.background, overflow: "hidden" }}>
      <StatusBarSpacer />
      {header}

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, paddingBottom: 40 }}>
          {/* Stats grid */}
          <div style={S.sectionTitle}>📍 Tracking Stats</div>
          <div style={S.statsGrid}>
            <div style={{ ...S.statCard, borderLeft: `4px solid ${COLORS.success}` }}>
              <Icon name="checkmark-circle" size={22} color={COLORS.success} />
              <div style={S.statValue}>{overview?.active_consents || 0}</div>
              <div style={S.statLabel}>Consent active</div>
            </div>
            <div style={{ ...S.statCard, borderLeft: `4px solid ${COLORS.primary}` }}>
              <Icon name="navigate" size={22} color={COLORS.primary} />
              <div style={S.statValue}>{overview?.active_live_locations || 0}</div>
              <div style={S.statLabel}>Đang track</div>
            </div>
            <div style={{ ...S.statCard, borderLeft: `4px solid ${COLORS.info}` }}>
              <Icon name="hardware-chip" size={22} color={COLORS.info} />
              <div style={S.statValue}>{overview?.total_history_points || 0}</div>
              <div style={S.statLabel}>Điểm lịch sử</div>
            </div>
            <div
              style={{
                ...S.statCard,
                borderLeft: `4px solid ${(overview?.active_sos || 0) > 0 ? COLORS.error : COLORS.divider}`,
              }}
            >
              <Icon name="warning" size={22} color={(overview?.active_sos || 0) > 0 ? COLORS.error : COLORS.textMuted} />
              <div style={{ ...S.statValue, color: (overview?.active_sos || 0) > 0 ? COLORS.error : COLORS.textPrimary }}>
                {overview?.active_sos || 0}
              </div>
              <div style={S.statLabel}>SOS active</div>
            </div>
          </div>

          {/* Geofence info */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <Icon name="shield-checkmark" size={20} color={COLORS.primary} />
              <div style={S.cardTitle}>Cấu hình Geofence</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Bán kính mặc định:</div>
              <div style={S.value}>{overview?.geofence_radius_meters || 500} m</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Tổng consent đã tạo:</div>
              <div style={S.value}>{overview?.total_consents || 0}</div>
            </div>
            <div style={S.row}>
              <div style={S.label}>Tổng SOS đã gửi:</div>
              <div style={S.value}>{overview?.total_sos || 0}</div>
            </div>
          </div>

          {/* Keep-Alive scheduler */}
          {keepalive && (
            <>
              <div style={S.sectionTitle}>⏰ Keep-Alive Scheduler</div>
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <Icon name="pulse" size={20} color={keepalive.enabled ? COLORS.success : COLORS.textMuted} />
                  <div style={S.cardTitle}>Trạng thái</div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Bật:</div>
                  <div style={{ ...S.value, color: keepalive.enabled ? COLORS.success : COLORS.textMuted, fontWeight: 700 }}>
                    {keepalive.enabled ? "✅ Đang chạy" : "⛔ Tắt"}
                  </div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Interval:</div>
                  <div style={S.value}>Mỗi {keepalive.interval_minutes || 3} phút</div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Ping lần cuối:</div>
                  <div style={S.value}>{keepalive.stats?.last_ping?.replace("T", " ").slice(0, 19) || "—"}</div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Status lần cuối:</div>
                  <div
                    style={{
                      ...S.value,
                      color: keepalive.stats?.last_status === "ok" ? COLORS.success : COLORS.warning,
                      fontWeight: 700,
                    }}
                  >
                    {keepalive.stats?.last_status || "—"}
                  </div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Latency:</div>
                  <div style={S.value}>{keepalive.stats?.last_latency_ms || 0} ms</div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Tổng ping:</div>
                  <div style={S.value}>{keepalive.stats?.total_pings || 0}</div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Thành công:</div>
                  <div style={{ ...S.value, color: COLORS.success, fontWeight: 700 }}>{keepalive.stats?.successful || 0}</div>
                </div>
                <div style={S.row}>
                  <div style={S.label}>Thất bại:</div>
                  <div
                    style={{
                      ...S.value,
                      color: (keepalive.stats?.failed || 0) > 0 ? COLORS.error : COLORS.textMuted,
                      fontWeight: 700,
                    }}
                  >
                    {keepalive.stats?.failed || 0}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Note về SOS */}
          <div style={S.noteCard}>
            <Icon name="information-circle" size={18} color={COLORS.info} />
            <div style={S.noteText}>
              Có {overview?.active_sos || 0} SOS alert đang active. Để xem chi tiết, mở task tracking từ Dashboard → Carepartner →
              Task.
            </div>
          </div>
        </div>
      </div>
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
  sectionTitle: { ...typo("h4"), color: COLORS.textPrimary, marginTop: 4 },
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
    gap: 4,
    boxShadow: SHADOWS.small,
  },
  statValue: { ...typo("h2"), color: COLORS.textPrimary, fontWeight: 800, lineHeight: "28px" },
  statLabel: { ...typo("caption"), color: COLORS.textSecondary },
  card: {
    background: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: 16,
    borderLeft: `4px solid ${COLORS.primary}`,
    boxShadow: SHADOWS.cardHover,
  },
  cardHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { ...typo("h5"), color: COLORS.textPrimary, fontWeight: 700 },
  row: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 5, paddingBottom: 5 },
  label: { ...typo("bodySmall"), color: COLORS.textSecondary },
  value: { ...typo("body"), color: COLORS.textPrimary, fontWeight: 600, textAlign: "right" },
  noteCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    background: "#EFF6FF",
    borderRadius: SIZES.radiusMd,
    padding: 14,
    border: "1px solid #BFDBFE",
  },
  noteText: { flex: 1, ...typo("bodySmall"), color: "#1E40AF" },
};

export default AdminTrackingOverviewScreen;
