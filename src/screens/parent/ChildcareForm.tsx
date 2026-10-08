/**
 * ChildcareForm — port CHÍNH XÁC mobile/src/screens/Parent/ChildcareForm.js (1199 dòng).
 * Flow 1 Step 1 §B: Đăng việc ĐỒNG HÀNH CÙNG TRẺ TẠI NHÀ.
 * Toàn bộ sections 1-8 giữ nguyên thứ tự + text + màu hardcode (#0D9488 teal) từ RN:
 *   Top bar (back · title · shield Alert cam kết) → Hero banner → 1 Độ tuổi của trẻ
 *   (AGE_GROUPS 6-10 / trên 10) → 2 Số lượng trẻ (stepper 1..5, phụ phí 25.000đ) →
 *   3 Nhiệm vụ chăm sóc (7 duty chips multi-select + badge "Đã chọn N việc") →
 *   4 Lưu ý y tế / dị ứng (alert card amber) → 5 Yêu cầu chi tiết (+4 quick chips) →
 *   6 Lịch làm việc & thời gian (date chips + timeFrom/timeTo) → 7 Mức phí đề xuất
 *   (benchmark box) → 8 Địa điểm đồng hành (picker + ghi chú căn hộ) → Trust banner →
 *   Sticky bottom dock (tạm tính 9h × ngày) → SearchingCarePartnerModal.
 * Submit nguyên bản RN flow: createJob({job_type:'childcare',...}) → publishJob →
 *   getMatchingCandidates (preload, lỗi bỏ qua) → richJob → giữ modal ≥1.2s → success →
 *   600ms → navigate('CandidatesList', {jobId, job, candidates, totalMatched});
 *   nếu publish/candidates fail mà đã tạo job → fallback richJob vẫn sang CandidatesList;
 *   nếu chưa tạo được job → searchStatus 'error' + extractErrorMessage.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - JobLocationPicker (Leaflet WebView + MapPickerModal) → web: ô tìm địa chỉ
 *   (geocode /matching/geocode/search + Nominatim fallback) + nút "Dùng vị trí hiện tại"
 *   (expo-location → navigator.geolocation). RN web cũng rơi vào fallbackBox không map.
 * - @react-native-community/datetimepicker (web RN: KHÔNG render — không thêm được ngày)
 *   → <input type="date"> native, min = hôm nay, chọn xong tự đóng (giữ validation
 *   "Không được chọn ngày trong quá khứ" của RN).
 * - Alert.alert → showAlert; Animated spring/loop (radar rings, sheet slide) → CSS keyframes;
 * - Icon thiếu glyph trong bộ 159 ionicons (search-outline, close-circle-outline, alert,
 *   checkmark-done) → map glyph gần nhất cùng nghĩa (ic()) vì không được sửa ionicons.ts.
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer } from "@/components/ui";
import { SHADOWS, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import { createJob, publishJob, getMatchingCandidates } from "@/api/matching";
import api from "@/api/client";

/* ---------- Constants — nguyên văn RN ---------- */
const AGE_GROUPS = [
  { code: "6_to_10_years", label: "6 - 10 tuổi", sub: "Tiểu học & bài tập", icon: "📚" },
  { code: "over_10_years", label: "Trên 10 tuổi", sub: "Kèm học & kỹ năng", icon: "🧒" },
];

const DUTIES = [
  { code: "general_care", label: "Chăm sóc chung", icon: "🌟" },
  { code: "feeding", label: "Cho ăn / Ăn dặm", icon: "🥣" },
  { code: "bathing", label: "Tắm rửa & Vệ sinh", icon: "🛁" },
  { code: "sleep_monitoring", label: "Trông giấc ngủ", icon: "😴" },
  { code: "play_activities", label: "Vui chơi & Vận động", icon: "🧩" },
  { code: "homework_help", label: "Hỗ trợ bài tập", icon: "📖" },
  { code: "light_chores", label: "Rửa bình & dọn đồ chơi", icon: "🍼" },
];

const QUICK_REQUIREMENTS = [
  "Không dùng ĐT khi trông",
  "Biết sơ cứu bé",
  "Có bằng Mầm non",
  "Kể chuyện đọc sách",
];

/* ---------- Icon fallback (bộ 159 glyph thiếu vài outline) ---------- */
const ICON_FALLBACKS: Record<string, string> = {
  "search-outline": "search",
  "close-circle-outline": "close-circle",
  alert: "alert-circle",
  "checkmark-done": "checkmark",
};
const ic = (name: string) => ICON_FALLBACKS[name] ?? name;

/* ---------- Utils — port mobile/src/utils/date.js (phần form dùng) ---------- */
function formatDateToYMD(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const getTodayYMD = () => formatDateToYMD(new Date());

/** extractErrorMessage — nguyên bản RN utils/date.js (thêm nhận diện thông điệp timeout/mạng của client web) */
function extractErrorMessage(err: any, fallback = "Không thể thực hiện. Vui lòng kiểm tra lại thông tin."): string {
  if (!err) return fallback;
  const msg: string = err.message ? String(err.message) : "";
  if (err.code === "ECONNABORTED" || /timeout|hết thời gian chờ/i.test(msg)) {
    return "Thời gian xử lý quá hạn (hệ thống AI đang phân tích). Vui lòng thử lại hoặc vào danh sách công việc để kiểm tra.";
  }
  if (/network error|lỗi kết nối mạng/i.test(msg)) {
    return "Lỗi kết nối mạng: Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại đường truyền Wi-Fi/4G và thử lại.";
  }
  const status = err.response?.status;
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 502 || status === 503 || status === 504)
    return "Máy chủ đang khởi động hoặc tạm bận. Vui lòng thử lại sau ít phút.";
  if (status >= 500) return "Lỗi máy chủ nội bộ. Vui lòng thử lại sau giây lát.";
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (data.detail && typeof data.detail === "object") {
    const firstKey = Object.keys(data.detail)[0];
    const val = data.detail[firstKey];
    if (Array.isArray(val) && val.length > 0) return `${val[0]}`;
    if (typeof val === "string") return val;
    return JSON.stringify(data.detail);
  }
  if (typeof data.message === "string") return data.message;
  const keys = Object.keys(data);
  if (keys.length > 0 && keys[0] !== "code") {
    const val = data[keys[0]];
    if (Array.isArray(val) && val.length > 0) return `${val[0]}`;
    if (typeof val === "string") return `${val}`;
  }
  return fallback;
}

/* ---------- Types dùng chung ---------- */
export interface LocationValue {
  latitude: number;
  longitude: number;
  label?: string;
}

/* ---------- CSS cục bộ (radar/sheet animation + placeholder màu theo RN) ---------- */
const CCF_CSS = `
@keyframes ccfRipple { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
@keyframes ccfSheetUp { from { transform: translateY(60%); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
@keyframes ccfFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ccfSuccessPop { 0% { transform: scale(0); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }
.ccf-ph-slate::placeholder { color: #94A3B8; }
.ccf-ph-amber::placeholder { color: #B45309; }
.ccf-date-input { appearance: auto; -webkit-appearance: auto; }
`;

/* ============================================================
 * JobLocationPicker — web thay thế MapPicker của RN (xem header):
 * tìm địa chỉ qua backend geocode + "Dùng vị trí hiện tại" GPS.
 * Style giữ nguyên khung tìm kiếm/thẻ địa chỉ của RN JobLocationPicker.
 * ============================================================ */
interface GeocodeSearchRow {
  lat?: string;
  lon?: string;
  display_name?: string;
}

export const JobLocationPicker: React.FC<{
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
}> = ({ value, onChange }) => {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const applyLocation = (lat: number, lng: number, label: string) => {
    onChange({ latitude: lat, longitude: lng, label: label || `Vị trí (${lat.toFixed(4)}, ${lng.toFixed(4)})` });
  };

  /** Reverse geocode: backend chuẩn → Nominatim dự phòng (nguyên bản RN) */
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const data: any = await api.get(`/matching/geocode/reverse/?lat=${lat}&lon=${lng}`);
      if (data?.display_name) return String(data.display_name);
      if (Array.isArray(data?.results) && data.results[0]?.display_name) return String(data.results[0].display_name);
    } catch {
      /* thử Nominatim */
    }
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { "User-Agent": "EduCareLink/1.0" },
      });
      const d = await r.json();
      if (d?.display_name) return String(d.display_name);
    } catch {
      /* ignore */
    }
    return "";
  };

  /** RN: expo-location getCurrentPositionAsync → web: navigator.geolocation */
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      showAlert("Lỗi", "Không thể lấy được vị trí hiện tại. Vui lòng thử chọn trên bản đồ.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let label = "Vị trí hiện tại của bạn";
          const rev = await reverseGeocode(lat, lng);
          if (rev) label = rev;
          applyLocation(lat, lng, label);
        } catch {
          showAlert("Lỗi", "Không thể lấy được vị trí hiện tại. Vui lòng thử chọn trên bản đồ.");
        } finally {
          setIsLocating(false);
        }
      },
      (err: { code?: number }) => {
        setIsLocating(false);
        if (err?.code === 1) {
          showAlert("Cần cấp quyền", "EduCareLink cần quyền truy cập vị trí để tự động định vị.");
        } else {
          showAlert("Lỗi", "Không thể lấy được vị trí hiện tại. Vui lòng thử chọn trên bản đồ.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /** Tìm địa điểm theo tên — backend /matching/geocode/search/ → Nominatim dự phòng (RN) */
  const searchPlace = async () => {
    const q = searchText.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const data: any = await api.get(`/matching/geocode/search/?q=${encodeURIComponent(q + " Việt Nam")}`);
      const rows: GeocodeSearchRow[] = Array.isArray(data?.results) ? data.results : [];
      if (rows.length) {
        const lat = parseFloat(String(rows[0].lat));
        const lng = parseFloat(String(rows[0].lon));
        applyLocation(lat, lng, rows[0].display_name || q);
        return;
      }
      showAlert("Không tìm thấy", "Thử nhập tên địa điểm hoặc phường/quận cụ thể hơn.");
    } catch {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + " Việt Nam")}`,
          { headers: { "User-Agent": "EduCareLink/1.0" } }
        );
        const list = await resp.json();
        if (Array.isArray(list) && list.length) {
          const lat = parseFloat(list[0].lat);
          const lng = parseFloat(list[0].lon);
          applyLocation(lat, lng, list[0].display_name || q);
          return;
        }
        showAlert("Không tìm thấy", "Thử nhập tên địa điểm hoặc phường/quận cụ thể hơn.");
      } catch {
        showAlert("Lỗi tìm kiếm", "Không thể tìm kiếm địa điểm lúc này.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 14,
        border: "1px solid #E2E8F0",
        background: "#FFFFFF",
        overflow: "hidden",
        boxShadow: SHADOWS.small,
      }}
    >
      {/* 1. THANH TÌM KIẾM ĐỊA ĐIỂM */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          background: "#F8FAFC",
          padding: "6px 8px",
          borderBottom: "1px solid #E2E8F0",
          gap: 6,
        }}
      >
        <Icon name={ic("search-outline")} size={17} color="#94A3B8" style={{ marginLeft: 4 }} />
        <input
          className="ccf-ph-slate"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 12.5,
            color: "#0F172A",
            padding: "4px 0",
          }}
          placeholder="Tìm địa điểm (VD: 126 Lê Lợi, TP. Huế...)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") searchPlace();
          }}
        />
        {searchText ? (
          <Touchable onPress={() => setSearchText("")} hitSlop={8}>
            <Icon name="close-circle" size={16} color="#94A3B8" style={{ marginRight: 4 }} />
          </Touchable>
        ) : null}
        <Touchable
          onPress={searchPlace}
          disabled={isSearching}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#F26522",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isSearching ? <Spinner size={13} color="#FFFFFF" /> : <Icon name="search" size={15} color="#FFFFFF" />}
        </Touchable>
        <Touchable
          onPress={useCurrentLocation}
          disabled={isLocating}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#FFF4ED",
            border: "1px solid #FED7AA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isLocating ? <Spinner size={13} color="#F26522" /> : <Icon name="locate" size={17} color="#F26522" />}
        </Touchable>
      </div>

      {/* 2. KHUNG BẢN ĐỒ — RN web render fallbackBox (không WebView); thêm nút GPS nhãn rõ ràng */}
      <div
        style={{
          height: 190,
          width: "100%",
          position: "relative",
          background: "#FFF9F5",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          gap: 4,
        }}
      >
        <Icon name="map-outline" size={32} color="#F26522" />
        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Bản đồ vị trí EduCareLink</span>
        <span style={{ fontSize: 11, color: "#64748B", textAlign: "center" }}>
          {value?.label || "Chạm vào ô tìm kiếm hoặc nút định vị để chọn vị trí"}
        </span>
        <Touchable
          onPress={useCurrentLocation}
          disabled={isLocating}
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 6,
            background: "#FFF4ED",
            border: "1.5px dashed #FED7AA",
            borderRadius: 10,
            padding: "6px 12px",
          }}
        >
          {isLocating ? <Spinner size={13} color="#F26522" /> : <Icon name="locate" size={14} color="#F26522" />}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#F26522" }}>Dùng vị trí hiện tại</span>
        </Touchable>
      </div>

      {/* 3. THẺ HIỂN THỊ ĐỊA CHỈ ĐÃ CHỌN (nguyên bản RN) */}
      {value ? (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            background: "#FFF9F5",
            padding: "8px 10px",
            borderTop: "1px solid #FED7AA",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: "#FFF4ED",
              border: "1px solid #FED7AA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="location" size={16} color="#F26522" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: "16px",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {value.label || "Vị trí đã chọn trên bản đồ"}
            </span>
            <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, marginTop: 1 }}>
              Tọa độ: {value.latitude?.toFixed(4)}, {value.longitude?.toFixed(4)} · Đã ghim ✓
            </div>
          </div>
          <Touchable onPress={() => onChange(null)} hitSlop={8} style={{ padding: 4 }}>
            <Icon name={ic("close-circle-outline")} size={18} color="#94A3B8" />
          </Touchable>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            background: "#F8FAFC",
            padding: "7px 10px",
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <Icon name="information-circle-outline" size={14} color="#F26522" />
          <span style={{ fontSize: 10.5, color: "#64748B", fontWeight: 500, flex: 1 }}>
            Chạm trên bản đồ hoặc nhập địa chỉ để ghim vị trí chính xác
          </span>
        </div>
      )}
    </div>
  );
};

/* ============================================================
 * SearchingCarePartnerModal — port 1:1 mobile/src/components/SearchingCarePartnerModal.js
 * (radar 3 vòng lan tỏa 1600ms lệch pha 0/450/900ms; luân thông điệp 1400ms;
 *  success pop; error + nút "Đóng & Kiểm tra lại"; footer bảo chứng)
 * ============================================================ */
const SEARCH_MESSAGES = [
  "AI đang phân tích yêu cầu ca làm...",
  "Đang quét cự ly GPS & thời gian rảnh gần bạn...",
  "Đang xếp hạng CarePartner theo thuật toán ELO...",
  "Đang hoàn tất danh sách ứng viên xuất sắc nhất...",
];

export const SearchingCarePartnerModal: React.FC<{
  visible: boolean;
  status?: "searching" | "success" | "error";
  serviceType?: string;
  serviceIcon?: string;
  errorMessage?: string;
  onClose?: () => void;
}> = ({ visible, status = "searching", serviceType = "Gia sư & Kèm học 1:1", serviceIcon = "school", errorMessage = "", onClose }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  // Luân chuyển thông điệp tìm kiếm (1400ms — nguyên bản RN)
  useEffect(() => {
    if (!visible || status !== "searching") return undefined;
    const interval = setInterval(() => setMessageIndex((prev) => (prev + 1) % SEARCH_MESSAGES.length), 1400);
    return () => clearInterval(interval);
  }, [visible, status]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop bán trong suốt */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.65)", animation: "ccfFade 0.25s" }} />

      {/* Bottom Sheet Card */}
      <div
        style={{
          position: "relative",
          background: "#FFFFFF",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: "12px 20px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: SHADOWS.large,
          animation: "ccfSheetUp 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Thanh kéo trang trí */}
        <div style={{ width: 44, height: 5, borderRadius: 2.5, background: "#E2E8F0", marginBottom: 14 }} />

        {/* Header trạng thái */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              background: "#FFF7ED",
              border: "1px solid #FED7AA",
              padding: "3.5px 10px",
              borderRadius: 999,
              marginBottom: 6,
            }}
          >
            <Icon name={serviceIcon} size={13} color="#F26522" style={{ marginRight: 4 }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: "#EA580C", textTransform: "uppercase" }}>{serviceType}</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", textAlign: "center" }}>
            {status === "searching" && "Đang tìm kiếm CarePartner..."}
            {status === "success" && "Đã tìm thấy ứng viên xuất sắc! 🎉"}
            {status === "error" && "Chưa thể đăng việc"}
          </span>
        </div>

        {/* Radar Scanner / Success / Error */}
        <div style={{ height: 140, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px 0" }}>
          {status === "searching" && (
            <div style={{ width: 130, height: 130, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* 3 vòng sóng lan tỏa */}
              {[0, 450, 900].map((delay) => (
                <div
                  key={delay}
                  style={{
                    position: "absolute",
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    border: "2px solid #F26522",
                    background: "rgba(242, 101, 34, 0.08)",
                    animation: "ccfRipple 1.6s linear infinite",
                    animationDelay: `${delay}ms`,
                  }}
                />
              ))}
              {/* Chấm tròn tâm cam thương hiệu */}
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  background: "#F26522",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: SHADOWS.medium,
                  zIndex: 10,
                }}
              >
                <Icon name="search" size={26} color="#FFFFFF" />
              </div>
            </div>
          )}

          {status === "success" && (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                background: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: SHADOWS.medium,
                animation: "ccfSuccessPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
              }}
            >
              <Icon name="checkmark" size={38} color="#FFFFFF" />
            </div>
          )}

          {status === "error" && (
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                background: "#DC2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: SHADOWS.medium,
              }}
            >
              <Icon name={ic("alert")} size={36} color="#FFFFFF" />
            </div>
          )}
        </div>

        {/* Thông điệp động */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minHeight: 60,
            justifyContent: "center",
            padding: "0 12px",
          }}
        >
          {status === "searching" && (
            <>
              <span
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "#1E293B",
                  textAlign: "center",
                  marginBottom: 6,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {SEARCH_MESSAGES[messageIndex]}
              </span>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Spinner size={14} color="#F26522" />
                <span style={{ fontSize: 11.5, color: "#64748B", fontWeight: 500 }}>
                  Thuật toán ELO đang đối soát cự ly và hồ sơ sinh viên
                </span>
              </div>
            </>
          )}

          {status === "success" && (
            <>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#059669", textAlign: "center" }}>
                Đã chọn lọc các ứng viên phù hợp nhất
              </span>
              <span style={{ fontSize: 12, color: "#475569", marginTop: 4, textAlign: "center" }}>
                Đang lập tức chuyển tiếp đến danh sách ứng viên...
              </span>
            </>
          )}

          {status === "error" && (
            <>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#DC2626", textAlign: "center" }}>Đã có lỗi xảy ra</span>
              <span style={{ fontSize: 12, color: "#64748B", marginTop: 4, textAlign: "center", lineHeight: "16px" }}>
                {errorMessage || "Không thể kết nối với máy chủ. Vui lòng thử lại."}
              </span>
              <Touchable
                onPress={onClose}
                style={{
                  marginTop: 12,
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  padding: "8px 16px",
                  borderRadius: 10,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Đóng &amp; Kiểm tra lại</span>
              </Touchable>
            </>
          )}
        </div>

        {/* Trust Guarantees Footer */}
        {status !== "error" && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 999,
              padding: "6px 12px",
              marginTop: 16,
              gap: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
              <Icon name="shield-checkmark" size={13} color="#059669" style={{ marginRight: 4 }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#475569" }}>Bảo lãnh MoMo Escrow</span>
            </div>
            <div style={{ width: 3, height: 3, borderRadius: 1.5, background: "#CBD5E1" }} />
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
              <Icon name={ic("checkmark-done")} size={13} color="#2563EB" style={{ marginRight: 4 }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "#475569" }}>100% đã xác thực CCCD &amp; Thẻ SV</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
 * ChildcareForm — thân màn hình (nguyên văn RN styles 1:1)
 * ============================================================ */
const S: Record<string, React.CSSProperties> = {
  topBar: {
    background: "#FFFFFF",
    padding: "0 16px 10px",
    borderBottom: "1px solid #F1F5F9",
    boxShadow: SHADOWS.small,
  },
  topBarRow: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  titleWrap: { display: "flex", flexDirection: "column", alignItems: "center" },
  topBarTitle: { fontSize: 16, fontWeight: 800, color: "#0F172A" },
  subTitleWrap: { display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  dotIndicator: { width: 6, height: 6, borderRadius: 3, background: "#0D9488" },
  topBarSub: { fontSize: 11, fontWeight: 600, color: "#0D9488" },

  scrollContent: { padding: "12px 16px 120px", display: "flex", flexDirection: "column", gap: 12 },
  heroBanner: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 18,
    padding: 12,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    boxShadow: SHADOWS.small,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#0D9488",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
    flexShrink: 0,
  },
  heroTitle: { fontSize: 13.5, fontWeight: 800, color: "#0F172A" },
  heroDesc: { fontSize: 11, color: "#475569", marginTop: 2, lineHeight: "16px" },
  heroBadgeRow: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  heroPill: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: "#FFFFFF",
    border: "1px solid #A7F3D0",
    padding: "2px 7px",
    borderRadius: 10,
  },
  heroPillDot: { width: 5, height: 5, borderRadius: 2.5, background: "#10B981" },
  heroPillText: { fontSize: 10, fontWeight: 700, color: "#047857" },

  sectionCard: {
    background: "#FFFFFF",
    borderRadius: 18,
    border: "1px solid #E2E8F0",
    padding: 14,
    boxShadow: SHADOWS.small,
  },
  sectionHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: 700, color: "#0F172A" },
  star: { color: "#E11D48", fontWeight: 800 },
  helperHint: { fontSize: 11, color: "#94A3B8", fontWeight: 500 },
  subHintText: { fontSize: 11, color: "#64748B", margin: "2px 0 6px" },

  ageGrid: { display: "flex", flexDirection: "column", gap: 8 },
  ageCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  ageCardActive: { background: "#ECFDF5", borderColor: "#0D9488", borderStyle: "solid", borderWidth: 1.5 },
  ageIcon: { fontSize: 20 },
  ageLabel: { fontSize: 12.5, fontWeight: 700, color: "#0F172A" },
  ageLabelActive: { color: "#065F46" },
  ageSub: { fontSize: 10.5, color: "#64748B" },
  ageSubActive: { color: "#047857", fontWeight: 600 },

  stepperRow: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepperControl: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F1F5F9",
    borderRadius: 20,
    padding: 3,
    flexShrink: 0,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
  },
  stepperBtnPlus: { background: "#0D9488" },
  stepperBtnText: { fontSize: 17, fontWeight: 800, color: "#0F172A" },
  stepperValue: { fontSize: 13, fontWeight: 800, color: "#0F172A", padding: "0 12px" },

  dutiesBadge: { background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 7px", borderRadius: 10 },
  dutiesBadgeText: { fontSize: 10, fontWeight: 700, color: "#047857" },
  dutiesWrap: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  dutyChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    padding: "6px 9px",
    borderRadius: 10,
    gap: 5,
  },
  dutyChipActive: { background: "#ECFDF5", borderColor: "#0D9488", borderStyle: "solid", borderWidth: 1.5 },
  dutyChipText: { fontSize: 11, color: "#334155", fontWeight: 600 },
  dutyChipTextActive: { color: "#065F46", fontWeight: 800 },

  alertCard: {
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 18,
    padding: 12,
    boxShadow: SHADOWS.small,
  },
  alertHeader: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  alertIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    background: "#D97706",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontSize: 12, fontWeight: 800, color: "#92400E" },
  alertDesc: { fontSize: 10.5, color: "#B45309", marginBottom: 8, lineHeight: "15px" },
  alertTextarea: {
    background: "#FFFFFF",
    border: "1px solid #FDE68A",
    borderRadius: 10,
    padding: 9,
    fontSize: 12,
    color: "#78350F",
    height: 55,
    resize: "none",
    outline: "none",
    width: "100%",
  },

  input: {
    background: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: "10px 12px",
    fontSize: 13,
    color: "#0F172A",
    outline: "none",
    width: "100%",
  },
  textarea: { height: 65, lineHeight: "18px", resize: "none" },
  reqChipsScroll: { display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, overflowX: "auto" },
  reqGoiY: { fontSize: 10.5, fontWeight: 700, color: "#64748B", flexShrink: 0 },
  reqChip: { background: "#F1F5F9", padding: "4px 8px", borderRadius: 8, flexShrink: 0 },
  reqChipText: { fontSize: 11, color: "#475569", fontWeight: 600, whiteSpace: "nowrap" },

  datesContainer: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  dateChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    padding: "6px 10px",
    borderRadius: 10,
    gap: 6,
  },
  dateChipText: { fontSize: 11.5, fontWeight: 700, color: "#065F46" },
  addDateBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    border: "1.5px dashed #0D9488",
    background: "#ECFDF5",
    padding: "6px 12px",
    borderRadius: 10,
    gap: 4,
  },
  addDateBtnText: { fontSize: 11.5, fontWeight: 700, color: "#0D9488" },

  timeGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid #F1F5F9",
  },
  timeCol: { flex: 1 },
  timeLabel: { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 },
  timeInputBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "4px 10px",
    gap: 6,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 700,
    color: "#0F172A",
    padding: "4px 0",
  },
  totalTimeHint: { fontSize: 10.5, color: "#64748B", textAlign: "right", marginTop: 6, fontWeight: 600 },

  rateInputWrap: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1.5px solid #0D9488",
    borderRadius: 12,
    padding: "0 12px",
    marginTop: 4,
  },
  rateInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 17,
    fontWeight: 800,
    color: "#0F172A",
    padding: "8px 0",
  },
  rateSuffix: { fontSize: 11, fontWeight: 700, color: "#0D9488", flexShrink: 0 },
  benchmarkBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  benchmarkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    background: "#10B981",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  benchmarkTitle: { fontSize: 11.5, fontWeight: 800, color: "#065F46" },
  benchmarkDesc: { fontSize: 10.5, color: "#047857", marginTop: 2, lineHeight: "14px" },

  trustBanner: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 0",
  },
  trustBannerText: { fontSize: 11, fontWeight: 600, color: "#065F46", textAlign: "center", padding: "0 8px" },

  bottomDock: {
    background: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    padding: "10px 16px 16px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    boxShadow: SHADOWS.medium,
  },
  dockLeft: { flexShrink: 0 },
  dockSub: { fontSize: 10, color: "#64748B" },
  dockPrice: { fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: "20px" },
  guaranteePill: { display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  guaranteeDot: { width: 5, height: 5, borderRadius: 2.5, background: "#10B981" },
  guaranteeText: { fontSize: 9.5, fontWeight: 700, color: "#047857" },
  dockCtaBtn: {
    flex: 1,
    background: "#0D9488",
    padding: "11px 12px",
    borderRadius: 14,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    boxShadow: SHADOWS.small,
  },
  ctaTitle: { fontSize: 12.5, fontWeight: 800, color: "#FFFFFF" },
};

const ChildcareForm: React.FC = () => {
  const nav = useNav();
  const [ageGroup, setAgeGroup] = useState("6_to_10_years");
  const [numChildren, setNumChildren] = useState("1");
  const [duties, setDuties] = useState<string[]>(["general_care", "feeding", "sleep_monitoring", "play_activities"]);
  const [allergyNotes, setAllergyNotes] = useState("");
  const [requirements, setRequirements] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [timeFrom, setTimeFrom] = useState("08:00");
  const [timeTo, setTimeTo] = useState("17:00");
  const [rate, setRate] = useState("80000");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"searching" | "success" | "error">("searching");
  const [searchError, setSearchError] = useState("");

  const dateInputRef = useRef<HTMLInputElement>(null);

  // RN: DateTimePicker native mở dialog — web: tự bung lịch của <input type="date">
  useEffect(() => {
    if (showDatePicker && dateInputRef.current) {
      try {
        (dateInputRef.current as any).showPicker?.();
      } catch {
        /* trình duyệt không hỗ trợ — user tự bấm */
      }
    }
  }, [showDatePicker]);

  const toggleDuty = (code: string) =>
    setDuties((prev) => (prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]));

  const handleRequirementTag = (tag: string) => {
    if (!requirements.includes(tag)) {
      setRequirements((prev) => (prev.trim() ? `${prev.trim()}, ${tag}` : tag));
    }
  };

  /** RN addDate: chặn ngày quá khứ + thêm vào danh sách (đã sort) */
  const handleDatePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // 'YYYY-MM-DD' — theo múi giờ local, không lệch ngày
    setShowDatePicker(false);
    if (!iso) return;
    const today = getTodayYMD();
    if (iso < today) {
      showAlert("Không hợp lệ", "Không được chọn ngày trong quá khứ.");
      return;
    }
    if (!dates.includes(iso)) setDates([...dates, iso].sort());
  };

  const handleAdjustChildren = (delta: number) => {
    const current = Number(numChildren) || 1;
    const next = Math.max(1, Math.min(5, current + delta));
    setNumChildren(next.toString());
  };

  const submit = async () => {
    if (dates.length === 0) {
      showAlert("Thiếu thông tin", "Vui lòng chọn ít nhất 1 ngày cần đồng hành cùng trẻ.");
      return;
    }
    if (!location) {
      showAlert("Thiếu thông tin", "Vui lòng chọn địa điểm để tìm CarePartner gần nhất.");
      return;
    }

    const finalRequirements =
      requirements.trim() || "Chăm sóc, vui chơi tương tác và đảm bảo an toàn tuyệt đối cho bé.";

    setSubmitting(true);
    setSearchModalVisible(true);
    setSearchStatus("searching");
    setSearchError("");
    let createdJobId: string | number | null = null;
    const searchStartTime = Date.now();
    try {
      const job: any = await createJob({
        job_type: "childcare",
        child_age_group: ageGroup,
        number_of_children: Number(numChildren),
        care_duties: duties,
        medical_allergy_notes: allergyNotes.trim(),
        specific_requirements: finalRequirements,
        dates,
        time_from: timeFrom,
        time_to: timeTo,
        latitude: location.latitude,
        longitude: location.longitude,
        location_note: locationNote || location?.label || "Vị trí đã chọn trên bản đồ",
        hourly_rate_vnd: Number(rate),
      });
      createdJobId = job?.id ?? null;

      const pubRes: any = await publishJob(String(job.id));

      // Tải trước danh sách ứng viên ngay trong lúc modal tìm kiếm đang quét sóng radar
      let matchedCandidates: any = null;
      let totalMatched: any = null;
      let freshJob: any = null;
      try {
        const candRes: any = await getMatchingCandidates(String(job.id));
        matchedCandidates = candRes?.candidates || null;
        totalMatched = candRes?.total_matched || null;
        freshJob = candRes?.job || null;
      } catch (candErr) {
        // Dự phòng demo nếu mạng chậm
      }

      const scheduleStr = `${timeFrom} - ${timeTo} (${dates.length} ngày)`;
      const richJob: Record<string, any> = {
        ...job,
        ...(freshJob || {}),
        title: pubRes?.title || freshJob?.title || job.title || `Trông ${numChildren} bé`,
        category_label: freshJob?.category_label || pubRes?.category_label || "Chăm sóc & Đồng hành cùng trẻ tại nhà",
        category_icon: freshJob?.category_icon || pubRes?.category_icon || "heart",
        hourly_rate_vnd: Number(rate),
        schedule: freshJob?.schedule || pubRes?.schedule || scheduleStr,
        // Defect 2: bỏ hard-code địa bàn mặc định — dùng label reverse-geocoding
        location_note: locationNote || location?.label || "Vị trí đã chọn trên bản đồ",
      };

      // Giữ modal chạy tối thiểu 1.2s để tạo cảm giác quét radar chân thực
      const elapsed = Date.now() - searchStartTime;
      const minDisplayTime = 1200;
      if (elapsed < minDisplayTime) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayTime - elapsed));
      }

      // Đã tìm thấy ứng viên -> thành công
      setSearchStatus("success");

      // Tự động nhảy qua màn hình ứng viên và render ngay lập tức!
      setTimeout(() => {
        setSearchModalVisible(false);
        nav.navigate("CandidatesList", {
          jobId: String(job.id),
          job: richJob,
          candidates: matchedCandidates,
          totalMatched,
        });
      }, 600);
    } catch (err) {
      if (createdJobId) {
        setSearchStatus("success");
        const fallbackSchedule = `${timeFrom} - ${timeTo} (${dates.length} ngày)`;
        const fallbackRichJob: Record<string, any> = {
          id: createdJobId,
          title: `Trông ${numChildren} bé`,
          category_label: "Chăm sóc & Đồng hành cùng trẻ tại nhà",
          category_icon: "heart",
          hourly_rate_vnd: Number(rate),
          schedule: fallbackSchedule,
          location_note: locationNote || location?.label || "Vị trí đã chọn trên bản đồ",
        };
        setTimeout(() => {
          setSearchModalVisible(false);
          nav.navigate("CandidatesList", { jobId: String(createdJobId), job: fallbackRichJob });
        }, 600);
      } else {
        const msg = extractErrorMessage(err, "Không đăng được bài. Vui lòng kiểm tra lại thông tin.");
        setSearchStatus("error");
        setSearchError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Tính tạm tính: (Số giờ ca) x Số ngày x Giá
  const estimatedHours = 9;
  const estimatedDays = Math.max(1, dates.length);
  const estimatedTotal = estimatedHours * (Number(rate) || 80000) * estimatedDays;

  return (
    <div
      style={{
        height: `calc(100dvh - ${TAB_BAR_HEIGHT}px)`,
        background: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{CCF_CSS}</style>

      {/* 1. TOP APP BAR */}
      <div style={S.topBar}>
        <StatusBarSpacer />
        <div style={S.topBarRow}>
          <Touchable
            style={S.circleBtn}
            onPress={() => nav.goBack()}
            hitSlop={10}
          >
            <Icon name="arrow-back" size={20} color="#1E293B" />
          </Touchable>

          <div style={S.titleWrap}>
            <span style={S.topBarTitle}>Đồng hành cùng trẻ tại nhà</span>
            <div style={S.subTitleWrap}>
              <div style={S.dotIndicator} />
              <span style={S.topBarSub}>Bước 1/2 · Chi tiết ca chăm sóc</span>
            </div>
          </div>

          <Touchable
            style={S.circleBtn}
            onPress={() =>
              showAlert(
                "Cam kết an toàn đồng hành cùng trẻ",
                "• 100% CarePartner xác thực CCCD gắn chip & lý lịch tư pháp sạch.\n• Có bảo hiểm hỗ trợ sự cố trong suốt thời gian làm việc.\n• Thanh toán qua ví an toàn, chỉ giải ngân khi phụ huynh xác nhận xong việc."
              )
            }
            hitSlop={10}
          >
            <Icon name="shield-checkmark-outline" size={20} color="#0D9488" />
          </Touchable>
        </div>
      </div>

      {/* 2. SCROLLABLE FORM CONTENT */}
      <div className="edc-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={S.scrollContent}>
          {/* Hero Banner: Warm & Safe Caregiver Intro */}
          <div style={S.heroBanner}>
            <div style={S.heroIconBox}>
              <Icon name="heart" size={24} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={S.heroTitle}>Bảo mẫu &amp; Sinh viên chăm sóc tận tâm</span>
              <div style={S.heroDesc}>
                Đối soát 100% CCCD gắn chip · Có chứng chỉ sơ cấp cứu &amp; kinh nghiệm giữ trẻ chuẩn sư phạm.
              </div>
              <div style={S.heroBadgeRow}>
                <div style={S.heroPill}>
                  <div style={S.heroPillDot} />
                  <span style={S.heroPillText}>Đã kiểm duyệt hồ sơ</span>
                </div>
                <div style={{ ...S.heroPill, background: "rgba(255,255,255,0.8)" }}>
                  <span style={{ ...S.heroPillText, color: "#475569" }}>🛡️ Bảo hiểm sự cố</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: ĐỘ TUỔI CỦA BÉ */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Độ tuổi của trẻ <span style={S.star}>*</span>
              </span>
              <span style={S.helperHint}>Chọn 1 nhóm</span>
            </div>

            <div style={S.ageGrid}>
              {AGE_GROUPS.map((g) => {
                const isActive = ageGroup === g.code;
                return (
                  <Touchable
                    key={g.code}
                    style={{ ...S.ageCard, ...(isActive ? S.ageCardActive : {}) }}
                    onPress={() => setAgeGroup(g.code)}
                    activeOpacity={0.75}
                  >
                    <span style={S.ageIcon}>{g.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...S.ageLabel, ...(isActive ? S.ageLabelActive : {}) }}>{g.label}</div>
                      <div style={{ ...S.ageSub, ...(isActive ? S.ageSubActive : {}) }}>{g.sub}</div>
                    </div>
                    {isActive && <Icon name="checkmark-circle" size={16} color="#0D9488" />}
                  </Touchable>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: SỐ LƯỢNG TRẺ (Stepper Counter) */}
          <div style={S.sectionCard}>
            <div style={S.stepperRow}>
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div style={S.label}>
                  Số lượng trẻ cần chăm sóc <span style={S.star}>*</span>
                </div>
                <div style={S.subHintText}>Từ bé thứ 2: thêm phụ phí 25.000đ/giờ</div>
              </div>

              <div style={S.stepperControl}>
                <Touchable
                  style={S.stepperBtn}
                  onPress={() => handleAdjustChildren(-1)}
                  disabled={Number(numChildren) <= 1}
                >
                  <span style={{ ...S.stepperBtnText, ...(Number(numChildren) <= 1 ? { color: "#CBD5E1" } : {}) }}>−</span>
                </Touchable>
                <span style={S.stepperValue}>{numChildren} bé</span>
                <Touchable style={{ ...S.stepperBtn, ...S.stepperBtnPlus }} onPress={() => handleAdjustChildren(1)}>
                  <span style={{ ...S.stepperBtnText, color: "#FFFFFF" }}>+</span>
                </Touchable>
              </div>
            </div>
          </div>

          {/* SECTION 3: CÔNG VIỆC CẦN CHĂM SÓC (Multi-select) */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Nhiệm vụ chăm sóc <span style={S.star}>*</span>
              </span>
              <div style={S.dutiesBadge}>
                <span style={S.dutiesBadgeText}>Đã chọn {duties.length} việc</span>
              </div>
            </div>
            <div style={S.subHintText}>Chạm để chọn các công việc CarePartner sẽ thực hiện:</div>

            <div style={S.dutiesWrap}>
              {DUTIES.map((d) => {
                const isSelected = duties.includes(d.code);
                return (
                  <Touchable
                    key={d.code}
                    style={{ ...S.dutyChip, ...(isSelected ? S.dutyChipActive : {}) }}
                    onPress={() => toggleDuty(d.code)}
                    activeOpacity={0.7}
                  >
                    <span style={{ fontSize: 13 }}>{d.icon}</span>
                    <span style={{ ...S.dutyChipText, ...(isSelected ? S.dutyChipTextActive : {}) }}>{d.label}</span>
                    {isSelected && <Icon name="checkmark" size={13} color="#0D9488" style={{ marginLeft: 2 }} />}
                  </Touchable>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: LƯU Ý Y TẾ & DỊ ỨNG */}
          <div style={S.alertCard}>
            <div style={S.alertHeader}>
              <div style={S.alertIcon}>
                <Icon name="warning" size={14} color="#FFFFFF" />
              </div>
              <span style={S.alertTitle}>Lưu ý y tế / Dị ứng của bé (Rất quan trọng)</span>
            </div>
            <div style={S.alertDesc}>
              Giúp người chăm sóc phòng tránh sự cố và xử lý kịp thời khi có dấu hiệu bất thường.
            </div>
            <textarea
              className="ccf-ph-amber"
              style={S.alertTextarea}
              placeholder="VD: Bé bị dị ứng đạm sữa bò, không ăn hải sản. Uống siro ho thảo dược 5ml sau bữa trưa lúc 12h30..."
              value={allergyNotes}
              onChange={(e) => setAllergyNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* SECTION 5: YÊU CẦU CỤ THỂ VỚI BẢO MẪU */}
          <div style={S.sectionCard}>
            <div style={S.label}>
              Yêu cầu chi tiết đối với người đồng hành cùng trẻ <span style={S.star}>*</span>
            </div>
            <textarea
              className="ccf-ph-slate"
              style={{ ...S.input, ...S.textarea, marginTop: 0 }}
              placeholder="VD: Cần người dịu dàng, kiên nhẫn, không cho bé xem điện thoại nhiều, chủ động báo cáo ảnh qua app..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={2}
            />

            <div className="edc-scroll" style={S.reqChipsScroll}>
              <span style={S.reqGoiY}>Gợi ý:</span>
              {QUICK_REQUIREMENTS.map((r, idx) => (
                <Touchable key={idx} style={S.reqChip} onPress={() => handleRequirementTag(r)}>
                  <span style={S.reqChipText}>+ {r}</span>
                </Touchable>
              ))}
            </div>
          </div>

          {/* SECTION 6: LỊCH TRÔNG & THỜI GIAN */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Lịch làm việc &amp; Thời gian <span style={S.star}>*</span>
              </span>
              <span style={{ ...S.helperHint, color: "#0D9488", fontWeight: 700 }}>
                {dates.length > 0 ? `${dates.length} ngày đã chọn` : "Chưa chọn ngày"}
              </span>
            </div>

            <div style={S.datesContainer}>
              {dates.map((d) => (
                <div key={d} style={S.dateChip}>
                  <Icon name="calendar-outline" size={13} color="#0D9488" />
                  <span style={S.dateChipText}>{d}</span>
                  <Touchable onPress={() => setDates(dates.filter((x) => x !== d))}>
                    <Icon name="close" size={14} color="#0D9488" />
                  </Touchable>
                </div>
              ))}

              <Touchable style={S.addDateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                <Icon name="add" size={15} color="#0D9488" />
                <span style={S.addDateBtnText}>Thêm ngày</span>
              </Touchable>
            </div>

            {showDatePicker && (
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div style={{ ...S.timeInputBox, flex: 1 }}>
                  <Icon name="calendar-outline" size={16} color="#0D9488" />
                  <input
                    ref={dateInputRef}
                    type="date"
                    min={getTodayYMD()}
                    onChange={handleDatePicked}
                    className="ccf-date-input"
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#0F172A", padding: "4px 0" }}
                  />
                </div>
                <Touchable onPress={() => setShowDatePicker(false)} hitSlop={8} style={{ padding: 6 }}>
                  <Icon name="close-circle" size={18} color="#94A3B8" />
                </Touchable>
              </div>
            )}

            {/* Time Slot Row */}
            <div style={S.timeGrid}>
              <div style={S.timeCol}>
                <span style={S.timeLabel}>Bắt đầu từ</span>
                <div style={S.timeInputBox}>
                  <Icon name="time-outline" size={16} color="#94A3B8" />
                  <input
                    className="ccf-ph-slate"
                    style={S.timeInput}
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    placeholder="08:00"
                  />
                </div>
              </div>

              <div style={S.timeCol}>
                <span style={S.timeLabel}>Kết thúc lúc</span>
                <div style={S.timeInputBox}>
                  <Icon name="time-outline" size={16} color="#94A3B8" />
                  <input
                    className="ccf-ph-slate"
                    style={S.timeInput}
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    placeholder="17:00"
                  />
                </div>
              </div>
            </div>
            <div style={S.totalTimeHint}>⏱ Tổng thời lượng: 9 giờ / ngày (ca ngày)</div>
          </div>

          {/* SECTION 7: MỨC PHÍ ĐỀ XUẤT */}
          <div style={S.sectionCard}>
            <div style={S.label}>
              Mức phí đề xuất / giờ (VNĐ) <span style={S.star}>*</span>
            </div>

            <div style={S.rateInputWrap}>
              <input
                className="ccf-ph-slate"
                style={S.rateInput}
                placeholder="80000"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="numeric"
              />
              <span style={S.rateSuffix}>VNĐ / giờ</span>
            </div>

            <div style={S.benchmarkBox}>
              <div style={S.benchmarkIcon}>
                <span style={{ fontSize: 11, color: "#FFFFFF", fontWeight: 800 }}>✓</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.benchmarkTitle}>Mức phí rất hợp lý &amp; thu hút</div>
                <div style={S.benchmarkDesc}>
                  Khung thị trường: 60.000đ – 95.000đ/giờ. Dự kiến nhận được 3-5 ứng viên phản hồi trong 15 phút.
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 8: ĐỊA ĐIỂM TRÔNG BÉ */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Địa điểm đồng hành <span style={S.star}>*</span>
              </span>
              <span style={S.helperHint}>Nhà riêng</span>
            </div>

            <JobLocationPicker value={location} onChange={setLocation} />

            <div style={{ marginTop: 10 }}>
              <div style={S.subHintText}>Chi tiết căn hộ / số nhà:</div>
              <input
                className="ccf-ph-slate"
                style={S.input}
                placeholder="VD: Căn 12.04, Tháp A, Chung cư Florita, Q.7..."
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
              />
            </div>
          </div>

          {/* Trust Footer Micro-Banner */}
          <div style={S.trustBanner}>
            <Icon name="shield-checkmark" size={15} color="#0D9488" />
            <span style={S.trustBannerText}>
              Thanh toán an toàn qua VietQR/MoMo · Chỉ trả tiền khi phụ huynh xác nhận xong việc
            </span>
          </div>
        </div>
      </div>

      {/* 3. STICKY BOTTOM ACTION DOCK */}
      <div style={S.bottomDock}>
        <div style={S.dockLeft}>
          <div style={S.dockSub}>Tạm tính (9h × {estimatedDays} ngày):</div>
          <div style={S.dockPrice}>
            ~{estimatedTotal.toLocaleString("vi-VN")}
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0D9488" }}>đ</span>
          </div>
          <div style={S.guaranteePill}>
            <div style={S.guaranteeDot} />
            <span style={S.guaranteeText}>Giữ cọc ví an toàn</span>
          </div>
        </div>

        <Touchable
          style={{ ...S.dockCtaBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          <span style={S.ctaTitle}>{submitting ? "Đang đăng..." : "Đăng việc & Tìm CarePartner"}</span>
          <Icon name="arrow-forward" size={16} color="#FFFFFF" />
        </Touchable>
      </div>

      {/* Bottom Sheet Animation: Đang tìm kiếm CarePartner */}
      <SearchingCarePartnerModal
        visible={searchModalVisible}
        status={searchStatus}
        serviceType="Đồng hành cùng trẻ tại nhà"
        serviceIcon="heart"
        errorMessage={searchError}
        onClose={() => setSearchModalVisible(false)}
      />
    </div>
  );
};

export default ChildcareForm;
