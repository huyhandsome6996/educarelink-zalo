/**
 * PickupForm — port CHÍNH XÁC mobile/src/screens/Parent/PickupForm.js (1499 dòng).
 * Flow 1 Step 1 §C: Đăng việc ĐÓN TRẺ TAN HỌC.
 * Toàn bộ sections 1-7 giữ nguyên thứ tự + text + màu hardcode (#2563EB blue) từ RN:
 *   Top bar (back · title · badge "Live GPS") → Hero banner xanh "CÔNG NGHỆ ĐỘC QUYỀN" →
 *   1 Tên trường / địa điểm đón (searchRow + clear + 4 quick chips kiểu trường) →
 *   2 Độ tuổi của bé & Số lượng (age pills + verifyPill + stepper 1..2) →
 *   3 SƠ ĐỒ LỘ TRÌNH ĐƯA ĐÓN (A → B): timeline chấm A xanh/Điểm đón (JobLocationPicker +
 *   ghi chú đón) — B xanh lá/Điểm đến (toggle "Về nhà"/"Lớp học thêm", picker khi chọn
 *   địa chỉ khác, ghi chú bàn giao) + đường nét đứt + icon xe + badge ~2.8km +
 *   mapReadySnippet "📍 Bản đồ định vị GPS trực tuyến sẵn sàng" →
 *   4 Ngày đón & Khung giờ tan học (date chips + timeFrom/timeTo) →
 *   5 Phương tiện di chuyển (3 transport card: xe máy/đi bộ/xe gia đình + radio + badge) →
 *   6 Yêu cầu an toàn cụ thể (4 safety tag chips ✓/+ + textarea) →
 *   7 Mức phí đề xuất (benchmarkBadge "Khung chuẩn 50-80k" + benchmark box) →
 *   Sticky bottom dock (tạm tính ca đón / N bé + "Live GPS tự động kích hoạt").
 * Submit nguyên bản RN flow: createJob({job_type:'pickup',...pickup_location/
 *   destination_location/transport_method...}) → publishJob → getMatchingCandidates
 *   (preload, lỗi bỏ qua) → richJob → giữ modal ≥1.2s → success → 600ms →
 *   navigate('CandidatesList', {jobId, job, candidates, totalMatched});
 *   nếu publish/candidates fail mà đã tạo job → fallback richJob vẫn sang CandidatesList;
 *   chưa tạo được job → searchStatus 'error' + extractErrorMessage.
 * Validation nguyên bản RN: tên trường, độ tuổi, ≥1 ngày, điểm đón, điểm đến (nếu
 *   "Lớp học thêm"), rate > 0.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - JobLocationPicker (Leaflet WebView + MapPickerModal) → web: ô tìm địa chỉ
 *   (geocode /matching/geocode/search + Nominatim fallback) + nút "Dùng vị trí hiện tại"
 *   (expo-location → navigator.geolocation). RN web cũng rơi vào fallbackBox không map.
 * - @react-native-community/datetimepicker (web RN: KHÔNG render) → <input type="date">
 *   native, min = hôm nay, chọn xong tự đóng, giữ chặn ngày quá khứ.
 * - Alert.alert → showAlert; Animated spring/loop → CSS keyframes (pkf*).
 * - Icon thiếu glyph trong bộ 159 (business-outline, bicycle-outline, walk-outline,
 *   close-circle-outline, alert, checkmark-done) → glyph gần nhất cùng nghĩa (ic()).
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
  { code: "6_to_10_years", label: "6 - 10 tuổi", sub: "Tiểu học" },
  { code: "over_10_years", label: "Trên 10 tuổi", sub: "Cấp 2" },
];

const TRANSPORT_METHODS = [
  {
    code: "carepartner_vehicle",
    label: "CarePartner có xe máy riêng",
    sub: "Yêu cầu: Bằng lái A1 + Mũ bảo hiểm trẻ em chuẩn",
    badge: "Ưu tiên cốp xe rộng · Đã đối soát GPLX",
    icon: "bicycle-outline",
  },
  {
    code: "walking",
    label: "Đi bộ (Khoảng cách dưới 800m)",
    sub: "Dắt tay bé qua đường, trường gần khu dân cư",
    badge: "An toàn đi bộ",
    icon: "walk-outline",
  },
  {
    code: "parent_arranged",
    label: "Phụ huynh đặt xe / Xe gia đình",
    sub: "CarePartner đi kèm cùng bé trên xe GrabCar hoặc xe riêng",
    badge: "Kèm xe ô tô",
    icon: "car-outline",
  },
];

const QUICK_SCHOOL_TYPES = [
  "🏫 Tiểu học",
  "🧸 Mầm non",
  "🇬🇧 TT Tiếng Anh",
  "🥋 Lớp năng khiếu",
];

const QUICK_SAFETY_TAGS = [
  "Chụp ảnh check-in cổng trường",
  "Gọi điện khi về tới nhà",
  "Dắt tay qua đường",
  "Đội mũ bảo hiểm riêng của bé",
];

/* ---------- Icon fallback (bộ 159 glyph thiếu vài outline) ---------- */
const ICON_FALLBACKS: Record<string, string> = {
  "business-outline": "business",
  "bicycle-outline": "speedometer-outline",
  "walk-outline": "walk",
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
const PKF_CSS = `
@keyframes pkfRipple { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
@keyframes pkfSheetUp { from { transform: translateY(60%); opacity: 0.4; } to { transform: translateY(0); opacity: 1; } }
@keyframes pkfFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pkfSuccessPop { 0% { transform: scale(0); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }
.pkf-ph-slate::placeholder { color: #94A3B8; }
.pkf-date-input { appearance: auto; -webkit-appearance: auto; }
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
        <Icon name="search" size={17} color="#94A3B8" style={{ marginLeft: 4 }} />
        <input
          className="pkf-ph-slate"
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
      <div style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.65)", animation: "pkfFade 0.25s" }} />

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
          animation: "pkfSheetUp 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
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
                    animation: "pkfRipple 1.6s linear infinite",
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
                animation: "pkfSuccessPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
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
 * PickupForm — thân màn hình (nguyên văn RN styles 1:1)
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
  dotIndicator: { width: 6, height: 6, borderRadius: 3, background: "#2563EB" },
  topBarSub: { fontSize: 11, fontWeight: 600, color: "#2563EB" },
  liveGpsBadge: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    padding: "3px 7px",
    borderRadius: 12,
    flexShrink: 0,
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, background: "#2563EB" },
  liveGpsText: { fontSize: 10, fontWeight: 800, color: "#1D4ED8" },

  scrollContent: { padding: "12px 16px 120px", display: "flex", flexDirection: "column", gap: 12 },
  heroBanner: {
    background: "#2563EB",
    borderRadius: 18,
    padding: 14,
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
    background: "rgba(255, 255, 255, 0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroTag: {
    background: "rgba(255, 255, 255, 0.25)",
    padding: "2px 6px",
    borderRadius: 4,
    alignSelf: "flex-start",
    display: "flex",
  },
  heroTagText: { fontSize: 9.5, fontWeight: 800, color: "#FFFFFF", letterSpacing: 0.5 },
  heroTitle: { fontSize: 13.5, fontWeight: 800, color: "#FFFFFF", marginTop: 3 },
  heroDesc: { fontSize: 11, color: "#DBEAFE", marginTop: 2, lineHeight: "16px" },

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
  subHintText: { fontSize: 11, color: "#64748B", marginTop: 2 },

  searchRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "4px 12px",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 13,
    color: "#0F172A",
    padding: "6px 0",
  },
  chipsScroll: { display: "flex", flexDirection: "row", gap: 6, padding: "4px 0", marginTop: 4, overflowX: "auto" },
  quickChip: {
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    padding: "5px 10px",
    borderRadius: 10,
    flexShrink: 0,
  },
  quickChipText: { fontSize: 11, color: "#1D4ED8", fontWeight: 600, whiteSpace: "nowrap" },

  verifyPill: { background: "#ECFDF5", padding: "2px 6px", borderRadius: 10, flexShrink: 0 },
  verifyPillText: { fontSize: 9.5, fontWeight: 700, color: "#047857" },
  ageRow: { display: "flex", flexDirection: "row", gap: 8, marginTop: 2 },
  agePill: {
    flex: 1,
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "8px 6px",
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  agePillActive: { background: "#EFF6FF", borderColor: "#2563EB", borderStyle: "solid", borderWidth: 1.5 },
  agePillTitle: { fontSize: 11.5, fontWeight: 700, color: "#0F172A" },
  agePillTitleActive: { color: "#1D4ED8" },
  agePillSub: { fontSize: 9.5, color: "#64748B", marginTop: 1 },
  agePillSubActive: { color: "#2563EB", fontWeight: 600 },
  ageCheckBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    background: "#2563EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  stepperRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #F1F5F9",
  },
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
    width: 30,
    height: 30,
    borderRadius: 15,
    background: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.small,
  },
  stepperBtnPlus: { background: "#2563EB" },
  stepperBtnText: { fontSize: 16, fontWeight: 800, color: "#0F172A" },
  stepperValue: { fontSize: 12.5, fontWeight: 800, color: "#0F172A", padding: "0 10px" },

  // Route Visual Centerpiece
  routeCard: {
    background: "#FFFFFF",
    borderRadius: 18,
    border: "1.5px solid #BFDBFE",
    padding: 14,
    boxShadow: SHADOWS.small,
  },
  routeIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: "#EFF6FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  routeHeaderTitle: { fontSize: 11, fontWeight: 800, color: "#0F172A", letterSpacing: 0.3 },
  distanceBadge: { background: "#EFF6FF", padding: "2px 7px", borderRadius: 10, flexShrink: 0 },
  distanceBadgeText: { fontSize: 10.5, fontWeight: 800, color: "#2563EB" },
  routeTimelineWrap: { position: "relative", paddingLeft: 22, marginTop: 8 },
  timelineDottedLine: {
    position: "absolute",
    left: 8,
    top: 14,
    bottom: 24,
    width: 0,
    borderLeft: "1.5px dashed #60A5FA",
  },
  timelineVehicleIcon: {
    position: "absolute",
    left: -1,
    top: "48%",
    width: 20,
    height: 20,
    borderRadius: 10,
    background: "#2563EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  routePointBox: { position: "relative" },
  pointDotA: {
    position: "absolute",
    left: -22,
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    background: "#2563EB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pointDotB: {
    position: "absolute",
    left: -22,
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    background: "#10B981",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pointDotText: { fontSize: 10, fontWeight: 900, color: "#FFFFFF" },
  pointHeaderRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pointLabelA: { fontSize: 10.5, fontWeight: 800, color: "#2563EB", letterSpacing: 0.3 },
  pointLabelB: { fontSize: 10.5, fontWeight: 800, color: "#059669", letterSpacing: 0.3 },
  pointSubHint: { fontSize: 10, color: "#64748B" },
  destToggleWrap: { display: "flex", flexDirection: "row", background: "#F1F5F9", padding: 2, borderRadius: 6, gap: 2 },
  destToggleBtn: { padding: "2px 6px", borderRadius: 4 },
  destToggleBtnActive: { background: "#FFFFFF", boxShadow: SHADOWS.small },
  destToggleText: { fontSize: 9.5, fontWeight: 600, color: "#64748B" },
  destToggleTextActive: { color: "#0F172A", fontWeight: 800 },
  mapReadySnippet: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#EFF6FF",
    borderRadius: 10,
    padding: "6px 10px",
    marginTop: 12,
    gap: 6,
  },
  pulseDotBlue: { width: 6, height: 6, borderRadius: 3, background: "#2563EB" },
  mapReadyText: { fontSize: 10.5, fontWeight: 700, color: "#1D4ED8" },

  datesContainer: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  dateChip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#EFF6FF",
    border: "1px solid #BFDBFE",
    padding: "6px 10px",
    borderRadius: 10,
    gap: 6,
  },
  dateChipText: { fontSize: 11.5, fontWeight: 700, color: "#1D4ED8" },
  addDateBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    border: "1.5px dashed #2563EB",
    background: "#EFF6FF",
    padding: "6px 12px",
    borderRadius: 10,
    gap: 4,
  },
  addDateBtnText: { fontSize: 11.5, fontWeight: 700, color: "#2563EB" },

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

  // Transport Methods
  transportCard: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: 10,
  },
  transportCardActive: { background: "#EFF6FF", borderColor: "#2563EB", borderStyle: "solid", borderWidth: 1.5 },
  transportTitle: { fontSize: 12, fontWeight: 700, color: "#0F172A" },
  transportTitleActive: { color: "#1D4ED8" },
  transportSub: { fontSize: 10.5, color: "#64748B", marginTop: 2, lineHeight: "14px" },
  transportBadge: {
    alignSelf: "flex-start",
    display: "flex",
    background: "#DBEAFE",
    padding: "1.5px 6px",
    borderRadius: 4,
    marginTop: 4,
  },
  transportBadgeText: { fontSize: 9.5, fontWeight: 700, color: "#1E40AF" },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    border: "1.5px solid #CBD5E1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  radioCircleActive: { borderColor: "#2563EB" },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, background: "#2563EB" },

  // Requirements / Safety tags
  tagWrap: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  tagChip: {
    background: "#F1F5F9",
    padding: "4px 8px",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
  },
  tagChipActive: { background: "#ECFDF5", borderColor: "#A7F3D0" },
  tagChipText: { fontSize: 10.5, fontWeight: 600, color: "#475569" },
  tagChipTextActive: { color: "#065F46", fontWeight: 700 },

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

  // Rate
  rateInputWrap: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1.5px solid #2563EB",
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
  rateSuffix: { fontSize: 11, fontWeight: 700, color: "#2563EB", flexShrink: 0 },
  benchmarkBadge: { background: "#EFF6FF", padding: "2px 6px", borderRadius: 10, flexShrink: 0 },
  benchmarkBadgeText: { fontSize: 9.5, fontWeight: 700, color: "#1D4ED8" },
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

  // 3. STICKY BOTTOM DOCK
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
  guaranteeDot: { width: 5, height: 5, borderRadius: 2.5, background: "#2563EB" },
  guaranteeText: { fontSize: 9.5, fontWeight: 700, color: "#2563EB" },
  dockCtaBtn: {
    flex: 1,
    background: "#2563EB",
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

const PickupForm: React.FC = () => {
  const nav = useNav();
  const [schoolName, setSchoolName] = useState("");
  const [ageGroup, setAgeGroup] = useState("6_to_10_years");
  const [numChildren, setNumChildren] = useState("1");
  const [dates, setDates] = useState<string[]>([]);
  const [timeFrom, setTimeFrom] = useState("16:30");
  const [timeTo, setTimeTo] = useState("17:30");
  const [pickupLocation, setPickupLocation] = useState<LocationValue | null>(null);
  const [pickupNote, setPickupNote] = useState("");
  const [destType, setDestType] = useState("parent_home");
  const [destLocation, setDestLocation] = useState<LocationValue | null>(null);
  const [destNote, setDestNote] = useState("");
  const [transportMethod, setTransportMethod] = useState("carepartner_vehicle");
  const [transportNote, setTransportNote] = useState("");
  const [requirements, setRequirements] = useState("");
  const [rate, setRate] = useState("60000");
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
    const next = Math.max(1, Math.min(2, current + delta));
    setNumChildren(next.toString());
  };

  const handleSafetyTagToggle = (tag: string) => {
    if (!requirements.includes(tag)) {
      setRequirements((prev) => (prev.trim() ? `${prev.trim()}, ${tag}` : tag));
    }
  };

  const submit = async () => {
    if (!schoolName.trim()) {
      showAlert("Thiếu thông tin", "Vui lòng nhập tên trường hoặc địa điểm đón.");
      return;
    }
    if (!ageGroup) {
      showAlert("Thiếu thông tin", "Vui lòng chọn độ tuổi của trẻ.");
      return;
    }
    if (dates.length === 0) {
      showAlert("Thiếu thông tin", "Vui lòng chọn ít nhất 1 ngày đón.");
      return;
    }
    if (!pickupLocation) {
      showAlert("Thiếu thông tin", "Vui lòng chọn điểm đón trên bản đồ.");
      return;
    }
    if (destType === "other_address" && !destLocation) {
      showAlert("Thiếu thông tin", "Vui lòng chọn điểm đến trên bản đồ (địa chỉ khác).");
      return;
    }
    if (!rate || Number(rate) <= 0) {
      showAlert("Thiếu thông tin", "Nhập mức phí đề xuất hợp lệ.");
      return;
    }

    const finalRequirements =
      requirements.trim() || "Đưa đón bé đúng giờ, đội mũ bảo hiểm và đảm bảo an toàn giao thông.";

    setSubmitting(true);
    setSearchModalVisible(true);
    setSearchStatus("searching");
    setSearchError("");
    let createdJobId: string | number | null = null;
    const searchStartTime = Date.now();
    try {
      const job: any = await createJob({
        job_type: "pickup",
        school_or_pickup_place_name: schoolName.trim(),
        child_age_group: ageGroup,
        number_of_children: Number(numChildren),
        pickup_dates: dates,
        pickup_time_from: timeFrom,
        pickup_time_to: timeTo,
        pickup_location: pickupLocation,
        pickup_location_note: pickupNote,
        destination_type: destType,
        destination_location: destType === "other_address" ? destLocation : null,
        destination_note: destNote,
        transport_method: transportMethod || undefined,
        transport_note: transportNote,
        specific_requirements: finalRequirements,
        // vị trí chính = điểm đón
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
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
        title:
          pubRes?.title ||
          freshJob?.title ||
          job.title ||
          `Đón ${numChildren} bé tại ${schoolName.trim() || "trường"}`,
        category_label: freshJob?.category_label || pubRes?.category_label || "Đưa đón trẻ an toàn",
        category_icon: freshJob?.category_icon || pubRes?.category_icon || "car",
        hourly_rate_vnd: Number(rate),
        schedule: freshJob?.schedule || pubRes?.schedule || scheduleStr,
        location_note: pickupNote || schoolName.trim() || pickupLocation?.label || "Vị trí đã chọn trên bản đồ",
      };

      // Giữ modal chạy tối thiểu 1.2s để tạo cảm giác quét radar chân thực
      const elapsed = Date.now() - searchStartTime;
      const minDisplayTime = 1200;
      if (elapsed < minDisplayTime) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayTime - elapsed));
      }

      // Đã tìm thấy ứng viên -> thành công
      setSearchStatus("success");

      // Tự động chuyển tiếp đến danh sách ứng viên và render ngay lập tức!
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
          title: `Đón ${numChildren} bé tại ${schoolName.trim() || "trường"}`,
          category_label: "Đưa đón trẻ an toàn",
          category_icon: "car",
          hourly_rate_vnd: Number(rate),
          schedule: fallbackSchedule,
          location_note: pickupNote || schoolName.trim() || pickupLocation?.label || "Vị trí đã chọn trên bản đồ",
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
      <style>{PKF_CSS}</style>

      {/* 1. TOP APP BAR */}
      <div style={S.topBar}>
        <StatusBarSpacer />
        <div style={S.topBarRow}>
          <Touchable style={S.circleBtn} onPress={() => nav.goBack()} hitSlop={10}>
            <Icon name="arrow-back" size={20} color="#1E293B" />
          </Touchable>

          <div style={S.titleWrap}>
            <span style={S.topBarTitle}>Đón trẻ tan học</span>
            <div style={S.subTitleWrap}>
              <div style={S.dotIndicator} />
              <span style={S.topBarSub}>Bước 1/2 · Lộ trình đưa đón an toàn</span>
            </div>
          </div>

          <div style={S.liveGpsBadge}>
            <div style={S.pulseDot} />
            <span style={S.liveGpsText}>Live GPS</span>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT */}
      <div className="edc-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={S.scrollContent}>
          {/* Hero Mobility Banner */}
          <div style={S.heroBanner}>
            <div style={S.heroIconBox}>
              <Icon name="car" size={24} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.heroTag}>
                <span style={S.heroTagText}>CÔNG NGHỆ ĐỘC QUYỀN</span>
              </div>
              <div style={S.heroTitle}>Đón bé an tâm với Live GPS 24/7</div>
              <div style={S.heroDesc}>
                Check-in ảnh chụp bé tại cổng trường &amp; bảo hiểm tai nạn di chuyển 100%.
              </div>
            </div>
          </div>

          {/* SECTION 1: TÊN TRƯỜNG / ĐỊA ĐIỂM ĐÓN */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Tên trường / Địa điểm đón bé <span style={S.star}>*</span>
              </span>
              <span style={S.helperHint}>Gợi ý nhanh</span>
            </div>

            <div style={S.searchRow}>
              <Icon name={ic("business-outline")} size={16} color="#2563EB" style={{ marginRight: 8 }} />
              <input
                className="pkf-ph-slate"
                style={S.searchInput}
                placeholder="VD: Tiểu học Chu Văn An, Thực Nghiệm..."
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
              {!!schoolName && (
                <Touchable onPress={() => setSchoolName("")}>
                  <Icon name="close-circle" size={16} color="#94A3B8" />
                </Touchable>
              )}
            </div>

            <div className="edc-scroll" style={S.chipsScroll}>
              {QUICK_SCHOOL_TYPES.map((type, idx) => (
                <Touchable
                  key={idx}
                  style={S.quickChip}
                  onPress={() => {
                    const clean = type.replace(/^[^\w\s]*\s*/, "");
                    setSchoolName((prev) => (prev ? `${prev} - ${clean}` : clean));
                  }}
                >
                  <span style={S.quickChipText}>{type}</span>
                </Touchable>
              ))}
            </div>
          </div>

          {/* SECTION 2: ĐỘ TUỔI & SỐ LƯỢNG BÉ */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>Độ tuổi của bé &amp; Số lượng</span>
              <div style={S.verifyPill}>
                <span style={S.verifyPillText}>✓ Tự trang bị mũ BH</span>
              </div>
            </div>

            <div style={S.ageRow}>
              {AGE_GROUPS.map((g) => {
                const isSelected = ageGroup === g.code;
                return (
                  <Touchable
                    key={g.code}
                    style={{ ...S.agePill, ...(isSelected ? S.agePillActive : {}) }}
                    onPress={() => setAgeGroup(g.code)}
                    activeOpacity={0.8}
                  >
                    <span style={{ ...S.agePillTitle, ...(isSelected ? S.agePillTitleActive : {}) }}>{g.label}</span>
                    <span style={{ ...S.agePillSub, ...(isSelected ? S.agePillSubActive : {}) }}>{g.sub}</span>
                    {isSelected && (
                      <div style={S.ageCheckBadge}>
                        <Icon name="checkmark" size={10} color="#FFFFFF" />
                      </div>
                    )}
                  </Touchable>
                );
              })}
            </div>

            <div style={S.stepperRow}>
              <div>
                <span style={S.label}>Số lượng trẻ cần đón</span>
                <div style={S.subHintText}>Tối đa 2 bé nếu di chuyển xe máy</div>
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

          {/* SECTION 3: SƠ ĐỒ LỘ TRÌNH ĐƯA ĐÓN (A → B) */}
          <div style={S.routeCard}>
            <div style={S.sectionHeaderRow}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                <div style={S.routeIconBox}>
                  <Icon name="navigate-outline" size={16} color="#2563EB" />
                </div>
                <span style={S.routeHeaderTitle}>SƠ ĐỒ LỘ TRÌNH ĐƯA ĐÓN (A → B)</span>
              </div>
              <div style={S.distanceBadge}>
                <span style={S.distanceBadgeText}>~2.8 km</span>
              </div>
            </div>

            {/* Sơ đồ nối A -> B */}
            <div style={S.routeTimelineWrap}>
              {/* Dotted vertical line with transport car icon */}
              <div style={S.timelineDottedLine} />
              <div style={S.timelineVehicleIcon}>
                <Icon name="car" size={11} color="#FFFFFF" />
              </div>

              {/* POINT A: ĐIỂM ĐÓN */}
              <div style={S.routePointBox}>
                <div style={S.pointDotA}>
                  <span style={S.pointDotText}>A</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.pointHeaderRow}>
                    <span style={S.pointLabelA}>ĐIỂM ĐÓN (A)</span>
                    <span style={S.pointSubHint}>Cổng trường</span>
                  </div>

                  <JobLocationPicker value={pickupLocation} onChange={setPickupLocation} />

                  <input
                    className="pkf-ph-slate"
                    style={{ ...S.input, marginTop: 6 }}
                    placeholder="Ghi chú đón: Cổng bảo vệ, phòng học, giáo viên phụ trách..."
                    value={pickupNote}
                    onChange={(e) => setPickupNote(e.target.value)}
                  />
                </div>
              </div>

              {/* POINT B: ĐIỂM ĐẾN */}
              <div style={{ ...S.routePointBox, marginTop: 14 }}>
                <div style={S.pointDotB}>
                  <span style={S.pointDotText}>B</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.pointHeaderRow}>
                    <span style={S.pointLabelB}>ĐIỂM ĐẾN (B)</span>
                    {/* Dest type toggle */}
                    <div style={S.destToggleWrap}>
                      <Touchable
                        style={{ ...S.destToggleBtn, ...(destType === "parent_home" ? S.destToggleBtnActive : {}) }}
                        onPress={() => setDestType("parent_home")}
                      >
                        <span
                          style={{
                            ...S.destToggleText,
                            ...(destType === "parent_home" ? S.destToggleTextActive : {}),
                          }}
                        >
                          Về nhà
                        </span>
                      </Touchable>
                      <Touchable
                        style={{ ...S.destToggleBtn, ...(destType === "other_address" ? S.destToggleBtnActive : {}) }}
                        onPress={() => setDestType("other_address")}
                      >
                        <span
                          style={{
                            ...S.destToggleText,
                            ...(destType === "other_address" ? S.destToggleTextActive : {}),
                          }}
                        >
                          Lớp học thêm
                        </span>
                      </Touchable>
                    </div>
                  </div>

                  {destType === "other_address" && (
                    <div style={{ marginBottom: 6 }}>
                      <JobLocationPicker value={destLocation} onChange={setDestLocation} />
                    </div>
                  )}

                  <input
                    className="pkf-ph-slate"
                    style={S.input}
                    placeholder="Ghi chú bàn giao: Bàn giao cho bà ngoại P.1408 Tháp B, hoặc gọi mẹ..."
                    value={destNote}
                    onChange={(e) => setDestNote(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Mini map ready snippet */}
            <div style={S.mapReadySnippet}>
              <div style={S.pulseDotBlue} />
              <span style={S.mapReadyText}>📍 Bản đồ định vị GPS trực tuyến sẵn sàng</span>
            </div>
          </div>

          {/* SECTION 4: THỜI GIAN & KHUNG GIỜ ĐÓN */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Ngày đón &amp; Khung giờ tan học <span style={S.star}>*</span>
              </span>
            </div>

            <div style={S.datesContainer}>
              {dates.map((d) => (
                <div key={d} style={S.dateChip}>
                  <Icon name="calendar-outline" size={13} color="#2563EB" />
                  <span style={S.dateChipText}>{d}</span>
                  <Touchable onPress={() => setDates(dates.filter((x) => x !== d))}>
                    <Icon name="close" size={14} color="#2563EB" />
                  </Touchable>
                </div>
              ))}

              <Touchable style={S.addDateBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
                <Icon name="add" size={15} color="#2563EB" />
                <span style={S.addDateBtnText}>+ Thêm ngày</span>
              </Touchable>
            </div>

            {showDatePicker && (
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <div style={{ ...S.timeInputBox, flex: 1 }}>
                  <Icon name="calendar-outline" size={16} color="#2563EB" />
                  <input
                    ref={dateInputRef}
                    type="date"
                    min={getTodayYMD()}
                    onChange={handleDatePicked}
                    className="pkf-date-input"
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#0F172A", padding: "4px 0" }}
                  />
                </div>
                <Touchable onPress={() => setShowDatePicker(false)} hitSlop={8} style={{ padding: 6 }}>
                  <Icon name="close-circle" size={18} color="#94A3B8" />
                </Touchable>
              </div>
            )}

            {/* Time Window */}
            <div style={S.timeGrid}>
              <div style={S.timeCol}>
                <span style={S.timeLabel}>Giờ tan học (đón từ)</span>
                <div style={S.timeInputBox}>
                  <Icon name="time-outline" size={16} color="#94A3B8" />
                  <input
                    className="pkf-ph-slate"
                    style={S.timeInput}
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    placeholder="16:30"
                  />
                </div>
              </div>

              <div style={S.timeCol}>
                <span style={S.timeLabel}>Bàn giao trước</span>
                <div style={S.timeInputBox}>
                  <Icon name="time-outline" size={16} color="#94A3B8" />
                  <input
                    className="pkf-ph-slate"
                    style={S.timeInput}
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    placeholder="17:30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: PHƯƠNG TIỆN ĐƯA ĐÓN */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Phương tiện di chuyển <span style={S.star}>*</span>
              </span>
              <span style={S.helperHint}>Bắt buộc có mũ BH</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {TRANSPORT_METHODS.map((t) => {
                const isSelected = transportMethod === t.code;
                return (
                  <Touchable
                    key={t.code}
                    style={{ ...S.transportCard, ...(isSelected ? S.transportCardActive : {}) }}
                    onPress={() => setTransportMethod(t.code)}
                    activeOpacity={0.8}
                  >
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                      <Icon
                        name={ic(t.icon)}
                        size={24}
                        color={isSelected ? "#2563EB" : "#64748B"}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...S.transportTitle, ...(isSelected ? S.transportTitleActive : {}) }}>{t.label}</div>
                        <div style={S.transportSub}>{t.sub}</div>
                        <div style={S.transportBadge}>
                          <span style={S.transportBadgeText}>{t.badge}</span>
                        </div>
                      </div>
                      <div style={{ ...S.radioCircle, ...(isSelected ? S.radioCircleActive : {}) }}>
                        {isSelected && <div style={S.radioDot} />}
                      </div>
                    </div>
                  </Touchable>
                );
              })}
            </div>

            <input
              className="pkf-ph-slate"
              style={{ ...S.input, marginTop: 8 }}
              placeholder="Ghi chú thêm về phương tiện (nếu có)…"
              value={transportNote}
              onChange={(e) => setTransportNote(e.target.value)}
            />
          </div>

          {/* SECTION 6: YÊU CẦU AN TOÀN ĐẶC BIỆT */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Yêu cầu an toàn cụ thể <span style={S.star}>*</span>
              </span>
              <span style={S.helperHint}>🛡️ Cam kết an toàn</span>
            </div>

            <div style={S.tagWrap}>
              {QUICK_SAFETY_TAGS.map((tag, idx) => {
                const isAdded = requirements.includes(tag);
                return (
                  <Touchable
                    key={idx}
                    style={{ ...S.tagChip, ...(isAdded ? S.tagChipActive : {}) }}
                    onPress={() => handleSafetyTagToggle(tag)}
                    activeOpacity={0.7}
                  >
                    <span style={{ ...S.tagChipText, ...(isAdded ? S.tagChipTextActive : {}) }}>
                      {isAdded ? `✓ ${tag}` : `+ ${tag}`}
                    </span>
                  </Touchable>
                );
              })}
            </div>

            <textarea
              className="pkf-ph-slate"
              style={{ ...S.input, ...S.textarea }}
              placeholder="VD: Chụp ảnh gửi mẹ lúc đón từ tay cô giáo, cài quai mũ bảo hiểm chắc chắn và gọi điện báo ngay khi về tới nhà..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={2}
            />
          </div>

          {/* SECTION 7: MỨC PHÍ ĐỀ XUẤT */}
          <div style={S.sectionCard}>
            <div style={S.sectionHeaderRow}>
              <span style={S.label}>
                Mức phí đề xuất (VNĐ / chuyến hoặc giờ) <span style={S.star}>*</span>
              </span>
              <div style={S.benchmarkBadge}>
                <span style={S.benchmarkBadgeText}>Khung chuẩn: 50.000đ - 80.000đ</span>
              </div>
            </div>

            <div style={S.rateInputWrap}>
              <input
                className="pkf-ph-slate"
                style={S.rateInput}
                placeholder="60000"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="numeric"
              />
              <span style={S.rateSuffix}>đ / chuyến</span>
            </div>

            <div style={S.benchmarkBox}>
              <div style={S.benchmarkIcon}>
                <span style={{ fontSize: 11, color: "#FFFFFF", fontWeight: 800 }}>✓</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.benchmarkTitle}>Mức giá tối ưu cho quãng đường ~2.8km</div>
                <div style={S.benchmarkDesc}>Thường có CarePartner nhận đơn trong vòng 8 phút.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. STICKY BOTTOM ACTION DOCK */}
      <div style={S.bottomDock}>
        <div style={S.dockLeft}>
          <div style={S.dockSub}>Tạm tính ca đón:</div>
          <div style={S.dockPrice}>
            {Number(rate || 60000).toLocaleString("vi-VN")}
            <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>đ</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: "#64748B" }}> / {numChildren} bé</span>
          </div>
          <div style={S.guaranteePill}>
            <div style={S.guaranteeDot} />
            <span style={S.guaranteeText}>Live GPS tự động kích hoạt</span>
          </div>
        </div>

        <Touchable
          style={{ ...S.dockCtaBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          <span style={S.ctaTitle}>{submitting ? "Đang đăng..." : "Đăng việc & Tìm người đón"}</span>
          <Icon name="arrow-forward" size={16} color="#FFFFFF" />
        </Touchable>
      </div>

      {/* Bottom Sheet Animation: Đang tìm kiếm CarePartner */}
      <SearchingCarePartnerModal
        visible={searchModalVisible}
        status={searchStatus}
        serviceType="Đón trẻ tan học"
        serviceIcon="navigate"
        errorMessage={searchError}
        onClose={() => setSearchModalVisible(false)}
      />
    </div>
  );
};

export default PickupForm;
