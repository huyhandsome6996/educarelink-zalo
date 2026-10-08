/**
 * MyBookingsScreen — port CHÍNH XÁC mobile/src/screens/Worker/MyBookingsScreen.js (187 dòng).
 * Step 5.5 GET /api/matching/bookings — danh sách đơn ghép cặp của CarePartner,
 * lọc theo trạng thái (6 chip), đơn bị phạt ELO → nút kháng cáo (Step 7.6).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - RN màn này KHÔNG có header trong screen (headerShown:false, back bằng
 *    gesture/hardware). Web không có gesture-back → thêm AppBar tiêu đề RN
 *    canonical "Đơn của tôi (ghép cặp)" (WorkerProfileScreen menu label) với
 *    nút back nav.goBack.
 *  - useFocusEffect (reload mỗi focus) → useEffect theo mount + filter
 *    (mount == focus vì router chỉ render top-of-stack).
 *  - RefreshControl (kéo làm mới) không tồn tại trên web — nút "Thử lại" trong
 *    error box vẫn reload (text error giữ NGUYÊN văn bản RN).
 *  - Icon thiếu glyph → alias cục bộ: cash→cash-outline.
 */
import React, { useState, useEffect, useCallback } from "react";
import Icon from "@/components/Icon";
import { Spinner, StatusBarSpacer, Touchable, AppBar } from "@/components/ui";
import { COLORS, SHADOWS, TYPO } from "@/theme";
import { useNav } from "@/navigation/router";
import { getBookings } from "@/api/matching";

const FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "awaiting_commitment", label: "Chờ cam kết" },
  { key: "committed", label: "Đã cam kết" },
  { key: "in_progress", label: "Đang làm" },
  { key: "completed", label: "Hoàn thành" },
  { key: "cancelled_by_carepartner", label: "Đã hủy" },
];

// Đơn có thể bị phạt ELO → được phép kháng cáo trong 7 ngày (Step 7.6).
// Backend vẫn kiểm tra lại EloLedger âm + hạn 7 ngày + giới hạn 3 lần/30 ngày.
const APPEALABLE = [
  "cancelled_by_carepartner",
  "no_show",
  "no_show_unconfirmed",
  "suspected_no_show",
];

/* ── Alias icon: glyph RN không có trong ionicons.ts zalo → glyph gần nhất ── */
const ICON_ALIAS: Record<string, string> = {
  cash: "cash-outline",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/** numberOfLines RN → CSS line-clamp */
const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: n,
  overflow: "hidden",
});

/* ── Styles (StyleSheet.create RN → CSS 1:1) ── */
const S: Record<string, React.CSSProperties> = {
  container: { flex: 1, minHeight: "100dvh", background: COLORS.background },
  errorBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 60,
    padding: "60px 16px 0",
  },
  errorText: {
    marginTop: 10,
    color: COLORS.textMuted,
    textAlign: "center",
    fontSize: 15,
    lineHeight: "22px",
    fontFamily: TYPO.body.fontFamily,
  },
  retryBtn: {
    marginTop: 14,
    padding: "8px 20px",
    borderRadius: 16,
    background: COLORS.primary,
  },
  retryText: { color: "#FFFFFF", fontWeight: 600, fontSize: 15 },
  appealBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    padding: "6px 12px",
    borderRadius: 14,
    background: "#FEF3C7",
  },
  appealText: { fontSize: 12, fontWeight: 700, color: "#B45309" },
  filterRow: { paddingTop: 12, paddingBottom: 4 },
  filterChip: {
    borderRadius: 18,
    padding: "7px 14px",
    background: "#FFFFFF",
    border: "1px solid #eee",
    whiteSpace: "nowrap",
  },
  filterActive: { background: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textMuted },
  filterTextActive: { color: "#FFFFFF", fontWeight: 600 },
  card: {
    background: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
    boxShadow: SHADOWS.small,
  },
  cardTop: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginRight: 8,
    ...clamp(1),
  },
  status: { fontSize: 12, fontWeight: 700, color: COLORS.primary },
  metaRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  meta: { fontSize: 12, color: COLORS.textMuted },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: { marginTop: 12, color: COLORS.textMuted, fontSize: 15 },
};

const MyBookingsScreen: React.FC = () => {
  const nav = useNav();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data: any = await getBookings({ role: "carepartner", status: filter || undefined });
      setItems(data?.results ?? data ?? []);
    } catch (err) {
      // Lỗi mạng/server → thông báo tiếng Việt + cho phép kéo làm mới thử lại
      setError("Không tải được danh sách đơn. Vui lòng kéo xuống để thử lại.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // RN useFocusEffect: load mỗi lần focus (+ khi filter đổi). Web: mount == focus.
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={S.container}>
      <StatusBarSpacer />
      <AppBar title="Đơn của tôi (ghép cặp)" onBack={nav.goBack} />

      <div style={S.filterRow}>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {FILTERS.map((f) => (
            <Touchable
              key={f.key}
              style={{ ...S.filterChip, ...(filter === f.key ? S.filterActive : {}) }}
              onPress={() => setFilter(f.key)}
            >
              <div style={{ ...S.filterText, ...(filter === f.key ? S.filterTextActive : {}) }}>
                {f.label}
              </div>
            </Touchable>
          ))}
        </div>
      </div>

      {error ? (
        <div style={S.errorBox}>
          <Icon name="cloud-offline-outline" size={36} color="#d1d5db" />
          <div style={S.errorText}>{error}</div>
          <Touchable style={S.retryBtn} onPress={load}>
            <div style={S.retryText}>Thử lại</div>
          </Touchable>
        </div>
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
          <Spinner size={28} color={COLORS.primary} />
        </div>
      ) : items.length === 0 ? (
        <div style={S.empty}>
          <Icon name="briefcase-outline" size={44} color="#ddd" />
          <div style={S.emptyText}>Chưa có đơn nào ở mục này.</div>
        </div>
      ) : (
        <div style={{ padding: 16, paddingBottom: 40 }}>
          {items.map((item: any) => (
            <Touchable
              key={item.id}
              style={S.card}
              onPress={() => nav.navigate("BookingDetail", { bookingId: item.id })}
            >
              <div style={S.cardTop}>
                <div style={S.cardTitle}>{item.job_title || "Công việc ghép cặp"}</div>
                <div style={S.status}>{item.status_label_vi}</div>
              </div>
              {item.first_slot && (
                <div style={S.metaRow}>
                  <Icon name="calendar" size={13} color={COLORS.primary} />
                  <div style={S.meta}>
                    {item.first_slot.date} · {item.first_slot.time_from.slice(0, 5)}-
                    {item.first_slot.time_to.slice(0, 5)}
                  </div>
                </div>
              )}
              {/* Đồng bộ web QA 2026-09-11: hiển thị phụ huynh + địa chỉ (field mới của API) */}
              {item.parent_name ? (
                <div style={S.metaRow}>
                  <Icon name="person" size={13} color={COLORS.primary} />
                  <div style={{ ...S.meta, ...clamp(1) }}>Phụ huynh {item.parent_name}</div>
                </div>
              ) : null}
              {item.job_address ? (
                <div style={S.metaRow}>
                  <Icon name="location" size={13} color={COLORS.primary} />
                  <div style={{ ...S.meta, ...clamp(1) }}>{item.job_address}</div>
                </div>
              ) : null}
              <div style={S.metaRow}>
                <Icon name={ic("cash")} size={13} color="#0E9F6E" />
                <div style={S.meta}>{item.total_value_vnd?.toLocaleString("vi-VN")}đ</div>
                {item.compensation_vnd > 0 && (
                  <div style={{ ...S.meta, color: "#F5A623" }}>
                    · Đền bù {item.compensation_vnd.toLocaleString("vi-VN")}đ
                  </div>
                )}
              </div>
              {APPEALABLE.includes(item.status) && (
                <Touchable
                  style={S.appealBtn}
                  activeOpacity={0.8}
                  onPress={() => nav.navigate("Appeal", { bookingId: item.id })}
                >
                  <Icon name="megaphone-outline" size={14} color="#B45309" />
                  <div style={S.appealText}>Kháng cáo</div>
                </Touchable>
              )}
            </Touchable>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookingsScreen;
