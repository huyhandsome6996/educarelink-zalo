/**
 * CreateTaskScreen — port CHÍNH XÁC mobile/src/screens/Parent/CreateTaskScreen.js (1011 dòng).
 * Modal legacy "Tạo yêu cầu mới" (presentation:'modal'): progress stepper, 3 chip
 * danh mục, gợi ý giá AI (debounce 400ms + abort), form đầy đủ (title, description,
 * location + map picker + vị trí hiện tại, date/time, price, số giờ dự kiến cho
 * hourly), geofence tuỳ chọn, sticky footer "Đăng lên cộng đồng".
 * createTask từ @/api/tasks (POST /tasks/).
 *
 * MapPickerModal: RN dùng WebView + Leaflet (mobile/src/components/MapPickerModal.js).
 * Web port inline (component MapPickerModalWeb bên dưới) — cùng MAP_HTML/Leaflet/
 * geocode endpoint, WebView → iframe + postMessage (parent ⇄ iframe).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - DateTimePicker native → nhánh Platform.OS==='web' của RN: prompt('Nhập ngày
 *   (YYYY-MM-DD)') / prompt('Nhập giờ (HH:MM)') — giữ nguyên y hệt.
 * - expo-location → navigator.geolocation + reverse geocode /geocode/?lat&lon
 *   (endpoint đã có, chính endpoint map picker RN dùng).
 * - Alert 2 nút (Xem gợi ý phù hợp / Quay lại) → window.confirm (OK/Cancel);
 *   Alert 1 nút → showAlert() hoặc confirm khi có action.
 * - KeyboardAvoidingView → bỏ (web không cần); Animated fade → CSS transition.
 * - Icon thiếu glyph (bulb-outline) → glyph gần nhất (ic()).
 * - RN paddingTop insets.top + 32 → <StatusBarSpacer /> + paddingTop 32.
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { COLORS, TYPO, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { createTask, getPriceSuggestion, getCategories } from "@/api/tasks";
import { API_BASE_URL } from "@/api/client";

// Icon thiếu glyph trong ionicons.ts (159 glyph) → glyph gần nhất cùng nghĩa
const ic = (name: string) =>
  (
    {
      "bulb-outline": "sparkles",
      "search-outline": "search",
    } as Record<string, string>
  )[name] ?? name;

// QA 2026-09-10 #1: EduCareLink CHỈ còn 3 danh mục — backend chặn 400
// danh mục khác, mobile đồng bộ hiển thị đúng 3 nhóm này.
const CATEGORIES = [
  { id: 1, iconName: "book", name: "Gia sư", hint: "150.000đ - 300.000đ/buổi", pricingType: "hourly" },
  { id: 2, iconName: "happy", name: "Đón trẻ", hint: "80.000đ - 150.000đ/lần", pricingType: "distance" },
  { id: 4, iconName: "people", name: "Đồng hành cùng trẻ", hint: "100.000đ - 200.000đ/buổi", pricingType: "hourly" },
];

// ═══════════════════════════════════════════════════════════════
// MapPickerModalWeb — port web của mobile/src/components/MapPickerModal.js
// (RN: WebView Leaflet; web: iframe srcDoc + postMessage)
// ═══════════════════════════════════════════════════════════════
const DEFAULT_LAT = 16.4637; // TP. Huế — địa bàn triển khai duy nhất
const DEFAULT_LNG = 107.5909;
const DEFAULT_ZOOM = 13;
// Geocode endpoint phái sinh từ base URL DUY NHẤT của app (env-driven,
// không hardcode host production vào từng module) — như RN.
const GEOCODE_BASE = `${API_BASE_URL}/geocode/`;

// HTML cho iframe — Leaflet + OpenStreetMap (same as web gốc & MAP_HTML của RN)
const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #map { z-index: 1; }
    .custom-pin {
      background: #F26522;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .custom-pin span {
      transform: rotate(45deg);
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
    .info-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      padding: 12px 16px;
      border-top: 1px solid #e5e5e5;
      z-index: 1000;
      min-height: 60px;
      display: flex;
      align-items: center;
    }
    .info-text {
      flex: 1;
      font-size: 14px;
      color: #261813;
      line-height: 1.4;
    }
    .info-text .label {
      font-size: 11px;
      color: #594138;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .info-text .coords {
      font-size: 12px;
      color: #8a7468;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="info-bar">
    <div class="info-text">
      <div class="label">Vị trí đã chọn</div>
      <div id="address">Chưa chọn — tap vào bản đồ để chọn vị trí</div>
      <div id="coords" class="coords"></div>
    </div>
  </div>
  <script>
    var map = L.map('map').setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], ${DEFAULT_ZOOM});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    var marker = null;
    var currentLat = null;
    var currentLng = null;
    var currentAddress = '';

    function setPin(lat, lng) {
      currentLat = lat;
      currentLng = lng;
      document.getElementById('coords').textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        var icon = L.divIcon({
          className: 'custom-pin-wrap',
          html: '<div class="custom-pin"><span>📍</span></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });
        marker = L.marker([lat, lng], { icon: icon }).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }

    function reverseGeocode(lat, lng) {
      fetch('${GEOCODE_BASE}?lat=' + lat + '&lon=' + lng)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          currentAddress = data.display_name || ('Vị trí ' + lat.toFixed(4) + ', ' + lng.toFixed(4));
          document.getElementById('address').textContent = currentAddress;
          sendToHost();
        })
        .catch(function() {
          currentAddress = 'Vị trí ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
          document.getElementById('address').textContent = currentAddress;
          sendToHost();
        });
    }

    function sendToHost() {
      var payload = JSON.stringify({
        type: 'location_picked',
        latitude: currentLat,
        longitude: currentLng,
        address: currentAddress,
      });
      // RN: window.ReactNativeWebView.postMessage(payload) → web: parent window
      if (window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    }

    map.on('click', function(e) {
      setPin(e.latlng.lat, e.latlng.lng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    // Listen for commands from host
    window.addEventListener('message', function(event) {
      try {
        var cmd = JSON.parse(event.data);
        if (cmd.type === 'move_to' && cmd.latitude && cmd.longitude) {
          setPin(cmd.latitude, cmd.longitude);
          reverseGeocode(cmd.latitude, cmd.longitude);
        }
      } catch (e) {}
    });

    // Try to get user's current location on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          setPin(pos.coords.latitude, pos.coords.longitude);
          reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        },
        function() {
          // Failed — stay at default
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  </script>
</body>
</html>
`;

interface PickedCoords {
  latitude: number;
  longitude: number;
  address?: string;
}

const MapPickerModalWeb: React.FC<{
  visible: boolean;
  onPick: (coords: PickedCoords) => void;
  onClose: () => void;
}> = ({ visible, onPick, onClose }) => {
  const [pickedLocation, setPickedLocation] = useState<PickedCoords | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // RN WebView onMessage → web: window 'message' từ iframe
  useEffect(() => {
    if (!visible) return undefined;
    const onMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "location_picked") {
          setPickedLocation({ latitude: data.latitude, longitude: data.longitude, address: data.address });
        }
      } catch (e) {
        console.warn("[MapPickerModal] Failed to parse message:", e);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [visible]);

  const postToMap = useCallback((cmd: Record<string, any>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(cmd), "*");
  }, []);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setIsSearching(true);
    try {
      const resp = await fetch(`${GEOCODE_BASE}?q=${encodeURIComponent(query)}`);
      const results = await resp.json();
      if (results && results.length > 0) {
        const r = results[0];
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        postToMap({ type: "move_to", latitude: lat, longitude: lng });
        setPickedLocation({ latitude: lat, longitude: lng, address: r.display_name });
      } else {
        showAlert("Không tìm thấy", `Không tìm thấy vị trí "${query}". Thử nhập địa chỉ cụ thể hơn.`);
      }
    } catch (e) {
      showAlert("Lỗi mạng", "Không thể tìm kiếm vị trí. Kiểm tra kết nối internet.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, postToMap]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showAlert("Lỗi", "Không thể lấy vị trí hiện tại. Thử chọn thủ công trên bản đồ.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        postToMap({ type: "move_to", latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        showAlert(
          "Cần quyền vị trí",
          "Để lấy vị trí hiện tại, app cần quyền truy cập vị trí. Bạn có thể vẫn chọn vị trí thủ công trên bản đồ."
        );
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, [postToMap]);

  const handleConfirm = useCallback(() => {
    if (!pickedLocation) {
      showAlert("Chưa chọn vị trí", "Hãy tap vào bản đồ để chọn vị trí trước.");
      return;
    }
    onPick(pickedLocation);
    onClose();
  }, [pickedLocation, onPick, onClose]);

  if (!visible) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: COLORS.surface, display: "flex", flexDirection: "column" }}>
      <StatusBarSpacer />
      {/* Header */}
      <div style={{ ...S.mapHeader, borderBottom: `1px solid ${COLORS.border}` }}>
        <Touchable onPress={onClose} hitSlop={12} style={S.mapHeaderBtn}>
          <Icon name="close" size={24} color={COLORS.onSurface} />
        </Touchable>
        <span style={{ ...S.mapHeaderTitle, color: COLORS.onSurface }}>Chọn vị trí trên bản đồ</span>
        <div style={{ width: 44 }} />
      </div>

      {/* Search bar */}
      <div style={{ ...S.mapSearchBar, background: COLORS.surfaceWarm }}>
        <div style={{ ...S.mapSearchInputWrap, background: COLORS.surface, borderColor: COLORS.border }}>
          <Icon name={ic("search-outline")} size={18} color={COLORS.outlineVariant} style={{ marginRight: 8, flexShrink: 0 }} />
          <input
            style={S.mapSearchInput}
            placeholder="Tìm địa chỉ... (VD: 123 Lê Lợi, Q1)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          {isSearching && (
            <span style={{ marginLeft: 8, flexShrink: 0 }}>
              <Spinner size={14} color={COLORS.primary} />
            </span>
          )}
        </div>
        <Touchable onPress={handleUseCurrentLocation} hitSlop={8} style={{ ...S.mapCurrentLocBtn, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
          <Icon name="locate-outline" size={20} color={COLORS.primary} />
        </Touchable>
      </div>

      {/* Map — iframe Leaflet (RN: WebView) */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <iframe
          ref={iframeRef}
          title="Bản đồ chọn vị trí"
          srcDoc={MAP_HTML}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="geolocation"
        />
      </div>

      {/* Confirm */}
      <div style={{ ...S.mapFooter, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={S.mapPickedInfo}>
          {pickedLocation ? (
            <>
              <span style={{ ...TYPO.body, color: COLORS.onSurface, lineHeight: "20px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {pickedLocation.address || "Đang lấy địa chỉ..."}
              </span>
              <span style={{ ...TYPO.caption, color: COLORS.outline, marginTop: 2, display: "block" }}>
                {pickedLocation.latitude.toFixed(6)}, {pickedLocation.longitude.toFixed(6)}
              </span>
            </>
          ) : (
            <span style={{ ...TYPO.body, color: COLORS.outline, fontStyle: "italic" }}>
              Tap vào bản đồ để chọn vị trí
            </span>
          )}
        </div>
        <Touchable
          style={{ ...S.mapConfirmBtn, background: COLORS.primary, opacity: pickedLocation ? 1 : 0.5 }}
          onPress={handleConfirm}
          disabled={!pickedLocation}
          activeOpacity={0.9}
        >
          <span style={{ ...TYPO.h4, color: "#fff" }}>Xác nhận</span>
          <Icon name="checkmark-circle" size={20} color="#fff" />
        </Touchable>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN: CreateTaskScreen
// ═══════════════════════════════════════════════════════════════
const CreateTaskScreen: React.FC = () => {
  const nav = useNav();

  // Fade-in (RN Animated.timing 250ms)
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => cancelAnimationFrame(r);
  }, []);

  // === A1: Fetch categories từ DB thật khi mount ===
  const [selectedCat, setSelectedCat] = useState<number | null>(null); // DB ID thật, fetch từ API
  const [dbCategories, setDbCategories] = useState<any[]>([]); // danh sách từ DB
  const [estimatedHours, setEstimatedHours] = useState("2"); // input số giờ cho hourly
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [price, setPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [enableGeofence, setEnableGeofence] = useState(false);

  // QA-FIX-UI 3.3: errors state cho inline validation theo field
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const clearError = (field: string) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  const [geofenceRadius, setGeofenceRadius] = useState("500");

  // Map picker state — lưu toạ độ đã chọn trên bản đồ
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<PickedCoords | null>(null);
  const [locatingLoading, setLocatingLoading] = useState(false);

  // Chọn vị trí hiện tại — định vị + reverse geocode (expo-location → navigator.geolocation)
  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      showAlert("Lỗi", "Không thể lấy vị trí hiện tại. Vui lòng thử lại.");
      return;
    }
    setLocatingLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let address = "";
        // Reverse geocode để lấy địa chỉ (endpoint /geocode/ — như map picker RN)
        try {
          const resp = await fetch(`${GEOCODE_BASE}?lat=${latitude}&lon=${longitude}`);
          const data = await resp.json();
          address = data?.display_name || "";
        } catch (_) {
          /* không có địa chỉ — vẫn giữ toạ độ */
        }
        setPickedCoords({ latitude, longitude, address });
        if (address) {
          setLocation(address);
          clearError("location");
        }
        setLocatingLoading(false);
      },
      () => {
        setLocatingLoading(false);
        showAlert("Cần cấp quyền vị trí", "Vui lòng cấp quyền vị trí trong cài đặt để sử dụng tính năng này.");
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Tìm category info: ưu tiên DB (name + pricingType), fallback local CATEGORIES
  // Gán tường minh từng field — KHÔNG dùng spread vì
  // dbCat dùng snake_case (pricing_type), localCat dùng camelCase (pricingType)
  // → spread ...localCat sẽ ghi đè pricingType đúng từ DB bằng giá trị hard-code.
  const dbCat = dbCategories.find((c: any) => c.id === selectedCat);
  const localCat = CATEGORIES.find((c) => c.id === selectedCat);
  const cat = {
    id: selectedCat,
    name: (dbCat?.name as string | undefined) ?? localCat?.name,
    hint: localCat?.hint,
    pricingType: (dbCat?.pricing_type as string | undefined) ?? localCat?.pricingType ?? "fixed",
  };
  const catDisplayName = dbCat ? dbCat.name : localCat?.name || "";

  // === A1: Gợi ý giá tự động ===
  const [priceSuggestion, setPriceSuggestion] = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPriceSuggestion = useCallback(
    async (categoryId: number | null) => {
      if (!categoryId) return;
      setPriceLoading(true);
      try {
        if (abortRef.current) {
          try {
            abortRef.current.abort();
          } catch (e) {}
        }
        const controller = new AbortController();
        abortRef.current = controller;

        const payload: Record<string, any> = { category_id: categoryId };
        if (pickedCoords) {
          payload.latitude = pickedCoords.latitude;
          payload.longitude = pickedCoords.longitude;
          // Cho distance: dùng fallback HCM center làm reference
          payload.reference_latitude = 10.7626;
          payload.reference_longitude = 106.6602;
        }
        if (cat?.pricingType === "hourly") {
          const hours = parseFloat(estimatedHours);
          if (hours > 0) payload.estimated_duration_hours = hours;
        }

        const data = (await getPriceSuggestion(payload)) as any;
        setPriceSuggestion(data);
      } catch (e: any) {
        if (e?.name !== "AbortError" && e?.name !== "CanceledError") {
          console.warn("[A1] Price suggestion error:", e?.message || e);
          setPriceSuggestion(null);
        }
      } finally {
        setPriceLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickedCoords, cat?.pricingType, estimatedHours]
  );

  useEffect(() => {
    if (!selectedCat) {
      setPriceSuggestion(null);
      return;
    }
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      fetchPriceSuggestion(selectedCat);
    }, 400);
    return () => {
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    };
  }, [selectedCat, pickedCoords, fetchPriceSuggestion, estimatedHours]);

  const applySuggestedPrice = () => {
    if (priceSuggestion?.suggested_price) {
      setPrice(String(priceSuggestion.suggested_price));
      clearError("price");
    }
  };

  const priceHintContent = (() => {
    if (priceSuggestion) {
      const { suggested_price, price_range, pricing_type, reason, message } = priceSuggestion;
      if (message) return message;
      if (reason) return reason;
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
    }
    return cat?.hint || "";
  })();

  // Fetch categories từ DB thật (A1)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await getCategories()) as any;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setDbCategories(list);
          // Mặc định chọn category đầu tiên
          setSelectedCat((prev) => prev ?? list[0].id);
        }
      } catch (e: any) {
        console.warn("[A1] Failed to fetch categories:", e?.message || e);
        // Fallback: dùng local CATEGORIES nếu API lỗi
        setSelectedCat((prev) => prev ?? 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    // QA-FIX-UI 3.3: validate theo field, set errors state để hiển thị inline
    const newErrors: Record<string, string> = {};
    if (!title?.trim()) newErrors.title = "Vui lòng nhập tiêu đề nhiệm vụ";
    if (!description?.trim()) newErrors.description = "Vui lòng mô tả nhiệm vụ";
    if (!location?.trim()) newErrors.location = "Vui lòng nhập địa điểm";
    if (!date?.trim()) newErrors.date = "Vui lòng chọn ngày";
    if (!time?.trim()) newErrors.time = "Vui lòng chọn giờ";
    if (!price?.trim()) newErrors.price = "Vui lòng nhập mức thù lao";

    // Validate format nếu field đã có giá trị
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;
    if (date && !dateRegex.test(date)) newErrors.date = "Ngày phải có định dạng YYYY-MM-DD";
    if (time && !timeRegex.test(time)) newErrors.time = "Giờ phải có định dạng HH:MM";

    setErrors(newErrors);

    // Nếu có lỗi → Alert ngắn gọn (giữ Alert chỉ cho tóm tắt, không thay thế
    // cho inline message)
    if (Object.keys(newErrors).length > 0) {
      showAlert(
        "Cần kiểm tra lại thông tin",
        `Vui lòng sửa ${Object.keys(newErrors).length} trường đang lỗi (xem thông báo dưới mỗi ô nhập).`
      );
      return;
    }

    setIsLoading(true);
    try {
      const taskData: Record<string, any> = {
        category: selectedCat,
        title,
        description,
        location,
        scheduled_time: `${date}T${time}:00+07:00`,
        price: parseInt(price, 10),
      };

      // ===== TỌA ĐỘ TỪ MAP PICKER =====
      // Nếu parent đã chọn vị trí trên bản đồ → gán làm toạ độ task
      // VÀ làm tâm vùng geofence (nếu bật) — đúng semantics: vùng an toàn
      // quanh nơi làm việc, không phải quanh vị trí parent hiện tại.
      if (pickedCoords) {
        taskData.latitude = pickedCoords.latitude;
        taskData.longitude = pickedCoords.longitude;
        if (enableGeofence) {
          taskData.geofence_lat = pickedCoords.latitude;
          taskData.geofence_lng = pickedCoords.longitude;
          taskData.geofence_radius = parseFloat(geofenceRadius) || 500;
        }
      } else if (enableGeofence) {
        // Fallback: nếu parent bật geofence nhưng chưa chọn trên map →
        // xin quyền location và dùng vị trí hiện tại (giữ behaviour cũ)
        const granted = await new Promise<boolean>((resolve) => {
          if (!navigator.geolocation) return resolve(false);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              taskData.geofence_lat = pos.coords.latitude;
              taskData.geofence_lng = pos.coords.longitude;
              taskData.geofence_radius = parseFloat(geofenceRadius) || 500;
              resolve(true);
            },
            () => resolve(false),
            { timeout: 8000, enableHighAccuracy: true }
          );
        });
        if (!granted) {
          // RN: Alert 1 nút 'Bỏ qua geofence' → web confirm
          if (
            window.confirm(
              "Cần chọn vị trí trên bản đồ\n\nBạn chưa chọn vị trí trên bản đồ và chưa cấp quyền vị trí. Hãy bấm \"Bản đồ\" để chọn, hoặc cấp quyền vị trí để dùng vị trí hiện tại."
            )
          ) {
            setEnableGeofence(false);
          }
          setIsLoading(false);
          return;
        }
      }

      const res = (await createTask(taskData)) as any;
      const newTaskId = res?.id;
      if (newTaskId) {
        // RN: Alert 2 nút (Xem gợi ý phù hợp / Quay lại) → window.confirm
        if (window.confirm("Thành công!\n\nĐã đăng việc lên cộng đồng.")) {
          nav.replace("SmartMatches", { taskId: newTaskId, taskTitle: taskData.title });
        } else {
          nav.goBack();
        }
      } else {
        // RN: Alert 1 nút OK → goBack
        if (window.confirm("Thành công!\n\nĐã đăng việc lên cộng đồng.")) {
          nav.goBack();
        }
      }
    } catch (error: any) {
      const data = error?.response?.data;
      const msg = typeof data === "object" ? JSON.stringify(data) : "Đăng việc thất bại.";
      showAlert("Lỗi", msg);
    } finally {
      setIsLoading(false);
    }
  };

  // RN nhánh web của handleOpenDatePicker/handleOpenTimePicker (Platform.OS==='web')
  const handleOpenDatePicker = () => {
    const val = window.prompt("Nhập ngày (YYYY-MM-DD):", date || "2026-05-29");
    if (val) {
      setDate(val);
      clearError("date");
    }
  };

  const handleOpenTimePicker = () => {
    const val = window.prompt("Nhập giờ (HH:MM):", time || "12:00");
    if (val) {
      setTime(val);
      clearError("time");
    }
  };

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

        {/* Top App Bar — trắng, back + title + spacer */}
        <div style={{ ...S.appBar, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
          <Touchable onPress={nav.goBack} hitSlop={12} style={S.appBarBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
          </Touchable>
          <span style={{ ...S.appBarTitle, color: COLORS.onSurface }}>Tạo yêu cầu mới</span>
          <div style={{ width: 44 }} />
        </div>

        {/* Scroll content */}
        <div className="edc-scroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: "16px 20px 0" }}>
            {/* Progress Stepper — cosmetic, 3 bước */}
            <div style={S.stepperRow}>
              <div style={{ ...S.stepCircle, ...S.stepCircleActive, background: COLORS.primary }}>
                <span style={{ ...TYPO.caption, color: COLORS.textOnPrimary }}>1</span>
              </div>
              <div style={S.stepLine} />
              <div style={S.stepCircle}>
                <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant }}>2</span>
              </div>
              <div style={S.stepLine} />
              <div style={S.stepCircle}>
                <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant }}>3</span>
              </div>
            </div>

            {/* Section: Loại dịch vụ — chips pill style */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Loại dịch vụ</span>
              <div style={S.chipRow}>
                {CATEGORIES.map((c) => {
                  return (
                    <Touchable
                      key={c.id}
                      style={{
                        ...S.chip,
                        background: selectedCat === c.id ? COLORS.primary : COLORS.surface,
                        borderColor: selectedCat === c.id ? COLORS.primary : COLORS.outlineVariant,
                        ...(selectedCat === c.id ? { boxShadow: SHADOWS.small } : {}),
                      }}
                      onPress={() => setSelectedCat(c.id)}
                      activeOpacity={0.85}
                    >
                      <Icon
                        name={c.iconName}
                        size={16}
                        color={selectedCat === c.id ? "#ffffff" : COLORS.onSurface}
                        style={{ marginRight: 6 }}
                      />
                      <span style={{ ...S.chipText, color: selectedCat === c.id ? COLORS.textOnPrimary : COLORS.onSurface }}>
                        {c.name}
                      </span>
                    </Touchable>
                  );
                })}
              </div>

              {/* Gợi ý giá (A1 — động) */}
              <div style={{ ...S.priceHintBox, background: COLORS.primaryLight, borderColor: COLORS.primarySoft }}>
                {priceLoading ? (
                  <Spinner size={14} color={COLORS.primary} />
                ) : (
                  <Icon name={ic("bulb-outline")} size={14} color={COLORS.primary} />
                )}
                <span style={{ ...S.priceHintText, color: COLORS.primaryDark, fontWeight: 500 }}>
                  {catDisplayName ? `Gợi ý cho ${localCat?.name || catDisplayName}: ` : ""}
                  {priceHintContent}
                </span>
                {priceSuggestion?.suggested_price != null && !priceLoading && (
                  <Touchable
                    onPress={applySuggestedPrice}
                    style={{ ...S.applyPriceBtn, background: COLORS.primary }}
                    hitSlop={6}
                  >
                    <span style={{ ...S.applyPriceBtnText, color: COLORS.textOnPrimary }}>Dùng giá gợi ý</span>
                  </Touchable>
                )}
              </div>
            </div>

            {/* Section: Thông tin chi tiết */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Thông tin chi tiết</span>

              {/* Title */}
              <div style={S.fieldGroup}>
                <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Tiêu đề công việc *</span>
                <div
                  style={{
                    ...S.inputWrapper,
                    background: COLORS.surface,
                    borderColor: COLORS.outlineVariant,
                    ...(errors.title ? S.inputWrapperError : {}),
                  }}
                >
                  <input
                    style={S.input}
                    placeholder="VD: Gia sư Toán lớp 5 mỗi tối 7h"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      clearError("title");
                    }}
                  />
                </div>
                {errors.title && <span style={{ ...S.errorText, color: COLORS.error }}>{errors.title}</span>}
              </div>

              {/* Description */}
              <div style={S.fieldGroup}>
                <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Mô tả chi tiết *</span>
                <div
                  style={{
                    ...S.inputWrapper,
                    ...S.textareaWrapper,
                    background: COLORS.surface,
                    borderColor: COLORS.outlineVariant,
                    ...(errors.description ? S.inputWrapperError : {}),
                  }}
                >
                  <textarea
                    style={S.textarea}
                    placeholder="Mô tả nhu cầu, yêu cầu cụ thể, thời lượng..."
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      clearError("description");
                    }}
                    rows={4}
                  />
                </div>
                {errors.description && <span style={{ ...S.errorText, color: COLORS.error }}>{errors.description}</span>}
              </div>

              {/* Location */}
              <div style={S.fieldGroup}>
                <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Địa điểm *</span>
                <div
                  style={{
                    ...S.inputWrapper,
                    background: COLORS.surface,
                    borderColor: COLORS.outlineVariant,
                    ...(errors.location ? S.inputWrapperError : {}),
                  }}
                >
                  <Icon name="location-outline" size={18} color={COLORS.outlineVariant} style={S.inputIcon} />
                  <input
                    style={S.input}
                    placeholder="VD: 123 Lê Lợi, P. Vĩnh Ninh, TP. Huế"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      clearError("location");
                    }}
                  />
                  <Touchable
                    style={{ ...S.mapPickerBtn, background: COLORS.primaryLight }}
                    onPress={() => setShowMapPicker(true)}
                    hitSlop={8}
                  >
                    <Icon name="map-outline" size={16} color={COLORS.primary} />
                    <span style={{ ...S.mapPickerBtnText, color: COLORS.primary }}>Bản đồ</span>
                  </Touchable>
                </div>
                <Touchable
                  style={{
                    ...S.currentLocBtn,
                    borderColor: COLORS.primary,
                    background: COLORS.primaryLight,
                  }}
                  onPress={handleUseCurrentLocation}
                  disabled={locatingLoading}
                  activeOpacity={0.85}
                >
                  {locatingLoading ? (
                    <Spinner size={16} color={COLORS.primary} />
                  ) : (
                    <Icon name="navigate" size={16} color={COLORS.primary} />
                  )}
                  <span style={{ ...S.currentLocBtnText, color: COLORS.primary }}>
                    {locatingLoading ? "Đang định vị..." : "Chọn vị trí hiện tại"}
                  </span>
                </Touchable>
                {errors.location && <span style={{ ...S.errorText, color: COLORS.error }}>{errors.location}</span>}
                {pickedCoords && (
                  <div style={{ ...S.pickedCoordsInfo, background: COLORS.primaryLight }}>
                    <Icon name="location" size={14} color={COLORS.primary} />
                    <span style={{ ...S.pickedCoordsText, color: COLORS.primaryDark || COLORS.primary }}>
                      {pickedCoords.latitude.toFixed(4)}, {pickedCoords.longitude.toFixed(4)}
                      {pickedCoords.address
                        ? ` — ${pickedCoords.address.substring(0, 60)}${pickedCoords.address.length > 60 ? "..." : ""}`
                        : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Date & Time — 2 columns */}
              <div style={S.twoColRow}>
                <div style={{ ...S.fieldGroup, flex: 1 }}>
                  <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Ngày</span>
                  <Touchable
                    style={{
                      ...S.inputWrapper,
                      background: COLORS.surface,
                      borderColor: COLORS.outlineVariant,
                      ...(errors.date ? S.inputWrapperError : {}),
                    }}
                    onPress={() => {
                      clearError("date");
                      handleOpenDatePicker();
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon name="calendar-outline" size={18} color={COLORS.primary} style={S.inputIcon} />
                    <span style={{ ...S.inputText, color: COLORS.onSurface, ...(date ? {} : { color: COLORS.outline }) }}>
                      {date || "Chọn ngày"}
                    </span>
                  </Touchable>
                  {errors.date && <span style={{ ...S.errorText, color: COLORS.error }}>{errors.date}</span>}
                </div>
                <div style={{ ...S.fieldGroup, flex: 1 }}>
                  <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Giờ</span>
                  <Touchable
                    style={{
                      ...S.inputWrapper,
                      background: COLORS.surface,
                      borderColor: COLORS.outlineVariant,
                      ...(errors.time ? S.inputWrapperError : {}),
                    }}
                    onPress={() => {
                      clearError("time");
                      handleOpenTimePicker();
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon name="time-outline" size={18} color={COLORS.primary} style={S.inputIcon} />
                    <span style={{ ...S.inputText, color: COLORS.onSurface, ...(time ? {} : { color: COLORS.outline }) }}>
                      {time || "Chọn giờ"}
                    </span>
                  </Touchable>
                  {errors.time && <span style={{ ...S.errorText, color: COLORS.error }}>{errors.time}</span>}
                </div>
              </div>

              {/* Price */}
              <div style={S.fieldGroup}>
                <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Giá thỏa thuận (VNĐ)</span>
                <div
                  style={{
                    ...S.inputWrapper,
                    background: COLORS.surface,
                    borderColor: COLORS.outlineVariant,
                    ...(errors.price ? S.inputWrapperError : {}),
                  }}
                >
                  <input
                    style={{ ...S.input, fontWeight: 700, color: COLORS.primary }}
                    placeholder="0"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      clearError("price");
                    }}
                    inputMode="numeric"
                  />
                  <span style={{ ...S.currencyUnit, color: COLORS.onSurfaceVariant }}>VNĐ</span>
                </div>
                {errors.price && <span style={{ ...S.errorText, color: COLORS.error }}>{errors.price}</span>}
              </div>

              {/* Số giờ dự kiến — chỉ hiện khi category loại hourly */}
              {cat?.pricingType === "hourly" && (
                <div style={S.fieldGroup}>
                  <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Số giờ dự kiến</span>
                  <div style={{ ...S.inputWrapper, ...S.durationInputWrapper, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
                    <input
                      style={{ ...S.input, fontWeight: 700, color: COLORS.primary }}
                      placeholder="2"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      inputMode="decimal"
                    />
                    <span style={{ ...S.currencyUnit, color: COLORS.onSurfaceVariant }}>giờ</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Vùng an toàn (Geofence) */}
            <div style={S.section}>
              <span style={{ ...S.sectionTitle, color: COLORS.onSurface }}>Vùng an toàn (tuỳ chọn)</span>
              <Touchable
                style={{
                  ...S.geofenceToggle,
                  background: enableGeofence ? COLORS.primaryLight : COLORS.surface,
                  borderColor: enableGeofence ? COLORS.primary : COLORS.outlineVariant,
                }}
                onPress={() => setEnableGeofence(!enableGeofence)}
                activeOpacity={0.85}
              >
                <div
                  style={{
                    ...S.geofenceCheckbox,
                    borderColor: enableGeofence ? COLORS.primary : COLORS.outline,
                    background: enableGeofence ? COLORS.primary : "transparent",
                  }}
                >
                  {enableGeofence && <Icon name="checkmark" size={16} color="#fff" />}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ ...S.geofenceToggleTitle, color: COLORS.onSurface }}>
                    Yêu cầu theo dõi vị trí Carepartner
                  </span>
                  <span style={{ ...S.geofenceToggleDesc, color: COLORS.onSurfaceVariant }}>
                    Carepartner phải đồng ý chia sẻ vị trí mới được nhận việc. Bạn sẽ nhận chuông cảnh báo khi họ
                    rời vùng an toàn.
                  </span>
                </div>
              </Touchable>

              {enableGeofence && (
                <div style={S.geofenceSettings}>
                  <span style={{ ...S.fieldLabel, color: COLORS.onSurfaceVariant }}>Bán kính vùng an toàn (mét)</span>
                  <div style={{ ...S.inputWrapper, background: COLORS.surface, borderColor: COLORS.outlineVariant }}>
                    <Icon name="map-outline" size={18} color={COLORS.primary} style={S.inputIcon} />
                    <input
                      style={{ ...S.input, fontWeight: 700, color: COLORS.primary }}
                      placeholder="500"
                      value={geofenceRadius}
                      onChange={(e) => setGeofenceRadius(e.target.value)}
                      inputMode="numeric"
                    />
                    <span style={{ ...S.currencyUnit, color: COLORS.onSurfaceVariant }}>mét</span>
                  </div>
                  <span style={{ ...S.geofenceHint, color: COLORS.onSurfaceVariant }}>
                    Khuyến nghị: 300-1000m. Tâm vùng sẽ dùng toạ độ từ bản đồ nếu đã chọn, nếu không sẽ dùng vị trí
                    hiện tại của bạn.
                  </span>
                </div>
              )}
            </div>

            <div style={{ height: 100 }} />
          </div>
        </div>

        {/* Sticky footer — submit button */}
        <div style={{ ...S.footer, background: COLORS.surface, borderTop: `1px solid ${COLORS.outlineVariant}` }}>
          <Touchable
            style={{ ...S.submitBtn, background: COLORS.primary, ...(isLoading ? { opacity: 0.7 } : {}) }}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <Spinner size={24} color="#fff" />
            ) : (
              <>
                <span style={{ ...S.submitText, color: COLORS.textOnPrimary }}>Đăng lên cộng đồng</span>
                <Icon name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </Touchable>
        </div>

        {/* Map Picker Modal — chọn toạ độ từ bản đồ (iframe Leaflet) */}
        <MapPickerModalWeb
          visible={showMapPicker}
          onPick={(coords) => {
            setPickedCoords(coords);
            // Auto-fill location text if address available from reverse geocoding
            if (coords.address) {
              setLocation(coords.address);
              clearError("location");
            }
          }}
          onClose={() => setShowMapPicker(false)}
        />
      </div>
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  // === APP BAR ===
  appBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "32px 12px 12px",
    background: COLORS.surface,
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
  appBarTitle: { ...TYPO.h3, flex: 1, textAlign: "center" },
  // === STEPPER ===
  stepperRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    padding: "0 40px",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    background: COLORS.surfaceContainer,
    border: `1px solid ${COLORS.outlineVariant}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  },
  stepCircleActive: { borderWidth: 0, boxShadow: SHADOWS.medium },
  stepLine: { flex: 1, height: 2, background: COLORS.outlineVariant, margin: "0 -4px", zIndex: -1 },
  // === SECTIONS ===
  section: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 },
  sectionTitle: { ...TYPO.h4 },
  // === CHIPS ===
  chipRow: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "8px 16px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
  },
  chipText: { ...TYPO.body, fontSize: 14 },
  priceHintBox: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderStyle: "solid",
  },
  priceHintText: { flex: 1, minWidth: 0, ...TYPO.bodySmall },
  applyPriceBtn: { background: COLORS.primary, borderRadius: 999, padding: "4px 12px", flexShrink: 0 },
  applyPriceBtnText: { ...TYPO.caption },
  // === FIELD GROUP ===
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8 },
  fieldLabel: { ...TYPO.caption, fontWeight: 400 },
  // === INPUT WRAPPER ===
  inputWrapper: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 14,
    padding: "0 14px",
    height: 48,
    boxSizing: "border-box",
  },
  inputWrapperError: { borderColor: COLORS.error, borderWidth: 2, padding: "0 13px" },
  errorText: { ...TYPO.caption, fontWeight: 400, marginTop: 6, marginLeft: 4 },
  inputIcon: { marginRight: 10, flexShrink: 0 },
  input: {
    flex: 1,
    minWidth: 0,
    ...TYPO.body,
    color: COLORS.onSurface,
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
  },
  inputText: { ...TYPO.body },
  durationInputWrapper: { width: 140 },
  currencyUnit: { ...TYPO.caption, fontWeight: 700, marginLeft: 8, flexShrink: 0 },
  textareaWrapper: { height: "auto", minHeight: 110, alignItems: "flex-start", padding: "12px 14px" },
  textarea: {
    minHeight: 86,
    flex: 1,
    ...TYPO.body,
    lineHeight: "22px",
    color: COLORS.onSurface,
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
    resize: "vertical",
    width: "100%",
  },
  // === TWO COLUMN ===
  twoColRow: { display: "flex", flexDirection: "row", gap: 12 },
  // === GEOFENCE ===
  geofenceToggle: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    padding: 14,
  },
  geofenceCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderStyle: "solid",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    flexShrink: 0,
    boxSizing: "border-box",
  },
  geofenceToggleTitle: { ...TYPO.body, fontSize: 14, fontWeight: 700, marginBottom: 4, display: "block" },
  geofenceToggleDesc: { ...TYPO.caption, fontWeight: 400, lineHeight: "18px", display: "block" },
  geofenceSettings: { display: "flex", flexDirection: "column", gap: 8 },
  geofenceHint: { ...TYPO.caption, fontWeight: 400, fontStyle: "italic" },
  // === MAP PICKER (trong form) ===
  mapPickerBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    borderRadius: 8,
    marginLeft: 8,
    flexShrink: 0,
  },
  mapPickerBtnText: { ...TYPO.caption, fontWeight: 600 },
  currentLocBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    padding: "10px 16px",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
  },
  currentLocBtnText: { ...TYPO.caption, fontWeight: 600 },
  pickedCoordsInfo: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 8,
  },
  pickedCoordsText: {
    flex: 1,
    minWidth: 0,
    ...TYPO.caption,
    fontWeight: 400,
    lineHeight: "18px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // === FOOTER ===
  footer: { padding: "20px 20px 36px" },
  submitBtn: {
    borderRadius: 14,
    height: 52,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    boxShadow: SHADOWS.large,
  },
  submitText: { ...TYPO.h4 },
  // === MAP PICKER MODAL (web) ===
  mapHeader: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 8px 12px",
    background: COLORS.surface,
  },
  mapHeaderBtn: { width: 44, height: 44, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  mapHeaderTitle: { ...TYPO.h4, fontWeight: 700 },
  mapSearchBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "12px 16px",
    gap: 8,
  },
  mapSearchInputWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 12,
    padding: "0 12px",
    height: 44,
  },
  mapSearchInput: {
    flex: 1,
    minWidth: 0,
    ...TYPO.body,
    color: COLORS.onSurface,
    border: "none",
    outline: "none",
    background: "transparent",
    padding: 0,
  },
  mapCurrentLocBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "solid",
    flexShrink: 0,
  },
  mapFooter: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    padding: "12px 16px",
    gap: 12,
  },
  mapPickedInfo: { flex: 1, minWidth: 0 },
  mapConfirmBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    padding: "0 20px",
    height: 48,
    boxShadow: SHADOWS.large,
    flexShrink: 0,
  },
};

export default CreateTaskScreen;
