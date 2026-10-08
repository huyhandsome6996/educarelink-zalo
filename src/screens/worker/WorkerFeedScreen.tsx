/**
 * WorkerFeedScreen — port CHÍNH XÁC mobile/src/screens/Worker/WorkerFeedScreen.js (847 dòng).
 * Trang chủ CarePartner: header cam Stitch + floating stats bar + danh sách đơn
 * awaiting_commitment với countdown THẬT mỗi giây (từ seconds_left, mặc định 900s).
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - Poll 15s getBookings awaiting_commitment (theo Task 5-d, như RN JobAssignedModal) + clearInterval unmount.
 *  - RefreshControl (kéo-tải) không tồn tại trên web — dữ liệu tự refresh bằng poll 15s.
 *  - Icon "bulb-outline" thiếu trong bộ glyph zalo → alias information-circle-outline.
 *  - Animated.loop bounce empty-state → CSS keyframes edc-bounce (cùng biên độ 10px/650ms).
 *  - Nút empty state: RN navigate('WorkerJobs'/'WorkerAvailability') → switchTab('MyJobs'/'MatchingAvailability')
 *    theo chuẩn tab bar Zalo (đúng nhánh tab tương ứng).
 */
import React, { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { LetterAvatar, NotificationBell, Screen, Spinner, StatusBarSpacer, Touchable } from "@/components/ui";
import { SHADOWS } from "@/theme";
import { useAuth } from "@/context/AuthContext";
import { getBookings } from "@/api/matching";
import { useNav } from "@/navigation/router";

const POLL_INTERVAL_MS = 15000; // 15s — phòng miss push (như RN JobAssignedModal/feed)

/* Icon alias — glyph thiếu trong ionicons.ts zalo (chỉ thêm tại đây, không sửa file chung) */
const ICON_ALIAS: Record<string, string> = {
  "bulb-outline": "information-circle-outline",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

const formatSlot = (slot: any) => {
  if (!slot) return "";
  const dayStr = slot.day_of_week_vi ? `${slot.day_of_week_vi}, ` : "";
  const dateStr = slot.date_vi || slot.date || "";
  const fromStr = (slot.time_from_vi || slot.time_from || "").slice(0, 5);
  const toStr = (slot.time_to_vi || slot.time_to || "").slice(0, 5);
  return `${dayStr}${dateStr} · ${fromStr} – ${toStr}`;
};

const formatSeconds = (sec: number | null | undefined) => {
  if (sec == null || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** numberOfLines RN → CSS line-clamp */
const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: n,
  overflow: "hidden",
});

const WorkerFeedScreen: React.FC = () => {
  const nav = useNav();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  // Interval chạy mỗi giây để cập nhật đếm ngược các thẻ đơn (như RN)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      // Chỉ lấy đơn trạng thái awaiting_commitment — phụ huynh trực tiếp chọn carepartner này
      const data: any = await getBookings({ role: "carepartner", status: "awaiting_commitment" });
      const rawList = data?.results ?? data ?? [];
      // Lưu lại thời điểm fetch để tính seconds_left chính xác
      const fetchedAt = Date.now();
      const enriched = rawList.map((item: any) => ({
        ...item,
        _fetchedAt: fetchedAt,
        _initialSecondsLeft: item.seconds_left != null ? item.seconds_left : 900,
      }));
      setBookings(enriched);
    } catch {
      setError("Không tải được đơn mới. Kéo xuống để thử lại.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Mount + poll 15s (thay useFocusEffect của RN — web remount khi đổi tab)
  useEffect(() => {
    load();
    const poll = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [load]);

  const displayName = user?.first_name || user?.username || "Bạn";

  /* ─────────── Job card (styles.card → renderItem) ─────────── */
  const renderItem = (item: any) => {
    const elapsed = Math.floor((now - (item._fetchedAt || now)) / 1000);
    const currentSecondsLeft = Math.max(0, (item._initialSecondsLeft || 900) - elapsed);

    const price = item.carepartner_payout_vnd ?? Math.round((item.total_value_vnd || item.job_price || 0) * 0.8);
    const title = item.job_title || "Công việc được giao";
    const parentName = item.parent_name || "Phụ huynh";
    const address = item.job_address || "Địa chỉ hiển thị chi tiết khi nhận";
    const slot = item.first_slot;
    const categoryName = item.category_name_vi || "Gia sư / Chăm sóc";

    return (
      <Touchable
        activeOpacity={0.92}
        onPress={() => nav.navigate("BookingDetail", { bookingId: item.id })}
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          padding: 16,
          marginBottom: 14,
          border: "1px solid #F1F5F9",
          borderLeft: "4.5px solid #F26522",
          boxShadow: SHADOWS.cardHover,
        }}
      >
        {/* Hàng 1: Badge đếm ngược khẩn cấp + Thù lao nhận được */}
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              background: "#FEF3C7",
              border: "1px solid #FDE68A",
              padding: "3.5px 8px",
              borderRadius: 8,
            }}
          >
            <Icon name="hourglass-outline" size={13} color="#92400E" />
            <span style={{ color: "#92400E", fontSize: 11, fontWeight: 700 }}>
              {currentSecondsLeft > 0 ? `Còn ${formatSeconds(currentSecondsLeft)} để xác nhận` : "Hết hạn suy nghĩ"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: "#0E9F6E" }}>{Number(price).toLocaleString("vi-VN")}đ</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>/ ca làm</span>
          </div>
        </div>

        {/* Hàng 2: Tiêu đề công việc & Tag danh mục */}
        <div
          style={{
            alignSelf: "flex-start",
            background: "#FFF7ED",
            border: "1px solid #FFEDD5",
            padding: "2.5px 8px",
            borderRadius: 6,
            marginBottom: 6,
          }}
        >
          <span style={{ color: "#EA580C", fontSize: 11, fontWeight: 700 }}>{categoryName}</span>
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: "#0F172A", lineHeight: "22px", marginBottom: 10, ...clamp(2) }}>{title}</div>

        {/* Hàng 3: Hồ sơ Phụ huynh (Đã xác thực & Đánh giá) */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            background: "#F8FAFC",
            borderRadius: 12,
            padding: 9,
            marginBottom: 10,
          }}
        >
          <LetterAvatar name={parentName || "P"} size={34} bg="#FFEDD5" color="#EA580C" fontSize={14} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{parentName}</span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 2.5,
                  background: "#ECFDF5",
                  padding: "1.5px 5px",
                  borderRadius: 4,
                }}
              >
                <Icon name="shield-checkmark" size={11} color="#0E9F6E" />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#0E9F6E" }}>Đã xác thực CCCD</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 1.5 }}>⭐ 5.0 · Đã ký quỹ MoMo Escrow 100%</div>
          </div>
        </div>

        {/* Hàng 4: Lịch làm & Địa điểm bento */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {slot ? (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: "#FFF7ED",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="calendar" size={13} color="#F26522" />
              </div>
              <span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500, flex: 1 }}>{formatSlot(slot)}</span>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: "#FFF7ED",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="location" size={13} color="#F26522" />
            </div>
            <span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500, flex: 1, ...clamp(1) }}>{address}</span>
          </div>
        </div>

        {/* Hàng 5: Card Action Footer */}
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
            <Icon name="sparkles" size={13} color="#EA580C" />
            <span style={{ fontSize: 11, color: "#EA580C", fontWeight: 600 }}>Phụ huynh chọn bạn từ gợi ý AI</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              background: "#FFF7ED",
              border: "1px solid #FED7AA",
              padding: "5.5px 11px",
              borderRadius: 9,
            }}
          >
            <span style={{ color: "#EA580C", fontSize: 11.5, fontWeight: 700 }}>Xem chi tiết</span>
            <Icon name="arrow-forward" size={14} color="#EA580C" />
          </div>
        </div>
      </Touchable>
    );
  };

  return (
    <Screen bg="#F8FAFC" scroll={false}>
      {/* Header Cam Phong Cách Stitch */}
      <div
        style={{
          background: "#EA580C",
          padding: "0 20px 38px", // paddingBottom 38 + paddingHorizontal 20
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <StatusBarSpacer />
        {/* Hình tròn trang trí mờ ở background */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: 70,
            background: "rgba(255, 255, 255, 0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -20,
            left: -20,
            width: 90,
            height: 90,
            borderRadius: 45,
            background: "rgba(255, 255, 255, 0.06)",
          }}
        />

        <div style={{ position: "relative" }}>
          {/* Dòng trên cùng: Logo thương hiệu + Badge xác thực + Trạng thái + Chuông thông báo */}
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingTop: 10 }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
              <img
                src="/static/images/logo.png"
                alt="EduCareLink"
                style={{ width: 34, height: 34, borderRadius: 10, background: "#ffffff", objectFit: "contain", display: "block" }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "3px 8px",
                  borderRadius: 8,
                }}
              >
                <Icon name="shield-checkmark" size={12} color="#fff" />
                <span style={{ color: "#FFFFFF", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.8px" }}>CAREPARTNER ĐÃ ĐỐI SOÁT</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  background: "rgba(255, 255, 255, 0.18)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  padding: "4px 9px",
                  borderRadius: 12,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: 3.5, background: "#34D399" }} />
                <span style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700 }}>Sẵn sàng nhận việc</span>
              </div>
              <NotificationBell />
            </div>
          </div>

          {/* Lời chào & Thông điệp giá trị */}
          <div style={{ color: "#FFFFFF", fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px" }}>Chào, {displayName}! 👋</div>
          <div style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: 12.5, lineHeight: "18px", marginTop: 4, fontWeight: 500 }}>
            Phụ huynh chọn bạn trực tiếp — Vui lòng xem và xác nhận trước khi hết hạn.
          </div>
        </div>
      </div>

      {/* Quick Stats Floating Mini-Bar (Nổi chèn đáy header) */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "-22px 16px 0", // marginTop -22 (nổi chèn đáy header) + marginHorizontal 16
          background: "#FFFFFF",
          borderRadius: 18,
          padding: "12px 14px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          border: "1px solid #E2E8F0",
          boxShadow: SHADOWS.cardHover,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="time-outline" size={15} color="#F26522" />
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{bookings.length} ca</span>
          </div>
          <span style={{ fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: 500 }}>Chờ bạn duyệt</span>
        </div>
        <div style={{ width: 1, height: 26, background: "#E2E8F0" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="star" size={15} color="#F59E0B" />
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>98/100</span>
          </div>
          <span style={{ fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: 500 }}>Điểm uy tín ELO</span>
        </div>
        <div style={{ width: 1, height: 26, background: "#E2E8F0" }} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="checkmark-circle" size={15} color="#0E9F6E" />
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>100%</span>
          </div>
          <span style={{ fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: 500 }}>Tỷ lệ đúng giờ</span>
        </div>
      </div>

      {/* Nội dung danh sách đơn (FlatList) */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
        <div style={{ padding: "16px 16px 40px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Spinner size={34} color="#F26522" />
              <span style={{ color: "#64748B", fontSize: 13 }}>Đang quét các đơn mới dành riêng cho bạn...</span>
            </div>
          ) : error ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px 0", gap: 12 }}>
              <Icon name="cloud-offline-outline" size={46} color="#94A3B8" />
              <span style={{ color: "#64748B", fontSize: 13.5, textAlign: "center" }}>{error}</span>
              <Touchable
                onPress={() => load()}
                style={{ background: "#EA580C", padding: "9px 22px", borderRadius: 18 }}
              >
                <span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 13 }}>Thử lại ngay</span>
              </Touchable>
            </div>
          ) : (
            <>
              {bookings.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: "#334155", letterSpacing: "0.6px" }}>
                      ĐƠN MỚI CẦN BẠN XÁC NHẬN
                    </span>
                    <div
                      style={{
                        background: "#FFF7ED",
                        border: "1px solid #FFEDD5",
                        padding: "1.5px 7px",
                        borderRadius: 10,
                      }}
                    >
                      <span style={{ color: "#EA580C", fontSize: 11, fontWeight: 800 }}>{bookings.length}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Bấm vào đơn để xem chi tiết ca làm và xác nhận cam kết
                  </div>
                </div>
              )}

              {bookings.length === 0 ? (
                /* ListEmptyComponent — Empty State với icon vali bounce */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 10px 0" }}>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      background: "#FFF7ED",
                      border: "2px solid #FFEDD5",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 16,
                      boxShadow: SHADOWS.small,
                      animation: "edc-bounce 1.3s ease-in-out infinite",
                    }}
                  >
                    <Icon name="briefcase" size={38} color="#EA580C" />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", textAlign: "center", marginBottom: 8 }}>
                    Hiện chưa có ca mới chờ xác nhận
                  </div>
                  <div style={{ fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: "19px", padding: "0 14px", marginBottom: 20 }}>
                    Lịch rảnh của bạn đang được thuật toán AI tự động kết nối với các phụ huynh gần nhất. Bạn sẽ nhận được thông báo ngay
                    khi có phụ huynh chọn bạn!
                  </div>

                  {/* 2 nút hành động như trong thiết kế Stitch */}
                  <Touchable
                    onPress={() => nav.switchTab("MyJobs")}
                    activeOpacity={0.88}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "#EA580C",
                      width: "100%",
                      padding: "13px 0",
                      borderRadius: 14,
                      marginBottom: 10,
                      boxShadow: SHADOWS.small,
                    }}
                  >
                    <Icon name="calendar-outline" size={17} color="#FFFFFF" />
                    <span style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: 700 }}>Xem các ca đã cam kết ở tab Công việc →</span>
                  </Touchable>

                  <Touchable
                    onPress={() => nav.switchTab("MatchingAvailability")}
                    activeOpacity={0.85}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      background: "#FFF7ED",
                      border: "1px solid #FED7AA",
                      width: "100%",
                      padding: "12px 0",
                      borderRadius: 14,
                      marginBottom: 20,
                    }}
                  >
                    <Icon name="time-outline" size={16} color="#EA580C" />
                    <span style={{ color: "#EA580C", fontSize: 13, fontWeight: 700 }}>Cập nhật lại lịch rảnh trong tuần</span>
                  </Touchable>

                  {/* Mẹo tăng cơ hội */}
                  <div
                    style={{
                      background: "#FEF3C7",
                      border: "1px solid #FDE68A",
                      borderRadius: 14,
                      padding: 13,
                      width: "100%",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Icon name={ic("bulb-outline")} size={16} color="#D97706" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Mẹo tăng cơ hội nhận việc</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#78350F", lineHeight: "17px" }}>
                      Cập nhật lịch rảnh đều đặn và phản hồi trong 15 phút đầu để duy trì điểm ELO cao và xuất hiện top 1 trong gợi ý của
                      phụ huynh.
                    </div>
                  </div>
                </div>
              ) : (
                bookings.map((item) => <React.Fragment key={String(item.id)}>{renderItem(item)}</React.Fragment>)
              )}
            </>
          )}
        </div>
      </div>
    </Screen>
  );
};

export default WorkerFeedScreen;
