/**
 * TutoringForm — port CHÍNH XÁC mobile/src/screens/Parent/TutoringForm.js (1556 dòng).
 * Flow 1 Step 1 §A: Đăng việc GIA SƯ & KÈM HỌC — bản thiết kế Google Stitch.
 *
 * Toàn bộ state/field của RN — không bỏ field nào:
 *   childAge (stepper 6..18 + quick tier 8/13/16), selectedSubjects (multi-select grid, tối đa 3 —
 *   Alert "Giới hạn môn học"), schoolLevel (deriving cap_1/2/3 tự động lọc môn), seniorityPreference
 *   (4 chip, key khớp backend TUTOR_SENIORITY_PREFERENCES), requirements (textarea + QUICK_TAGS
 *   "✓/+" append), dates (YYYY-MM-DD sort, chặn ngày quá khứ), timeFrom/timeTo (text input +
 *   cảnh báo < 30 phút), rate (±10.000, min 40.000, benchmarkBox khung giá), location
 *   (JobLocationPicker), locationNote (số phòng/tầng).
 * Submit: validate từng bước (Alert đúng RN) → createJob({ job_type:'tutoring', subject,
 *   subject_code, child_age, school_level, tutor_seniority_preference, specific_requirements,
 *   dates, time_from, time_to, latitude, longitude, location_note, hourly_rate_vnd })
 *   → publishJob(jobId) (timeout 60s — AI_TIMEOUT trong @/api/matching) → getMatchingCandidates
 *   (silent fallback như RN) → giữ modal tối thiểu 1.2s → status 'success' → sau 600ms điều hướng
 *   CandidatesList { jobId, job: richJob, candidates, totalMatched } đúng RN. Lỗi có jobId vẫn
 *   chuyển CandidatesList (fallbackRichJob); lỗi tạo job → modal trạng thái error + extractErrorMessage.
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - DateTimePicker native → <input type="date"> ẩn; chọn ngày quá khứ vẫn Alert "Không hợp lệ" như RN.
 * - JobLocationPicker/MapPickerModal (Leaflet WebView) → theo spec web: ô tìm địa chỉ
 *   (backend /matching/geocode/search/ + Nominatim fallback), nút "Dùng vị trí hiện tại"
 *   (navigator.geolocation.getCurrentPosition + reverse geocode), thẻ hiển thị label + tọa độ
 *   "Đã ghim ✓"; nút "⛶ Phóng to" focus ô tìm kiếm (không có bản đồ full-screen); KHÔNG geofence
 *   (RN TutoringForm/JobLocationPicker cũng không có geofence — chỉ CreateTaskScreen có).
 * - SearchingCarePartnerModal → bottom sheet fixed overlay + CSS keyframes (radar 3 vòng lan tỏa
 *   1.6s delay 0/450/900ms, success pop, slide-up) thay RN Animated.
 * - Giá đề xuất A1 (theo đề bài, tham khảo trigger RN CreateTaskScreen): fetch getCategories()
 *   tìm category "Gia sư" (fallback id 1) → getPriceSuggestion({ category_id, latitude, longitude,
 *   estimated_duration_hours }) debounce 400ms khi đã chọn ≥1 môn; hiển thị vào benchmarkBox + nút
 *   "Dùng giá gợi ý". RN TutoringForm chỉ có benchmarkBox tĩnh — giữ nguyên text tĩnh khi chưa có gợi ý.
 * - Params điều hướng (job, candidates) truyền bằng object qua router state (hash chỉ serialize jobId).
 * - extractErrorMessage/formatDateToYMD port từ mobile/src/utils/date.js + nhận thêm message
 *   timeout/mạng tiếng Việt của api client web ("Hết thời gian chờ kết nối", "Lỗi kết nối mạng").
 * - Icon thiếu glyph trong bộ 159 (search-outline, close-circle-outline, scan-outline,
 *   checkmark-done) → map glyph gần nhất cùng nghĩa (ic()) vì không được sửa ionicons.ts.
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { SHADOWS, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";
import { createJob, publishJob, getMatchingCandidates } from "@/api/matching";
import { getPriceSuggestion, getCategories } from "@/api/tasks";
import api from "@/api/client";

/** GET helper (api client web không nhận params object — build query string như matching.ts) */
const apiGet = (path: string) => api.get(path);

/* Alias glyph Ionicons thiếu trong bộ 159 → glyph gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      "search-outline": "search",
      "close-circle-outline": "close-circle",
      "scan-outline": "scan",
      "checkmark-done": "checkmark-circle",
    } as Record<string, string>
  )[name] ?? name;

/* ============================================================
 * Utils port từ mobile/src/utils/date.js (chưa có trong src/utils)
 * ============================================================ */
export const formatDateToYMD = (date: Date | string | number | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTodayYMD = (): string => formatDateToYMD(new Date());

export const extractErrorMessage = (err: any, fallback = "Không thể thực hiện. Vui lòng kiểm tra lại thông tin."): string => {
  if (!err) return fallback;

  // Lỗi timeout (AI phân tích lâu — RN: ECONNABORTED; web client: "Hết thời gian chờ kết nối")
  const msg = String(err?.message ?? "");
  const lower = msg.toLowerCase();
  if (err?.code === "ECONNABORTED" || lower.includes("timeout") || lower.includes("hết thời gian chờ")) {
    return "Thời gian xử lý quá hạn (hệ thống AI đang phân tích). Vui lòng thử lại hoặc vào danh sách công việc để kiểm tra.";
  }

  // Lỗi mạng hoặc máy chủ không thể tiếp cận (RN: "Network Error"; web client: "Lỗi kết nối mạng")
  if (msg === "Network Error" || lower.includes("network error") || lower.includes("lỗi kết nối mạng")) {
    return "Lỗi kết nối mạng: Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại đường truyền Wi-Fi/4G và thử lại.";
  }

  const status = err?.response?.status;
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 502 || status === 503 || status === 504) {
    return "Máy chủ đang khởi động hoặc tạm bận. Vui lòng thử lại sau ít phút.";
  }
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
};

/* ============================================================
 * Curriculum & pricing — export giống RN (test/đối chiếu 1:1)
 * ============================================================ */
export interface SubjectOption {
  code: string;
  name: string;
}
export interface CurriculumTier {
  label: string;
  ageRange: number[];
  defaultAge: number;
  subjects: SubjectOption[];
}

export const CURRICULUM_TIERS: Record<string, CurriculumTier> = {
  cap_1: {
    label: "Cấp 1 (Tiểu học)",
    ageRange: [6, 10],
    defaultAge: 8,
    subjects: [
      { code: "toan", name: "Toán" },
      { code: "tieng_viet", name: "Tiếng Việt" },
      { code: "tu_nhien_xa_hoi", name: "Tự nhiên và Xã hội" },
      { code: "am_nhac", name: "Âm nhạc" },
      { code: "my_thuat", name: "Mỹ thuật" },
      { code: "tin_hoc_cong_nghe", name: "Tin học và Công nghệ" },
      { code: "lich_su", name: "Lịch sử" },
      { code: "dia_ly", name: "Địa lý" },
      { code: "tieng_anh", name: "Tiếng Anh" },
      { code: "tieng_trung", name: "Tiếng Trung" },
    ],
  },
  cap_2: {
    label: "Cấp 2 (THCS)",
    ageRange: [11, 15],
    defaultAge: 13,
    subjects: [
      { code: "toan", name: "Toán" },
      { code: "van", name: "Ngữ văn" },
      { code: "tieng_anh", name: "Tiếng Anh" },
      { code: "tieng_trung", name: "Tiếng Trung" },
      { code: "giao_duc_cong_dan", name: "Giáo dục công dân" },
      { code: "khoa_hoc_tu_nhien", name: "Khoa học tự nhiên" },
      { code: "lich_su_dia_ly", name: "Lịch sử và Địa lý" },
      { code: "tin_hoc", name: "Tin học" },
      { code: "cong_nghe", name: "Công nghệ" },
      { code: "am_nhac", name: "Âm nhạc" },
      { code: "my_thuat", name: "Mỹ thuật" },
      { code: "hoa", name: "Hoá học" },
      { code: "ly", name: "Vật lý" },
      { code: "sinh", name: "Sinh học" },
    ],
  },
  cap_3: {
    label: "Cấp 3 (THPT)",
    ageRange: [16, 18],
    defaultAge: 16,
    subjects: [
      { code: "toan", name: "Toán" },
      { code: "van", name: "Ngữ văn" },
      { code: "tieng_anh", name: "Tiếng Anh" },
      { code: "tieng_trung", name: "Tiếng Trung" },
      { code: "lich_su", name: "Lịch sử" },
      { code: "ly", name: "Vật lý" },
      { code: "hoa", name: "Hoá học" },
      { code: "sinh", name: "Sinh học" },
      { code: "dia_ly", name: "Địa lý" },
      { code: "giao_duc_kinh_te_phap_luat", name: "Giáo dục kinh tế và Pháp luật" },
      { code: "tin_hoc", name: "Tin học" },
      { code: "cong_nghe", name: "Công nghệ" },
      { code: "am_nhac", name: "Âm nhạc" },
      { code: "my_thuat", name: "Mỹ thuật" },
    ],
  },
};

export const SENIORITY_OPTIONS = [
  { key: "student_year_1_2", label: "Sinh viên năm 1-2" },
  { key: "student_year_3_4", label: "Sinh viên năm 3-4 (Ưu tiên Sư phạm)" },
  { key: "graduate", label: "Cử nhân / Đã tốt nghiệp" },
  // Hotfix 2026-09-14: key phải khớp TUTOR_SENIORITY_PREFERENCES phía backend
  // ('any' từng khiến đăng việc tutoring bị 400 "Ưu tiên gia sư không hợp lệ")
  { key: "no_preference", label: "Không yêu cầu" },
];

export function getSchoolLevel(age: number): "cap_1" | "cap_2" | "cap_3" {
  if (age <= 10) return "cap_1";
  if (age <= 15) return "cap_2";
  return "cap_3";
}

export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function calculateTutoringPricing(timeFrom: string, timeTo: string, rate: string | number, numDates = 0) {
  const minutesFrom = parseTimeToMinutes(timeFrom);
  const minutesTo = parseTimeToMinutes(timeTo);
  const durationMinutes = minutesFrom !== null && minutesTo !== null ? minutesTo - minutesFrom : 0;
  const isValidTime = durationMinutes >= 30;
  const sessionDurationHours = isValidTime ? durationMinutes / 60 : 0;
  const hourlyRate = Number(rate) || 0;
  const costPerSession = isValidTime ? Math.round(sessionDurationHours * hourlyRate) : 0;
  const totalEstimatedCost = isValidTime ? costPerSession * numDates : 0;
  return {
    durationMinutes,
    isValidTime,
    sessionDurationHours,
    hourlyRate,
    costPerSession,
    totalEstimatedCost,
  };
}

const QUICK_TAGS = ["Kiên nhẫn", "Gia sư nữ", "ĐH Sư Phạm", "Ôn thi học kỳ", "Có xe máy"];

interface PickedLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

type SearchStatus = "searching" | "success" | "error";

const SEARCH_MESSAGES = [
  "AI đang phân tích yêu cầu ca làm...",
  "Đang quét cự ly GPS & thời gian rảnh gần bạn...",
  "Đang xếp hạng CarePartner theo thuật toán ELO...",
  "Đang hoàn tất danh sách ứng viên xuất sắc nhất...",
];

/* CSS keyframes cục bộ — thay RN Animated (radar rings / pop / sheet / fade) + màu placeholder RN */
const LOCAL_CSS = `
@keyframes tf-radar { 0% { transform: scale(0.8); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
@keyframes tf-pop { 0% { transform: scale(0); } 65% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes tf-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes tf-fade { from { opacity: 0; } to { opacity: 1; } }
.tf-ph::placeholder { color: #94A3B8; }
`;

/* ============================================================
 * JobLocationPicker — web port của components/JobLocationPicker.js
 * (RN: Leaflet WebView + MapPickerModal → web: tìm địa chỉ + GPS + thẻ tọa độ)
 * ============================================================ */
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    // Thử reverse geocoding qua backend endpoint chuẩn (giống RN)
    const data = await apiGet(`/matching/geocode/reverse/?lat=${lat}&lon=${lng}`);
    const label =
      data?.display_name || (Array.isArray(data?.results) ? data.results[0]?.display_name : "") || "";
    if (label) return label;
  } catch {
    /* ignore — fallback Nominatim */
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const d = await r.json();
    if (d?.display_name) return d.display_name;
  } catch {
    /* ignore */
  }
  return "";
};

const JobLocationPickerField: React.FC<{
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
}> = ({ value, onChange }) => {
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sử dụng vị trí GPS hiện tại của thiết bị (RN: expo-location → web: navigator.geolocation)
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      showAlert("Lỗi", "Không thể lấy được vị trí hiện tại. Vui lòng thử chọn trên bản đồ.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let label = "Vị trí hiện tại của bạn";
        try {
          const addr = await reverseGeocode(lat, lng);
          if (addr) label = addr;
        } catch {
          /* ignore */
        }
        onChange({ latitude: lat, longitude: lng, label });
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err && (err as GeolocationPositionError).code === 1) {
          showAlert("Cần cấp quyền", "EduCareLink cần quyền truy cập vị trí để tự động định vị.");
        } else {
          showAlert("Lỗi", "Không thể lấy được vị trí hiện tại. Vui lòng thử chọn trên bản đồ.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  // Tìm kiếm địa điểm theo tên (backend geocode → fallback Nominatim, giống RN)
  const searchPlace = async () => {
    const q = searchText.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const data = await apiGet(`/matching/geocode/search/?q=${encodeURIComponent(q + " Việt Nam")}`);
      const rows = Array.isArray(data?.results) ? data.results : [];
      if (rows.length) {
        const row = rows[0];
        const lat = parseFloat(row.lat);
        const lng = parseFloat(row.lon);
        onChange({ latitude: lat, longitude: lng, label: row.display_name || q });
        return;
      }
      showAlert("Không tìm thấy", "Thử nhập tên địa điểm hoặc phường/quận cụ thể hơn.");
    } catch {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + " Việt Nam")}`;
        const resp = await fetch(url);
        const rows = await resp.json();
        if (rows?.length) {
          const row = rows[0];
          const lat = parseFloat(row.lat);
          const lng = parseFloat(row.lon);
          onChange({ latitude: lat, longitude: lng, label: row.display_name || q });
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
          ref={searchInputRef}
          className="tf-ph"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "#0F172A", padding: "4px 0" }}
          placeholder="Tìm địa điểm (VD: 126 Lê Lợi, TP. Huế...)"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") searchPlace();
          }}
        />
        {!!searchText && (
          <Touchable onPress={() => setSearchText("")} hitSlop={8} style={{ display: "flex", padding: 2 }}>
            <Icon name="close-circle" size={16} color="#94A3B8" style={{ marginRight: 4 }} />
          </Touchable>
        )}
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

      {/* 2. KHUNG VỊ TRÍ (RN: Leaflet WebView; web: không nhúng iframe bản đồ) */}
      <div style={{ height: 190, width: "100%", position: "relative", background: "#F1F5F9" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
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
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Bản đồ vị trí EduCareLink</div>
          <div style={{ fontSize: 11, color: "#64748B", textAlign: "center" }}>
            {value?.label || "Chạm vào ô tìm kiếm hoặc nút định vị để chọn vị trí"}
          </div>
        </div>

        {/* Nút phóng to toàn màn hình (RN: mở MapPickerModal → web: focus ô tìm kiếm) */}
        <Touchable
          onPress={() => searchInputRef.current?.focus()}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(255, 255, 255, 0.95)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            boxShadow: SHADOWS.small,
          }}
        >
          <Icon name={ic("scan-outline")} size={13} color="#0F172A" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0F172A" }}>⛶ Phóng to</span>
        </Touchable>
      </div>

      {/* 3. THẺ HIỂN THỊ ĐỊA CHỈ ĐÃ CHỌN */}
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
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#0F172A",
                lineHeight: "16px",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {value.label || "Vị trí đã chọn trên bản đồ"}
            </div>
            <div style={{ fontSize: 10, color: "#059669", fontWeight: 700, marginTop: 1 }}>
              Tọa độ: {value.latitude?.toFixed(4)}, {value.longitude?.toFixed(4)} · Đã ghim ✓
            </div>
          </div>
          <Touchable onPress={() => onChange(null)} hitSlop={8} style={{ padding: 4, display: "flex" }}>
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
          <div style={{ fontSize: 10.5, color: "#64748B", fontWeight: 500, flex: 1 }}>
            Chạm trên bản đồ hoặc nhập địa chỉ để ghim vị trí chính xác
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
 * SearchingCarePartnerModal — web port của components/SearchingCarePartnerModal.js
 * Bottom sheet: radar 3 vòng lan tỏa + thông điệp luân chuyển 1.4s + success/error state
 * ============================================================ */
const SearchingCarePartnerModal: React.FC<{
  visible: boolean;
  status?: SearchStatus;
  serviceType?: string;
  serviceIcon?: string;
  errorMessage?: string;
  onClose: () => void;
}> = ({ visible, status = "searching", serviceType = "Gia sư & Kèm học 1:1", serviceIcon = "school", errorMessage = "", onClose }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  // Luân chuyển thông điệp tìm kiếm (1.4s — như RN)
  useEffect(() => {
    if (!visible || status !== "searching") return;
    const interval = setInterval(() => setMessageIndex((prev) => (prev + 1) % SEARCH_MESSAGES.length), 1400);
    return () => clearInterval(interval);
  }, [visible, status]);

  useEffect(() => {
    if (visible) setMessageIndex(0);
  }, [visible]);

  if (!visible) return null;

  const ringBase: React.CSSProperties = {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    border: "2px solid #F26522",
    background: "rgba(242, 101, 34, 0.08)",
    animation: "tf-radar 1.6s ease-out infinite",
  };

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
      <div style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.65)", animation: "tf-fade 0.25s ease-out" }} />

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
          animation: "tf-sheet-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
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
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", textAlign: "center" }}>
            {status === "searching" && "Đang tìm kiếm CarePartner..."}
            {status === "success" && "Đã tìm thấy ứng viên xuất sắc! 🎉"}
            {status === "error" && "Chưa thể đăng việc"}
          </div>
        </div>

        {/* Radar Scanner Animation hoặc Success/Error Banner */}
        <div
          style={{
            height: 140,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "6px 0",
          }}
        >
          {status === "searching" && (
            <div
              style={{
                width: 130,
                height: 130,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div style={{ ...ringBase, animationDelay: "0s" }} />
              <div style={{ ...ringBase, animationDelay: "0.45s" }} />
              <div style={{ ...ringBase, animationDelay: "0.9s" }} />

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
                  position: "relative",
                }}
              >
                <Icon name="search" size={26} color="#FFFFFF" />
              </div>
            </div>
          )}

          {status === "success" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", animation: "tf-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
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
                }}
              >
                <Icon name="checkmark" size={38} color="#FFFFFF" />
              </div>
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
              <Icon name="alert" size={36} color="#FFFFFF" />
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
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "#1E293B",
                  textAlign: "center",
                  marginBottom: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {SEARCH_MESSAGES[messageIndex]}
              </div>
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
              <div style={{ fontSize: 15, fontWeight: 800, color: "#059669", textAlign: "center" }}>
                Đã chọn lọc các ứng viên phù hợp nhất
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4, textAlign: "center" }}>
                Đang lập tức chuyển tiếp đến danh sách ứng viên...
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#DC2626", textAlign: "center" }}>Đã có lỗi xảy ra</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, textAlign: "center", lineHeight: "16px" }}>
                {errorMessage || "Không thể kết nối với máy chủ. Vui lòng thử lại."}
              </div>
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
 * TutoringForm — main screen
 * ============================================================ */
const TutoringForm: React.FC = () => {
  const nav = useNav();
  const [childAge, setChildAge] = useState(8);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectOption[]>([]);
  const [seniorityPreference, setSeniorityPreference] = useState("no_preference");
  const [subject, setSubject] = useState("");
  const [requirements, setRequirements] = useState("");
  const [dates, setDates] = useState<string[]>([]); // 'YYYY-MM-DD'
  const [timeFrom, setTimeFrom] = useState("19:00");
  const [timeTo, setTimeTo] = useState("21:00");
  const [rate, setRate] = useState("120000");
  const [location, setLocation] = useState<PickedLocation | null>(null); // {latitude, longitude, label}
  const [locationNote, setLocationNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("searching");
  const [searchError, setSearchError] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  // === A1: Gợi ý giá tự động (trigger theo RN CreateTaskScreen — debounce 400ms) ===
  const [priceSuggestion, setPriceSuggestion] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [tutorCategoryId, setTutorCategoryId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCategories();
        const rows = Array.isArray(data) ? data : [];
        const tutor =
          rows.find((c: any) => /gia s/i.test(String(c?.name || ""))) ||
          rows.find((c: any) => Number(c?.id) === 1);
        if (!cancelled) setTutorCategoryId(Number(tutor?.id ?? 1));
      } catch {
        // Fallback: id 1 = "Gia sư" (khớp CATEGORIES local của RN CreateTaskScreen)
        if (!cancelled) setTutorCategoryId(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const schoolLevel = getSchoolLevel(childAge);
  const pricing = calculateTutoringPricing(timeFrom, timeTo, rate, dates.length);
  const { isValidTime, sessionDurationHours, costPerSession, totalEstimatedCost } = pricing;
  const displayCost = dates.length > 0 ? totalEstimatedCost : costPerSession;

  // Fetch gợi ý giá khi user nhập đủ điều kiện (đã chọn môn + category sẵn sàng), debounce 400ms
  const canSuggestPrice = selectedSubjects.length > 0 && tutorCategoryId != null;
  useEffect(() => {
    if (!canSuggestPrice) {
      setPriceSuggestion(null);
      return;
    }
    const timer = setTimeout(async () => {
      setPriceLoading(true);
      try {
        const payload: Record<string, any> = { category_id: tutorCategoryId };
        if (location) {
          payload.latitude = location.latitude;
          payload.longitude = location.longitude;
        }
        if (isValidTime && sessionDurationHours > 0) {
          payload.estimated_duration_hours = sessionDurationHours;
        }
        const data = await getPriceSuggestion(payload);
        setPriceSuggestion(data);
      } catch {
        setPriceSuggestion(null);
      } finally {
        setPriceLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSuggestPrice, tutorCategoryId, location, isValidTime, sessionDurationHours]);

  // Nội dung benchmarkBox: dynamic suggestion (nếu có) → fallback text tĩnh NGUYÊN của RN
  const priceHint = (() => {
    if (!priceSuggestion) return null;
    const { suggested_price, price_range, pricing_type, reason, message } = priceSuggestion;
    if (message) return String(message);
    if (reason) return String(reason);
    if (suggested_price != null) {
      let txt = `Gợi ý: ${Number(suggested_price).toLocaleString("vi-VN")}đ`;
      if (pricing_type === "distance" && priceSuggestion.breakdown?.distance_km) {
        txt += ` (${priceSuggestion.breakdown.distance_km}km)`;
      } else if (pricing_type === "hourly" && priceSuggestion.breakdown?.estimated_hours) {
        txt += ` (${priceSuggestion.breakdown.estimated_hours}h)`;
      }
      return txt;
    }
    if (price_range) {
      return `Khoảng: ${Number(price_range.min).toLocaleString("vi-VN")}đ - ${Number(price_range.max).toLocaleString("vi-VN")}đ`;
    }
    return null;
  })();

  const applySuggestedPrice = () => {
    if (priceSuggestion?.suggested_price != null) {
      setRate(String(priceSuggestion.suggested_price));
    }
  };

  const updateAge = (newAge: number) => {
    const clampedAge = Math.max(6, Math.min(18, newAge));
    const oldLevel = getSchoolLevel(childAge);
    const newLevel = getSchoolLevel(clampedAge);
    setChildAge(clampedAge);
    if (oldLevel !== newLevel) {
      const allowedCodes = CURRICULUM_TIERS[newLevel].subjects.map((s) => s.code);
      setSelectedSubjects((prev) => prev.filter((s) => allowedCodes.includes(s.code)));
    }
  };

  const toggleSubject = (subj: SubjectOption) => {
    const isSelected = selectedSubjects.some((s) => s.code === subj.code);
    if (isSelected) {
      setSelectedSubjects((prev) => prev.filter((s) => s.code !== subj.code));
    } else {
      if (selectedSubjects.length >= 3) {
        showAlert("Giới hạn môn học", "Chỉ được chọn tối đa 3 môn học cùng lúc.");
        return;
      }
      setSelectedSubjects((prev) => [...prev, subj]);
    }
  };

  // Web: <input type="date"> thay DateTimePicker native — logic chặn ngày quá khứ giữ nguyên RN
  const handleDateSelected = (iso: string | null) => {
    if (!iso) return;
    const today = getTodayYMD();
    if (iso < today) {
      showAlert("Không hợp lệ", "Không được chọn ngày trong quá khứ.");
      return;
    }
    if (!dates.includes(iso)) setDates([...dates, iso].sort());
  };

  const handleRateAdjust = (amount: number) => {
    const current = Number(rate) || 120000;
    const updated = Math.max(40000, current + amount);
    setRate(updated.toString());
  };

  const handleTagToggle = (tag: string) => {
    if (!requirements.includes(tag)) {
      setRequirements((prev) => (prev.trim() ? `${prev.trim()}, ${tag}` : tag));
    }
  };

  const handleDurationPreset = (hours: number) => {
    // Tự động tính toán timeTo dựa theo timeFrom
    try {
      const parts = (timeFrom || "19:00").split(":").map(Number);
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const totalMinutes = h * 60 + m + hours * 60;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      setTimeTo(endStr);
    } catch {
      setTimeTo("21:00");
    }
  };

  const submit = async () => {
    const subjectStr =
      selectedSubjects.length > 0 ? selectedSubjects.map((s) => s.name).join(", ") : subject.trim();
    const subjectCodes = selectedSubjects.map((s) => s.code);

    if (!subjectStr) return showAlert("Thiếu thông tin", "Vui lòng chọn ít nhất 1 môn học.");
    if (dates.length === 0) return showAlert("Thiếu thông tin", "Vui lòng chọn ít nhất 1 ngày học.");
    if (!isValidTime) return showAlert("Thời gian không hợp lệ", "Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút.");
    if (!location) return showAlert("Thiếu thông tin", "Vui lòng chọn vị trí trên bản đồ.");
    if (!rate || Number(rate) <= 0) return showAlert("Thiếu thông tin", "Vui lòng nhập học phí/giờ (VNĐ > 0).");

    // Tự động điền yêu cầu mặc định nếu phụ huynh chưa kịp nhập
    const finalRequirements =
      requirements.trim() ||
      `Dạy kèm môn ${subjectStr}, hướng dẫn bài tập và hỗ trợ bé rèn luyện kiến thức vững vàng.`;

    setSubmitting(true);
    setSearchModalVisible(true);
    setSearchStatus("searching");
    setSearchError("");
    let createdJobId: string | number | null = null;
    const searchStartTime = Date.now();
    try {
      const job = await createJob({
        job_type: "tutoring",
        subject: subjectStr,
        subject_code: subjectCodes,
        child_age: childAge,
        school_level: schoolLevel,
        tutor_seniority_preference: seniorityPreference,
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

      // Đăng + chạy AI parse ngay (Step 1.2 → ai_parsed + tạo slots) — publishJob timeout 60s
      const pubRes = await publishJob(job.id);

      // Tải trước danh sách ứng viên ngay trong lúc modal tìm kiếm đang quét sóng radar
      let matchedCandidates: any[] | null = null;
      let totalMatched: number | null = null;
      let freshJob: any = null;
      try {
        const candRes = await getMatchingCandidates(job.id);
        matchedCandidates = candRes?.candidates || null;
        totalMatched = candRes?.total_matched || null;
        freshJob = candRes?.job || null;
      } catch {
        // Dự phòng demo nếu kết nối chậm
      }

      const scheduleStr = `${timeFrom} - ${timeTo} (${dates.length} buổi)`;
      const richJob: Record<string, any> = {
        ...job,
        ...(freshJob || {}),
        title: pubRes?.title || freshJob?.title || job.title || `Gia sư ${subjectStr}`,
        category_label: freshJob?.category_label || pubRes?.category_label || "Gia sư & Kèm học 1:1",
        category_icon: freshJob?.category_icon || pubRes?.category_icon || "school",
        hourly_rate_vnd: Number(rate),
        schedule: freshJob?.schedule || pubRes?.schedule || scheduleStr,
        // Defect 2: bỏ hard-code địa bàn mặc định — dùng label reverse-geocoding
        // nếu phụ huynh không nhập ghi chú, fallback trung tính nếu chưa có gì
        location_note: locationNote || location?.label || "Vị trí đã chọn trên bản đồ",
      };

      // Giữ modal chạy tối thiểu 1.2s để tạo cảm giác quét radar chân thực
      const elapsed = Date.now() - searchStartTime;
      const minDisplayTime = 1200;
      if (elapsed < minDisplayTime) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayTime - elapsed));
      }

      // Đã tìm thấy ứng viên -> chuyển sang trạng thái thành công
      setSearchStatus("success");

      // Tự động nhảy thẳng qua trang hiển thị ứng viên và render ngay lập tức!
      setTimeout(() => {
        setSearchModalVisible(false);
        nav.navigate("CandidatesList", {
          jobId: job.id,
          job: richJob,
          candidates: matchedCandidates,
          totalMatched,
        });
      }, 600);
    } catch (err) {
      if (createdJobId) {
        // Đã lưu bài đăng thành công -> tự động chuyển sang xem ứng viên
        setSearchStatus("success");
        const fallbackSchedule = `${timeFrom} - ${timeTo} (${dates.length} buổi)`;
        const fallbackRichJob: Record<string, any> = {
          id: createdJobId,
          title: `Gia sư ${subjectStr}`,
          category_label: "Gia sư & Kèm học 1:1",
          category_icon: "school",
          hourly_rate_vnd: Number(rate),
          schedule: fallbackSchedule,
          location_note: locationNote || location?.label || "Vị trí đã chọn trên bản đồ",
        };
        setTimeout(() => {
          setSearchModalVisible(false);
          nav.navigate("CandidatesList", { jobId: createdJobId, job: fallbackRichJob });
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

  /* ---- Shared element styles (từ styles.js RN) ---- */
  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    background: "#F8FAFC",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    padding: "10px 12px",
    fontSize: 13,
    color: "#0F172A",
    outline: "none",
    fontFamily: "inherit",
  };
  const sectionHeaderRow: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#0F172A" };
  const starStyle: React.CSSProperties = { color: "#F26522", fontWeight: 800 };
  const helperHintStyle: React.CSSProperties = { fontSize: 11, color: "#94A3B8", fontWeight: 500 };
  const subHintStyle: React.CSSProperties = { fontSize: 11, color: "#64748B", marginTop: 8, marginBottom: 6 };
  const circleBtn: React.CSSProperties = {
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
  };

  return (
    <Screen bg="#F8FAFC" scroll={false} style={{ height: "100dvh", paddingBottom: TAB_BAR_HEIGHT }}>
      <style>{LOCAL_CSS}</style>
      <div style={{ background: "#FFFFFF" }}>
        <StatusBarSpacer />
      </div>

      {/* 1. TOP APP BAR */}
      <div
        style={{
          background: "#FFFFFF",
          padding: "0 16px 10px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #F1F5F9",
          boxShadow: SHADOWS.small,
        }}
      >
        <Touchable onPress={() => nav.goBack()} hitSlop={10} style={circleBtn}>
          <Icon name="arrow-back" size={20} color="#1E293B" />
        </Touchable>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Gia sư &amp; Kèm học</div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "#F26522" }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Bước 1/2 · Thiết lập ca học</div>
          </div>
        </div>

        <Touchable
          onPress={() =>
            showAlert(
              "Gia sư EduCareLink",
              "• 100% CarePartner được đối soát thẻ sinh viên và CCCD.\n• Học phí được ký quỹ an toàn, chỉ giải ngân khi phụ huynh hài lòng."
            )
          }
          hitSlop={10}
          style={circleBtn}
        >
          <Icon name="information-circle-outline" size={22} color="#64748B" />
        </Touchable>
      </div>

      {/* 2. SCROLLABLE FORM CONTENT */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "12px 16px 120px",
          }}
        >
          {/* Service Hero Banner */}
          <div
            style={{
              background: "#FFF4ED",
              border: "1px solid #FED7AA",
              borderRadius: 18,
              padding: 12,
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              boxShadow: SHADOWS.small,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "#F26522",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: SHADOWS.small,
                flexShrink: 0,
              }}
            >
              <Icon name="school" size={24} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: "#FFEDD5", padding: "2px 6px", borderRadius: 4, alignSelf: "flex-start", display: "inline-block" }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#EA580C" }}>CHUYÊN MỤC KÈM HỌC</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", marginTop: 3 }}>
                Tìm gia sư sinh viên giỏi &amp; tận tâm
              </div>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Icon name="shield-checkmark" size={14} color="#10B981" />
                <div style={{ fontSize: 10.5, color: "#475569", fontWeight: 500, flex: 1 }}>
                  100% đối soát CCCD &amp; Thẻ SV các trường thuộc Đại học Huế
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: ĐỘ TUỔI, CẤP HỌC & MÔN HỌC */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #E2E8F0",
              padding: 14,
              boxShadow: SHADOWS.small,
            }}
          >
            {/* Age Stepper Header */}
            <div style={sectionHeaderRow}>
              <div style={labelStyle}>
                Độ tuổi của bé &amp; Cấp học <span style={starStyle}>*</span>
              </div>
              <div
                style={{
                  background: "#FFF4ED",
                  border: "1px solid #FED7AA",
                  padding: "3px 8px",
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: "#EA580C" }}>{CURRICULUM_TIERS[schoolLevel].label}</span>
              </div>
            </div>

            {/* Age Stepper Box */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#64748B" }}>Tuổi của học sinh</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{childAge} tuổi</div>
              </div>

              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Touchable
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #E2E8F0",
                    boxShadow: SHADOWS.small,
                    ...(childAge <= 6 ? { background: "#F1F5F9", borderColor: "#E2E8F0", opacity: 0.4 } : {}),
                  }}
                  onPress={() => updateAge(childAge - 1)}
                  disabled={childAge <= 6}
                  activeOpacity={0.7}
                >
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>－</span>
                </Touchable>

                <Touchable
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #E2E8F0",
                    boxShadow: SHADOWS.small,
                    ...(childAge >= 18 ? { background: "#F1F5F9", borderColor: "#E2E8F0", opacity: 0.4 } : {}),
                  }}
                  onPress={() => updateAge(childAge + 1)}
                  disabled={childAge >= 18}
                  activeOpacity={0.7}
                >
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>＋</span>
                </Touchable>
              </div>
            </div>

            {/* Quick Tier Pills */}
            <div style={subHintStyle}>Chọn nhanh cấp học chuẩn:</div>
            <div style={{ display: "flex", flexDirection: "row", gap: 8, marginTop: 8 }}>
              {[8, 13, 16].map((age) => {
                const tierLabel = age === 8 ? "8 tuổi (Cấp 1)" : age === 13 ? "13 tuổi (Cấp 2)" : "16 tuổi (Cấp 3)";
                const isActive = childAge === age;
                return (
                  <Touchable
                    key={age}
                    style={{
                      flex: 1,
                      background: "#F1F5F9",
                      border: "1px solid transparent",
                      borderRadius: 10,
                      padding: "8px 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      ...(isActive ? { background: "#FFF4ED", borderColor: "#FED7AA" } : {}),
                    }}
                    onPress={() => updateAge(age)}
                    activeOpacity={0.7}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", ...(isActive ? { color: "#F26522", fontWeight: 800 } : {}) }}>
                      {tierLabel}
                    </span>
                  </Touchable>
                );
              })}
            </div>

            {/* Multi-Select Subject Grid */}
            <div style={{ ...sectionHeaderRow, marginTop: 14 }}>
              <div style={labelStyle}>
                Môn học cần kèm (Tối đa 3 môn) <span style={starStyle}>*</span>
              </div>
              <div
                style={{
                  ...helperHintStyle,
                  ...(selectedSubjects.length > 0 ? { color: "#F26522", fontWeight: 700 } : {}),
                }}
              >
                {selectedSubjects.length}/3 môn đã chọn
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {CURRICULUM_TIERS[schoolLevel].subjects.map((subj) => {
                const isSelected = selectedSubjects.some((s) => s.code === subj.code);
                return (
                  <Touchable
                    key={subj.code}
                    style={{
                      width: "48.5%",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: "10px 10px",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxSizing: "border-box",
                      ...(isSelected ? { background: "#FFF4ED", borderColor: "#F26522" } : {}),
                    }}
                    onPress={() => toggleSubject(subj)}
                    activeOpacity={0.7}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#334155",
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        ...(isSelected ? { color: "#F26522", fontWeight: 800 } : {}),
                      }}
                    >
                      {subj.name}
                    </span>
                    {isSelected ? (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          background: "#F26522",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginLeft: 4,
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="checkmark" size={12} color="#FFFFFF" />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          border: "1.5px solid #CBD5E1",
                          marginLeft: 4,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Touchable>
                );
              })}
            </div>

            {/* Seniority Preference */}
            <div style={{ ...sectionHeaderRow, marginTop: 14 }}>
              <div style={labelStyle}>Ưu tiên gia sư</div>
              <div style={helperHintStyle}>Tùy chọn</div>
            </div>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {SENIORITY_OPTIONS.map((opt) => {
                const isSelected = seniorityPreference === opt.key;
                return (
                  <Touchable
                    key={opt.key}
                    style={{
                      background: "#F1F5F9",
                      padding: "7px 10px",
                      borderRadius: 10,
                      border: "1px solid #E2E8F0",
                      ...(isSelected ? { background: "#FFF4ED", borderColor: "#FED7AA" } : {}),
                    }}
                    onPress={() => setSeniorityPreference(opt.key)}
                    activeOpacity={0.7}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#475569",
                        ...(isSelected ? { color: "#EA580C", fontWeight: 800 } : {}),
                      }}
                    >
                      {opt.label}
                    </span>
                  </Touchable>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: ĐẶC ĐIỂM BÉ & YÊU CẦU CỤ THỂ */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #E2E8F0",
              padding: 14,
              boxShadow: SHADOWS.small,
            }}
          >
            <div style={labelStyle}>
              Yêu cầu gia sư &amp; Tính cách của bé <span style={starStyle}>*</span>
            </div>
            <textarea
              className="tf-ph"
              style={{ ...inputStyle, height: 75, lineHeight: "18px", resize: "none" }}
              placeholder="VD: Bé hơi nhút nhát và chưa tập trung, cần gia sư kiên nhẫn và biết tạo không khí hứng khởi, ưu tiên nữ sinh viên ĐH Sư Phạm..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
            />

            <div style={subHintStyle}>Chạm để thêm nhanh tiêu chí quan trọng:</div>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {QUICK_TAGS.map((tag, idx) => {
                const isAdded = requirements.includes(tag);
                return (
                  <Touchable
                    key={idx}
                    style={{
                      background: "#F1F5F9",
                      padding: "5px 9px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      ...(isAdded ? { background: "#FFF4ED", borderColor: "#FED7AA" } : {}),
                    }}
                    onPress={() => handleTagToggle(tag)}
                    activeOpacity={0.7}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#475569",
                        ...(isAdded ? { color: "#C2410C", fontWeight: 800 } : {}),
                      }}
                    >
                      {isAdded ? `✓ ${tag}` : `+ ${tag}`}
                    </span>
                  </Touchable>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: LỊCH HỌC & THỜI GIAN */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #E2E8F0",
              padding: 14,
              boxShadow: SHADOWS.small,
            }}
          >
            <div style={sectionHeaderRow}>
              <div style={labelStyle}>
                Ngày học trong tuần <span style={starStyle}>*</span>
              </div>
              <div style={{ ...helperHintStyle, color: "#F26522", fontWeight: 700 }}>
                {dates.length > 0 ? `${dates.length} buổi đã chọn` : "Chưa chọn ngày"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
              {dates.map((d) => (
                <div
                  key={d}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    background: "#FFF4ED",
                    border: "1px solid #FED7AA",
                    padding: "6px 10px",
                    borderRadius: 10,
                    gap: 6,
                  }}
                >
                  <Icon name="calendar-outline" size={13} color="#F26522" />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9A3412" }}>{d}</span>
                  <Touchable onPress={() => setDates(dates.filter((x) => x !== d))} hitSlop={6} style={{ display: "flex" }}>
                    <Icon name="close" size={14} color="#EA580C" />
                  </Touchable>
                </div>
              ))}

              <Touchable
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  border: "1.5px dashed #F26522",
                  background: "#FFF4ED",
                  padding: "6px 12px",
                  borderRadius: 10,
                  gap: 4,
                }}
                onPress={() => dateInputRef.current?.click()}
                activeOpacity={0.8}
              >
                <Icon name="add" size={15} color="#F26522" />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#F26522" }}>Thêm ngày học</span>
              </Touchable>
              {/* DateTimePicker native RN → <input type="date"> ẩn (validation ngày quá khứ như RN) */}
              <input
                ref={dateInputRef}
                type="date"
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, border: 0, padding: 0, pointerEvents: "none" }}
                onChange={(e) => {
                  handleDateSelected(e.target.value || null);
                  e.target.value = "";
                }}
              />
            </div>

            {/* Time Slot Row */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 10,
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid #F1F5F9",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Bắt đầu từ
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "4px 10px",
                    gap: 6,
                  }}
                >
                  <Icon name="time-outline" size={16} color="#94A3B8" />
                  <input
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#0F172A", padding: "4px 0" }}
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    placeholder="19:00"
                  />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
                  Kết thúc lúc
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "4px 10px",
                    gap: 6,
                  }}
                >
                  <Icon name="time-outline" size={16} color="#94A3B8" />
                  <input
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#0F172A", padding: "4px 0" }}
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    placeholder="21:00"
                  />
                </div>
              </div>
            </div>

            {/* Time Validation Warning */}
            {!isValidTime && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  padding: "6px 10px",
                  marginTop: 8,
                }}
              >
                <Icon name="alert-circle" size={15} color="#EF4444" style={{ marginRight: 6 }} />
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#EF4444" }}>
                  Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút.
                </div>
              </div>
            )}

            {/* Quick Duration Presets */}
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
              <div style={{ fontSize: 10.5, color: "#64748B" }}>Thời lượng ca:</div>
              <Touchable
                style={{ background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}
                onPress={() => handleDurationPreset(1.5)}
              >
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#475569" }}>1.5 giờ</span>
              </Touchable>
              <Touchable
                style={{ background: "#FFF4ED", border: "1px solid #FED7AA", padding: "3px 8px", borderRadius: 6 }}
                onPress={() => handleDurationPreset(2)}
              >
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#F26522" }}>2 giờ (Chuẩn)</span>
              </Touchable>
              <Touchable
                style={{ background: "#F1F5F9", padding: "3px 8px", borderRadius: 6 }}
                onPress={() => handleDurationPreset(2.5)}
              >
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#475569" }}>2.5 giờ</span>
              </Touchable>
            </div>
          </div>

          {/* SECTION 4: HỌC PHÍ ĐỀ XUẤT */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #E2E8F0",
              padding: 14,
              boxShadow: SHADOWS.small,
            }}
          >
            <div style={sectionHeaderRow}>
              <div style={labelStyle}>
                Học phí đề xuất / giờ (VNĐ) <span style={starStyle}>*</span>
              </div>
              <div
                style={{
                  background: "#ECFDF5",
                  padding: "2px 6px",
                  borderRadius: 10,
                  border: "1px solid #A7F3D0",
                }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#047857" }}>Tối ưu tỷ lệ ghép</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 12,
                  padding: "0 12px",
                }}
              >
                <input
                  className="tf-ph"
                  style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 18, fontWeight: 800, color: "#0F172A", padding: "8px 0" }}
                  placeholder="120000"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  inputMode="numeric"
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>đ / giờ</span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  background: "#F1F5F9",
                  borderRadius: 10,
                  padding: 3,
                  gap: 4,
                }}
              >
                <Touchable
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: SHADOWS.small,
                  }}
                  onPress={() => handleRateAdjust(-10000)}
                  activeOpacity={0.7}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>－</span>
                </Touchable>
                <Touchable
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: SHADOWS.small,
                  }}
                  onPress={() => handleRateAdjust(10000)}
                  activeOpacity={0.7}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>＋</span>
                </Touchable>
              </div>
            </div>

            {/* Benchmark Helper Box (RN tĩnh + gợi ý giá A1 động theo đề bài) */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: 12,
                padding: 10,
                marginTop: 10,
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: "#10B981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {priceLoading ? (
                  <Spinner size={11} color="#FFFFFF" />
                ) : (
                  <span style={{ fontSize: 11, color: "#FFFFFF", fontWeight: 800 }}>✓</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#065F46" }}>
                  {priceHint ?? "Khung giá thị trường gợi ý: 100.000đ – 140.000đ/giờ"}
                </div>
                <div style={{ fontSize: 10.5, color: "#047857", marginTop: 2, lineHeight: "14px" }}>
                  Mức giá này nằm trong dải chuẩn. Hệ thống dự kiến sẽ có 6 - 8 sinh viên giỏi nhận lời trong 15 phút.
                </div>
                {priceSuggestion?.suggested_price != null && !priceLoading && (
                  <Touchable
                    onPress={applySuggestedPrice}
                    hitSlop={6}
                    style={{
                      marginTop: 6,
                      alignSelf: "flex-start",
                      background: "#FFFFFF",
                      border: "1px solid #A7F3D0",
                      borderRadius: 8,
                      padding: "4px 10px",
                    }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "#047857" }}>Dùng giá gợi ý</span>
                  </Touchable>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: ĐỊA ĐIỂM DẠY HỌC */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #E2E8F0",
              padding: 14,
              boxShadow: SHADOWS.small,
            }}
          >
            <div style={sectionHeaderRow}>
              <div style={labelStyle}>
                Địa điểm dạy học <span style={starStyle}>*</span>
              </div>
              <div style={helperHintStyle}>Tại nhà phụ huynh</div>
            </div>

            <JobLocationPickerField value={location} onChange={setLocation} />

            <div style={{ marginTop: 10 }}>
              <div style={subHintStyle}>Chi tiết số phòng / Tầng (Chung cư, ngõ hẻm):</div>
              <input
                className="tf-ph"
                style={inputStyle}
                placeholder="VD: Phòng 602, Chung cư Sunrise Tây Hồ (Bấm chuông 602)..."
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
              />
            </div>
          </div>

          {/* Trust Assurance Mini Badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 0",
            }}
          >
            <Icon name="shield-checkmark" size={15} color="#10B981" />
            <div style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>
              Khoản cọc được giữ an toàn bởi EduCareLink Guarantee
            </div>
          </div>
        </div>
      </div>

      {/* 3. STICKY BOTTOM ACTION DOCK */}
      <div
        style={{
          position: "fixed",
          bottom: TAB_BAR_HEIGHT,
          left: 0,
          right: 0,
          background: "#FFFFFF",
          borderTop: "1px solid #E2E8F0",
          padding: "10px 16px 16px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          boxShadow: SHADOWS.medium,
          zIndex: 90,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          {isValidTime ? (
            <>
              <div style={{ fontSize: 10, color: "#64748B" }}>
                {dates.length > 0
                  ? `Tạm tính (${dates.length} buổi · ${sessionDurationHours}h/ca):`
                  : `Tạm tính 1 ca (${sessionDurationHours}h):`}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: "20px" }}>
                ~{displayCost.toLocaleString("vi-VN")}
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>đ</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: "#64748B" }}>Tạm tính:</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#EF4444", lineHeight: "20px" }}>-- đ</div>
            </>
          )}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: 2.5, background: "#10B981" }} />
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "#047857" }}>Bảo vệ hoàn tiền 100%</div>
          </div>
        </div>

        <Touchable
          style={{
            flex: 1,
            background: "#F26522",
            padding: "10px 14px",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: SHADOWS.small,
            ...(submitting || !isValidTime ? { opacity: 0.4 } : {}),
          }}
          onPress={submit}
          disabled={submitting || !isValidTime}
          activeOpacity={0.88}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>
                {submitting ? "Đang đăng..." : "Đăng việc & Tìm gia sư"}
              </span>
              <Icon name="arrow-forward" size={16} color="#FFFFFF" />
            </div>
            <div style={{ fontSize: 9.5, color: "#FED7AA", marginTop: 1 }}>AI ghép cặp 8 bạn SV tốt nhất</div>
          </div>
        </Touchable>
      </div>

      {/* Bottom Sheet Animation: Đang tìm kiếm CarePartner */}
      <SearchingCarePartnerModal
        visible={searchModalVisible}
        status={searchStatus}
        serviceType="Gia sư & Kèm học 1:1"
        serviceIcon="school"
        errorMessage={searchError}
        onClose={() => setSearchModalVisible(false)}
      />
    </Screen>
  );
};

export default TutoringForm;
