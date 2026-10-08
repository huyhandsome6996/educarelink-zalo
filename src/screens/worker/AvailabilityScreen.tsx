/**
 * AvailabilityScreen (tab "Lịch rảnh" — route MatchingAvailability) — port CHÍNH XÁC
 * mobile/src/screens/Worker/AvailabilityScreen.js (1687 dòng).
 * "CAREPARTNER RADAR ACTIVE" + bento dashboard (radar AI / thu nhập tuần / progress / AI tip),
 * weekday selector 7 ngày (T2→CN, số ca), 4 preset 1-tap, danh sách khung giờ đã mở
 * (locked/unlocked), stepper +/- 30p tự tính thu nhập, policy card, modal quy tắc mở lịch.
 * Khác biệt platform (ghi mobile-parity-map.md):
 *  - API zalo trả body trực tiếp (không bọc .data như axios RN): getAvailability() → res?.windows.
 *  - RefreshControl (kéo-tải) không tồn tại trên web — RN cũng không poll màn này; dữ liệu
 *    tải lại khi mount (web remount khi đổi tab ≈ useFocusEffect của RN).
 *  - RN dùng Dimensions (SCREEN_WIDTH) cho presetCard → web width: calc(50% - 4px) (grid gap 8).
 *  - Icon 'remove' (dấu trừ) thiếu trong bộ glyph zalo → dựng MinusIcon bằng CSS (thanh 14×2).
 *  - Icon thiếu khác → alias cục bộ: radio→radio-outline, flame→flash.
 *  - pulseDot radar: RN để chấm tĩnh; prompt yêu cầu "radar quét animation" → thêm CSS
 *    animation edc-pulse (keyframes có sẵn app.css) — làm nổi badge RADAR ACTIVE.
 *  - Linking.openURL('tel:…') → window.location.href = 'tel:…' + fallback alert như RN.
 *  - Alert.alert 2 nút (Xóa khung giờ) → window.confirm gộp nội dung; các alert 1 nút → showAlert().
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { Screen, Spinner, StatusBarSpacer, Touchable, showAlert } from "@/components/ui";
import { COLORS, SHADOWS } from "@/theme";
import { getAvailability, addAvailability, deleteAvailability } from "@/api/matching";
import { useNav } from "@/navigation/router";

const WEEKDAYS = [
  { value: 0, label: "Thứ 2", short: "T2" },
  { value: 1, label: "Thứ 3", short: "T3" },
  { value: 2, label: "Thứ 4", short: "T4" },
  { value: 3, label: "Thứ 5", short: "T5" },
  { value: 4, label: "Thứ 6", short: "T6" },
  { value: 5, label: "Thứ 7", short: "T7" },
  { value: 6, label: "Chủ nhật", short: "CN" },
];

const PRESETS = [
  { id: "golden", name: "Giờ vàng", badge: "local_fire_department", duration: "3.0h", start: "18:00", end: "21:00", desc: "80% Phụ huynh đặt kèm học", isPeak: true },
  { id: "pickup", name: "Đón trẻ", badge: null, duration: "3.5h", start: "14:00", end: "17:30", desc: "Đón tan trường & vận động", isPeak: false },
  { id: "morning", name: "Buổi sáng", badge: null, duration: "3.5h", start: "08:00", end: "11:30", desc: "Ôn tập cuối tuần & đọc sách", isPeak: false },
  { id: "late", name: "Tối muộn", badge: null, duration: "2.5h", start: "19:30", end: "22:00", desc: "Kèm chuyên đề thi vào 10", isPeak: false },
];

/* Icon alias — glyph thiếu trong ionicons.ts zalo (chỉ thêm tại đây, không sửa file chung) */
const ICON_ALIAS: Record<string, string> = {
  radio: "radio-outline",
  flame: "flash",
};
const ic = (name: string) => ICON_ALIAS[name] ?? name;

/** Ionicons 'remove' (dấu trừ) — glyph thiếu, dựng bằng CSS thanh ngang */
const MinusIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = "#131B2E" }) => (
  <span
    style={{
      display: "inline-block",
      width: size * 0.72,
      height: Math.max(2, size * 0.11),
      borderRadius: size * 0.06,
      background: color,
    }}
  />
);

/** numberOfLines RN → CSS line-clamp */
const clamp = (n: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: n,
  overflow: "hidden",
});

// Hàm tính thời lượng hiển thị
function calculateDuration(timeFrom: string, timeTo: string): string {
  if (!timeFrom || !timeTo) return "0.0";
  const [sh, sm] = timeFrom.slice(0, 5).split(":").map(Number);
  const [eh, em] = timeTo.slice(0, 5).split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return (diff / 60).toFixed(1);
}

// Hàm tính ước tính thu nhập từng ca
function calculateEstimatedIncome(timeFrom: string, timeTo: string): string {
  const h = parseFloat(calculateDuration(timeFrom, timeTo));
  const minEarn = Math.round(h * 80);
  const maxEarn = Math.round(h * 120);
  return `${minEarn}k – ${maxEarn}k`;
}

const AvailabilityScreen: React.FC = () => {
  const nav = useNav();

  const [windows, setWindows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [weekday, setWeekday] = useState(0); // 0 = T2
  const [loadError, setLoadError] = useState("");
  const [rulesModalVisible, setRulesModalVisible] = useState(false);

  // Stepper state: phút từ 0:00 (18:00 = 1080, 21:00 = 1260)
  const [startMinutes, setStartMinutes] = useState(18 * 60);
  const [endMinutes, setEndMinutes] = useState(21 * 60);

  // Tính ngày trong tuần hiện tại
  const weekDates = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = CN, 1 = T2
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);

    return WEEKDAYS.map((wd, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      return {
        ...wd,
        dateNum: d.getDate(),
      };
    });
  }, []);

  // Format phút thành chuỗi "HH:mm"
  const minutesToStr = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const mins = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  // Tính tổng số giờ rảnh cả tuần
  const totalWeeklyHours = useMemo(() => {
    let totalMins = 0;
    windows.forEach((w) => {
      if (!w.time_from || !w.time_to) return;
      const [sh, sm] = w.time_from.slice(0, 5).split(":").map(Number);
      const [eh, em] = w.time_to.slice(0, 5).split(":").map(Number);
      let diff = eh * 60 + em - (sh * 60 + sm);
      if (diff <= 0) diff += 24 * 60;
      totalMins += diff;
    });
    return (totalMins / 60).toFixed(1);
  }, [windows]);

  // Ước tính thu nhập cả tuần (80k - 120k/h)
  const weeklyEarningsEstimate = useMemo(() => {
    const h = parseFloat(totalWeeklyHours);
    if (h <= 0) return "0đ";
    const minEarn = Math.round(h * 80 * 1000);
    const maxEarn = Math.round(h * 120 * 1000);
    return `${minEarn.toLocaleString("vi-VN")}đ ~ ${maxEarn.toLocaleString("vi-VN")}đ`;
  }, [totalWeeklyHours]);

  // Tính số ca cho từng ngày trong tuần
  const slotCountByWeekday = useMemo(() => {
    const map: Record<number, number> = {};
    WEEKDAYS.forEach((w) => {
      map[w.value] = 0;
    });
    windows.forEach((w) => {
      if (map[w.weekday] !== undefined) {
        map[w.weekday] += 1;
      }
    });
    return map;
  }, [windows]);

  // Các ca của ngày đang chọn
  const dayWindows = useMemo(() => {
    return windows.filter((w) => w.weekday === weekday);
  }, [windows, weekday]);

  // Tính tổng số giờ của ngày đang chọn
  const dayTotalHours = useMemo(() => {
    let totalMins = 0;
    dayWindows.forEach((w) => {
      if (!w.time_from || !w.time_to) return;
      const [sh, sm] = w.time_from.slice(0, 5).split(":").map(Number);
      const [eh, em] = w.time_to.slice(0, 5).split(":").map(Number);
      let diff = eh * 60 + em - (sh * 60 + sm);
      if (diff <= 0) diff += 24 * 60;
      totalMins += diff;
    });
    return (totalMins / 60).toFixed(1);
  }, [dayWindows]);

  // Tóm tắt thời lượng khung giờ đang chọn trong Stepper
  const stepperSummary = useMemo(() => {
    let diff = endMinutes - startMinutes;
    if (diff <= 0) diff += 24 * 60;
    const h = (diff / 60).toFixed(1);
    const minEarn = Math.round((diff / 60) * 80 * 1000);
    const maxEarn = Math.round((diff / 60) * 120 * 1000);
    return {
      hours: h,
      minEarn,
      maxEarn,
      payoutText: `~${minEarn.toLocaleString("vi-VN")}đ – ${maxEarn.toLocaleString("vi-VN")}đ`,
    };
  }, [startMinutes, endMinutes]);

  // Tải dữ liệu từ Backend
  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res: any = await getAvailability();
      setWindows(res?.windows ?? []);
    } catch (err) {
      setLoadError("Không tải được lịch rảnh từ hệ thống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  // RN useFocusEffect → web: gọi khi mount (màn remount khi quay lại tab)
  useEffect(() => {
    load();
  }, [load]);

  // Điều chỉnh giờ stepper (+ / - delta phút)
  const adjustTime = (type: "start" | "end", delta: number) => {
    if (type === "start") {
      setStartMinutes((prev) => (prev + delta + 24 * 60) % (24 * 60));
    } else {
      setEndMinutes((prev) => (prev + delta + 24 * 60) % (24 * 60));
    }
  };

  // Chọn Preset
  const applyPreset = (startStr: string, endStr: string) => {
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    setStartMinutes(sh * 60 + sm);
    setEndMinutes(eh * 60 + em);
  };

  // Thêm khung giờ lên backend
  const addSlot = async () => {
    const tf = minutesToStr(startMinutes);
    const tt = minutesToStr(endMinutes);

    if (tf === tt) {
      showAlert("Thời gian không hợp lệ", "Giờ kết thúc phải khác giờ bắt đầu.");
      return;
    }

    setSaving(true);
    try {
      await addAvailability({ weekday, time_from: tf, time_to: tt });
      await load();
      showAlert("Thành công", `Đã mở khung giờ ${tf} – ${tt} cho ${WEEKDAYS[weekday].label}.`);
    } catch (err: any) {
      const body = err?.response?.data;
      if (body?.code === "overlap_windows") {
        const m = body.merge_suggestion;
        showAlert(
          "Khung giờ chồng lấn",
          `Khung giờ này bị trùng với lịch bạn đã mở. Gợi ý gộp: ${m?.time_from?.slice(0, 5)} – ${m?.time_to?.slice(0, 5)}.`
        );
      } else {
        const msg =
          typeof body?.detail === "string"
            ? body.detail
            : typeof body?.error === "string"
            ? body.error
            : "Không thể lưu khung giờ. Vui lòng thử lại.";
        showAlert("Không thể lưu", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // Xóa khung giờ
  const removeSlot = (w: any) => {
    const dayLabel = WEEKDAYS.find((d) => d.value === w.weekday)?.label ?? "";
    const timeRange = `${w.time_from.slice(0, 5)} – ${w.time_to.slice(0, 5)}`;

    // RN Alert.alert 2 nút [Đóng / Xóa khung giờ destructive] → window.confirm (web)
    if (!window.confirm(`Xóa khung giờ rảnh?\n\nBạn có chắc chắn muốn đóng khung giờ ${dayLabel} (${timeRange})?`)) return;
    (async () => {
      setDeletingId(w.id);
      try {
        await deleteAvailability(w.id);
        await load();
      } catch (err: any) {
        if (err?.response?.status === 409) {
          showAlert(
            "Đang có đơn hoạt động",
            "Khung giờ này đã được hệ thống ghép với Phụ huynh. Bạn không thể xóa để đảm bảo điểm tín nhiệm đối tác."
          );
        } else {
          showAlert("Lỗi", "Không xóa được khung giờ này. Vui lòng thử lại.");
        }
      } finally {
        setDeletingId(null);
      }
    })();
  };

  const handleSupport = () => {
    try {
      window.location.href = "tel:19006828";
    } catch {
      showAlert("Hỗ trợ 24/7", "Tổng đài CarePartner EduCareLink: 1900 6828");
    }
  };

  const canGoBack = (nav.state.stacks[nav.state.tab] || []).length > 1;
  const selectedDayInfo = WEEKDAYS[weekday] || WEEKDAYS[0];

  return (
    <Screen bg="#FAF8FF" scroll={false}>
      {/* TOP APP BAR */}
      <div
        style={{
          background: "rgba(250, 248, 255, 0.95)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        <StatusBarSpacer />
        <div
          style={{
            height: 72,
            padding: "0 16px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Touchable
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "#EAEDFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            onPress={() => canGoBack && nav.goBack()}
          >
            <Icon name="arrow-back" size={22} color="#131B2E" />
          </Touchable>

          <div style={{ flex: 1, minWidth: 0, padding: "0 6px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                background: "rgba(0, 113, 76, 0.1)",
                border: "1px solid rgba(0, 113, 76, 0.2)",
                padding: "2px 8px",
                borderRadius: 12,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: "#00714C",
                  marginRight: 6,
                  animation: "edc-pulse 1.6s ease-in-out infinite",
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#00714C", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                CAREPARTNER RADAR ACTIVE
              </span>
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "#131B2E",
                lineHeight: "22px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Lịch Rảnh &amp; Ghép Việc AI
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#594138",
                marginTop: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Hệ thống AI tự động phân tích lịch và ghép việc cho bạn
            </div>
          </div>

          <Touchable
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "#EAEDFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              flexShrink: 0,
            }}
            onPress={handleSupport}
          >
            <Icon name="headset-outline" size={22} color="#131B2E" />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "#00714C",
                position: "absolute",
                top: 8,
                right: 8,
                border: "1.5px solid #FAF8FF",
              }}
            />
          </Touchable>
        </div>
      </div>

      {/* Scroll content (paddingBottom 110 như RN — chừa chỗ bottom tab) */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>
        <div style={{ padding: "12px 16px 110px" }}>
          {/* INTERACTIVE STATE BAR & QUICK ACTIONS */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                background: "rgba(0, 113, 76, 0.1)",
                padding: "5px 10px",
                borderRadius: 16,
                gap: 6,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: 3.5, background: "#00714C" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00714C" }}>Hồ sơ trực tuyến</span>
            </div>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Touchable
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: "#EAEDFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={() => setRulesModalVisible(true)}
              >
                <Icon name="help-circle-outline" size={20} color="#594138" />
              </Touchable>

              <Touchable
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  background: "#E2E7FF",
                  padding: "6px 10px",
                  borderRadius: 16,
                  gap: 4,
                }}
                onPress={() => nav.navigate("Blackout")}
              >
                <Icon name="calendar-outline" size={14} color="#855300" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#131B2E" }}>Báo bận / Thi</span>
              </Touchable>
            </div>
          </div>

          {/* BENTO DASHBOARD TỔNG QUAN TUẦN */}
          <div style={{ background: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 20, boxShadow: SHADOWS.small }}>
            {/* AI Banner */}
            <div
              style={{
                background: "rgba(0, 113, 76, 0.08)",
                border: "1px solid rgba(0, 113, 76, 0.18)",
                borderRadius: 14,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                  <Icon name={ic("radio")} size={18} color="#00714C" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#00714C", flex: 1 }}>Radar AI Đang Tìm Kiếm Việc Làm Cho Bạn</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    background: "rgba(0, 113, 76, 0.15)",
                    padding: "2px 8px",
                    borderRadius: 10,
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: 2.5, background: "#00714C" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#00714C" }}>Bán kính 10km</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#131B2E", lineHeight: "18px" }}>
                Khi bạn mở lịch rảnh, thuật toán AI EduCareLink sẽ tự động đối soát kỹ năng sư phạm, vị trí GPS và khung giờ của bạn để ưu
                tiên đưa hồ sơ lên đầu bảng cho phụ huynh.
              </div>
            </div>

            {/* Weekly Potential */}
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <Icon name="cash-outline" size={15} color="#855300" />
                  <span style={{ fontSize: 12, color: "#594138", fontWeight: 500 }}>Thu nhập tuần ước tính</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#00714C", letterSpacing: "-0.5px" }}>{weeklyEarningsEstimate}</div>
                <div style={{ fontSize: 12, color: "#594138", marginTop: 2 }}>
                  Dựa trên <span style={{ fontWeight: 700, color: "#131B2E" }}>{totalWeeklyHours}h rảnh</span> đã mở · Đơn giá 80k–120k/h
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    background: "rgba(0, 113, 76, 0.1)",
                    padding: "4px 8px",
                    borderRadius: 8,
                    gap: 5,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: "#00714C" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00714C" }}>AI Sẵn Sàng Ghép</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 6, background: "#EAEDFF", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
              <div
                style={{
                  height: "100%",
                  background: COLORS.primary,
                  borderRadius: 3,
                  width: `${Math.min(100, Math.max(10, parseFloat(totalWeeklyHours) * 5))}%`,
                }}
              />
            </div>

            {/* AI Tip */}
            <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", background: "#F2F3FF", borderRadius: 12, padding: 10, gap: 8 }}>
              <Icon name="sparkles" size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
              <div style={{ flex: 1, fontSize: 12, color: "#131B2E", lineHeight: "18px" }}>
                <span style={{ fontWeight: 700, color: COLORS.primary }}>Gợi ý thông minh: </span>
                Mở thêm 2h tối Thứ 6 hoặc Chủ Nhật để tăng <span style={{ fontWeight: 700, color: "#00714C" }}>+20% cơ hội</span> nhận ca
                kèm gần trường.
              </div>
            </div>
          </div>

          {/* HORIZONTAL WEEKDAY SELECTOR */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="calendar" size={18} color={COLORS.primary} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#131B2E" }}>Chọn ngày trong tuần</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#00714C" }}>Tuần này</span>
            </div>

            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
              {weekDates.map((item) => {
                const isSelected = weekday === item.value;
                const count = slotCountByWeekday[item.value] || 0;
                const hasSlots = count > 0;

                return (
                  <Touchable
                    key={item.value}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "10px 0",
                      borderRadius: 12,
                      background: "#FFFFFF",
                      boxShadow: SHADOWS.small,
                      ...(isSelected ? { background: COLORS.primary, transform: "scale(1.04)" } : {}),
                    }}
                    onPress={() => setWeekday(item.value)}
                    activeOpacity={0.7}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "rgba(255, 255, 255, 0.9)" : "#594138" }}>{item.short}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: isSelected ? "#FFFFFF" : "#131B2E", margin: "2px 0" }}>{item.dateNum}</span>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        margin: "3px 0",
                        background: hasSlots ? (isSelected ? "#FFFFFF" : "#00714C") : "#DAE2FD",
                      }}
                    />
                    <span style={{ fontSize: 9, fontWeight: isSelected ? 700 : 600, color: isSelected ? "#FFFFFF" : "#594138" }}>
                      {hasSlots ? `${count} ca` : "Trống"}
                    </span>
                  </Touchable>
                );
              })}
            </div>
          </div>

          {/* 1-TAP QUICK PRESETS */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="flash" size={16} color="#855300" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#594138", letterSpacing: "0.5px" }}>CHỌN NHANH KHUNG GIỜ PHỔ BIẾN</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#855300" }}>Chạm để điền</span>
            </div>

            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PRESETS.map((p) => (
                <Touchable
                  key={p.id}
                  style={{
                    width: "calc(50% - 4px)",
                    background: p.isPeak ? "#FFFDF5" : "#FFFFFF",
                    borderRadius: 14,
                    padding: 12,
                    boxShadow: SHADOWS.small,
                    border: p.isPeak ? "1px solid #FFDD78" : "1px solid transparent",
                  }}
                  onPress={() => applyPreset(p.start, p.end)}
                  activeOpacity={0.8}
                >
                  <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        background: p.isPeak ? "rgba(202, 129, 0, 0.15)" : "#EAEDFF",
                        padding: "2px 6px",
                        borderRadius: 6,
                      }}
                    >
                      {p.badge && <Icon name={ic("flame")} size={12} color="#855300" style={{ marginRight: 2 }} />}
                      <span style={{ fontSize: 10, fontWeight: 700, color: p.isPeak ? "#855300" : "#594138" }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#594138", fontWeight: 600 }}>{p.duration}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#131B2E", marginBottom: 2 }}>
                    {p.start} – {p.end}
                  </div>
                  <div style={{ fontSize: 11, color: "#594138", ...clamp(1) }}>{p.desc}</div>
                </Touchable>
              ))}
            </div>
          </div>

          {/* REGISTERED SLOTS FOR SELECTED DAY */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#131B2E" }}>Lịch {selectedDayInfo.label}</div>
                <div style={{ fontSize: 12, color: "#594138", marginTop: 2 }}>
                  {dayWindows.length} khung giờ đã mở · {dayTotalHours} tiếng rảnh
                </div>
              </div>
              {dayWindows.length > 0 && (
                <div style={{ background: "rgba(0, 113, 76, 0.1)", padding: "3px 10px", borderRadius: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00714C" }}>Khả dụng cao</span>
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", margin: "24px 0" }}>
                <Spinner size={26} color={COLORS.primary} />
              </div>
            ) : loadError ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20, background: "#FEF2F2", borderRadius: 14 }}>
                <Icon name="alert-circle-outline" size={28} color="#DC2626" />
                <span style={{ fontSize: 13, color: "#DC2626", textAlign: "center", marginTop: 6 }}>{loadError}</span>
                <Touchable
                  style={{ marginTop: 10, padding: "6px 16px", background: COLORS.primary, borderRadius: 12 }}
                  onPress={load}
                >
                  <span style={{ color: "#FFFFFF", fontWeight: 600, fontSize: 12 }}>Thử lại</span>
                </Touchable>
              </div>
            ) : dayWindows.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "28px 20px",
                  background: "#FFFFFF",
                  borderRadius: 16,
                  border: "1px dashed #E2E8F0",
                }}
              >
                <Icon name="calendar-outline" size={40} color="#CBD5E1" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#131B2E", marginTop: 10, textAlign: "center" }}>
                  Chưa mở khung giờ nào cho {selectedDayInfo.label}
                </span>
                <span style={{ fontSize: 12, color: "#594138", textAlign: "center", marginTop: 4, lineHeight: "18px" }}>
                  Hãy dùng bộ chọn giờ bên dưới hoặc bấm các khung giờ vàng để AI tìm việc cho bạn.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {dayWindows.map((w) => {
                  const isLocked = !!w.is_locked;
                  return (
                    <div
                      key={w.id}
                      style={{
                        background: isLocked ? "#F8FAFF" : "#FFFFFF",
                        borderRadius: 14,
                        display: "flex",
                        flexDirection: "row",
                        overflow: "hidden",
                        boxShadow: SHADOWS.small,
                        ...(isLocked ? { border: "1px solid #E2E7FF" } : {}),
                      }}
                    >
                      <div style={{ width: 5, flexShrink: 0, background: isLocked ? COLORS.primary : "#00714C" }} />
                      <div style={{ flex: 1, minWidth: 0, padding: 12 }}>
                        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 16, fontWeight: 700, color: "#131B2E" }}>
                                {w.time_from.slice(0, 5)} – {w.time_to.slice(0, 5)}
                              </span>
                              <span style={{ fontSize: 12, color: "#594138", fontWeight: 500 }}>
                                ({calculateDuration(w.time_from, w.time_to)} tiếng)
                              </span>
                            </div>

                            <div style={{ marginTop: 4 }}>
                              {isLocked ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    background: "rgba(242, 101, 34, 0.1)",
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    alignSelf: "flex-start",
                                  }}
                                >
                                  <Icon name="lock-closed-outline" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.primary }}>AI Đã Ghép Đơn (Đã Khóa Lịch)</span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    background: "rgba(0, 113, 76, 0.1)",
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    alignSelf: "flex-start",
                                    gap: 4,
                                  }}
                                >
                                  <div style={{ width: 5, height: 5, borderRadius: 2.5, background: "#00714C" }} />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#00714C" }}>AI Đang Tìm Phụ Huynh Phù Hợp</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {isLocked ? (
                            <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Icon name="checkmark-circle" size={20} color="#00714C" />
                            </div>
                          ) : (
                            <Touchable
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#F8FAFC",
                                flexShrink: 0,
                              }}
                              onPress={() => removeSlot(w)}
                              disabled={deletingId === w.id}
                            >
                              {deletingId === w.id ? (
                                <Spinner size={16} color="#DC2626" />
                              ) : (
                                <Icon name="trash-outline" size={19} color="#94A3B8" />
                              )}
                            </Touchable>
                          )}
                        </div>

                        {isLocked ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 6,
                              paddingTop: 6,
                              borderTop: "1px solid #F1F5F9",
                            }}
                          >
                            <Icon name="shield-checkmark" size={13} color="#00714C" />
                            <span style={{ fontSize: 11, color: "#00714C", fontWeight: 500 }}>
                              Ca làm đã cam kết. Điểm tín nhiệm đối tác của bạn đạt 100/100.
                            </span>
                          </div>
                        ) : (
                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #F1F5F9" }}>
                            <span style={{ fontSize: 11, color: "#594138" }}>
                              Ước tính thu nhập: {calculateEstimatedIncome(w.time_from, w.time_to)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CUSTOM TIME SLOT STEPPER */}
          <div style={{ background: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 20, boxShadow: SHADOWS.small }}>
            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="add-circle" size={20} color={COLORS.primary} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#131B2E" }}>Thêm khung giờ linh hoạt</span>
              </div>
              <span style={{ fontSize: 12, color: "#594138" }}>Tối thiểu 1.0h</span>
            </div>

            {/* Stepper Grid */}
            <div style={{ display: "flex", flexDirection: "row", gap: 12, marginBottom: 12 }}>
              {/* TỪ GIỜ */}
              <div style={{ flex: 1, background: "#F2F3FF", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#594138", marginBottom: 6 }}>TỪ GIỜ</div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Touchable
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: SHADOWS.small,
                    }}
                    onPress={() => adjustTime("start", -30)}
                    activeOpacity={0.7}
                  >
                    <MinusIcon size={18} color="#131B2E" />
                  </Touchable>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#131B2E" }}>{minutesToStr(startMinutes)}</span>
                  <Touchable
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: SHADOWS.small,
                    }}
                    onPress={() => adjustTime("start", 30)}
                    activeOpacity={0.7}
                  >
                    <Icon name="add" size={18} color="#131B2E" />
                  </Touchable>
                </div>
              </div>

              {/* ĐẾN GIỜ */}
              <div style={{ flex: 1, background: "#F2F3FF", borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#594138", marginBottom: 6 }}>ĐẾN GIỜ</div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Touchable
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: SHADOWS.small,
                    }}
                    onPress={() => adjustTime("end", -30)}
                    activeOpacity={0.7}
                  >
                    <MinusIcon size={18} color="#131B2E" />
                  </Touchable>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#131B2E" }}>{minutesToStr(endMinutes)}</span>
                  <Touchable
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: SHADOWS.small,
                    }}
                    onPress={() => adjustTime("end", 30)}
                    activeOpacity={0.7}
                  >
                    <Icon name="add" size={18} color="#131B2E" />
                  </Touchable>
                </div>
              </div>
            </div>

            {/* Duration Summary */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(0, 113, 76, 0.08)",
                borderRadius: 12,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="time" size={17} color="#00714C" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#00714C" }}>Thời lượng: {stepperSummary.hours} tiếng</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#00714C" }}>{stepperSummary.payoutText}</span>
            </div>

            {/* Submit Slot Button */}
            <Touchable
              style={{
                height: 48,
                borderRadius: 14,
                background: COLORS.primary,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0px 4px 8px rgba(242, 101, 34, 0.3)",
              }}
              onPress={addSlot}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <Spinner size={22} color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={20} color="#FFFFFF" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.3px" }}>LƯU KHUNG GIỜ NÀY</span>
                </>
              )}
            </Touchable>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 }}>
              <Icon name="information-circle-outline" size={15} color="#855300" style={{ marginTop: 1 }} />
              <span style={{ flex: 1, fontSize: 11, color: "#594138", lineHeight: "16px" }}>
                Nếu mở ca qua đêm (sau 22:00), hệ thống sẽ tự động tách 2 ca hợp lệ theo chuẩn an toàn EduCareLink.
              </span>
            </div>
          </div>

          {/* COMMITMENT & TRUST POLICY NOTICE */}
          <div style={{ display: "flex", flexDirection: "row", background: "#F2F3FF", borderRadius: 16, padding: 14, gap: 10, alignItems: "flex-start" }}>
            <Icon name="shield-checkmark" size={24} color="#00714C" style={{ marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#131B2E", marginBottom: 2 }}>Cam kết minh bạch &amp; Tự chủ thời gian</div>
              <div style={{ fontSize: 12, color: "#594138", lineHeight: "18px" }}>
                Bạn có thể cập nhật hoặc đóng khung giờ bất kỳ lúc nào trước khi có phụ huynh đặt lịch. Khi nhận yêu cầu khớp lịch từ AI,
                bạn luôn có <span style={{ fontWeight: 700, color: "#131B2E" }}>60 phút</span> để xác nhận trước khi hệ thống khóa ca.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL QUY TẮC MỞ LỊCH */}
      {rulesModalVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setRulesModalVisible(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 20, padding: 20, boxShadow: SHADOWS.medium }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Icon name="shield-checkmark" size={24} color={COLORS.primary} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#131B2E" }}>Quy tắc mở lịch EduCareLink</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary }}>1.</span>
                <span style={{ flex: 1, fontSize: 13, color: "#594138", lineHeight: "18px" }}>
                  Mở tối thiểu 1.0 giờ cho mỗi ca làm việc để thuận tiện ghép đơn.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary }}>2.</span>
                <span style={{ flex: 1, fontSize: 13, color: "#594138", lineHeight: "18px" }}>
                  Xác nhận đơn trong 60 phút khi AI đề xuất để giữ điểm uy tín 100/100.
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.primary }}>3.</span>
                <span style={{ flex: 1, fontSize: 13, color: "#594138", lineHeight: "18px" }}>
                  Chủ động đóng khung giờ trước 4 tiếng nếu có lịch học/thi đột xuất.
                </span>
              </div>
            </div>
            <Touchable
              style={{ background: COLORS.primary, borderRadius: 12, padding: "10px 0", display: "flex", alignItems: "center" }}
              onPress={() => setRulesModalVisible(false)}
            >
              <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>Đã hiểu</span>
            </Touchable>
          </div>
        </div>
      )}
    </Screen>
  );
};

export default AvailabilityScreen;
