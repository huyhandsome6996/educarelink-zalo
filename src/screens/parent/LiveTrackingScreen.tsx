/**
 * LiveTrackingScreen — port CHÍNH XÁC mobile/src/screens/Parent/LiveTrackingScreen.js (1207 dòng).
 * Màn GPS theo dõi Carepartner trực tiếp (parent stack), params { taskId, taskTitle,
 * taskLatitude, taskLongitude, workerPhone }.
 *
 * Polling giữ nguyên RN: live location 5s (POLL_INTERVAL_MS), device-status 10s
 * (DEVICE_STATUS_POLL_MS), verification history 30s (RN dòng 370) — clearInterval khi unmount.
 * 30s poll mở rộng (theo spec port, RN import nhưng không gọi): getSOSAlerts +
 * getOfflineAlerts + getLocationHistory (đường di chuyển cho map tĩnh).
 *
 * PLATFORM ADAPTATION (ghi mobile-parity-map.md):
 * - MAP: RN dùng react-native-maps / WebView Leaflet (buildMapHtml với OSM tile).
 *   Web không có Google Maps key → MAP TĨNH TỰ VẼ: div nền #e8eaed + grid đường phố CSS
 *   (giống mapVisual/mapStreet/mapGrid của RN) + marker Carepartner/Nhà bạn + ring geofence
 *   500m (GEOFENCE_RADIUS) + đường di chuyển SVG polyline từ getLocationHistory.
 *   Có toạ độ thật → chiếu tuyến tính (meters→px, tỉ lệ đều) để marker/đường đúng vị trí
 *   tương đối; không có toạ độ → fallback đúng layout % cố định của RN (33%/22%…).
 *   // PLATFORM ADAPTATION: RN maps -> static map simulation — KHÔNG dùng API key ngoài.
 * - expo-notifications listener + EmergencyAlarmService (expo-av) → không có trên web:
 *   alarm = HTMLAudio loop best-effort (tự động bỏ qua nếu autoplay bị chặn) + navigator.vibrate.
 *   Push listener bỏ (web không có push) — polling device-status đã phủ luồng device_offline.
 * - iOS Critical Alert banner bỏ (Platform.OS === 'ios' của expo — lý do entitlement/Focus
 *   không áp dụng cho webview; bản RN cũng chỉ render trên iOS).
 * - Alert.alert nhiều nút → window.confirm / showAlert (1 nút) của ui.tsx.
 * - "Xem ảnh" xác minh: blob qua fetchVerificationPhotoUrl + preview overlay ngay trong màn
 *   (RN navigate('ImagePreview') — route ImagePreview do agent khác sở hữu, còn stub).
 * - Nút "Gọi" trong bottom sheet: RN không gắn onPress (no-op) — theo Fix H14 + spec port,
 *   wire `tel:${workerPhone}` khi có số; thêm dòng hotline khẩn cấp 0862427404.
 * - Icon thiếu trong bộ 159 glyph → fallback gần nghĩa cục bộ (ic()).
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, showAlert, StatusBarSpacer } from "@/components/ui";
import { COLORS, SHADOWS, SIZES, TYPO, ANIM } from "@/theme";
import { useNav } from "@/navigation/router";
import { useAuth } from "@/context/AuthContext";
import {
  getLiveLocation,
  getLocationHistory,
  triggerSOS,
  getDeviceStatus,
  getOfflineAlerts,
  acknowledgeOfflineAlert,
  getSOSAlerts,
  resolveSOS,
  getVerificationHistory,
  cancelVerificationCheck,
  fetchVerificationPhotoUrl,
} from "@/api/tracking";

const POLL_INTERVAL_MS = 5000; // Parent poll location mỗi 5s (giống RN)
const DEVICE_STATUS_POLL_MS = 10000; // Parent poll device status mỗi 10s (giống RN)
const SLOW_POLL_MS = 30000; // Verification history 30s (RN dòng 370) + SOS/offline/history (mở rộng theo spec)
const GEOFENCE_RADIUS = 500; // mét (giống RN)

/** Glyph thiếu trong ionicons.ts 159 glyph → fallback gần nghĩa (không sửa ionicons.ts) */
const ic = (name: string) =>
  ({
    call: "call-outline",
    chatbubble: "chatbubble-ellipses",
    image: "images-outline",
  } as Record<string, string>)[name] ?? name;

/* ---------------- Types (shape theo backend tracking/services.py) ---------------- */
interface LiveLocationData {
  is_tracking?: boolean;
  location?: {
    latitude?: string | number;
    longitude?: string | number;
    speed?: string | number | null;
    accuracy?: string | number | null;
    is_outside_geofence?: boolean;
  } | null;
  message?: string;
  is_stale?: boolean;
  is_offline?: boolean;
  last_seen?: string | null;
  offline_threshold_seconds?: number;
}
interface DeviceStatusData {
  has_heartbeat?: boolean;
  is_offline?: boolean;
  seconds_since_last_seen?: number;
  battery_level?: number | null;
  last_location?: { latitude?: number | null; longitude?: number | null } | null;
  last_seen?: string | null;
  active_alerts?: Array<{ id: number | string; status?: string }>;
}
interface VerificationCheck {
  id: number | string;
  status?: string;
  verification_type?: string;
  triggered_at?: string;
  attempts?: number;
  consecutive_timeouts_count?: number;
  has_photo?: boolean;
  photo_submitted_at?: string | null;
}
interface SosAlertItem {
  id: number | string;
  status?: string; // 'active' | 'resolved'
  message?: string;
  created_at?: string;
}
interface OfflineAlertItem {
  id: number | string;
  status?: string; // 'active' | 'acknowledged' | 'recovered'
  last_seen?: string | null;
  last_location?: { latitude?: number | null; longitude?: number | null } | null;
  created_at?: string;
}
interface HistoryPoint {
  id?: number | string;
  latitude: number | string;
  longitude: number | string;
  recorded_at?: string;
}

interface LatLng {
  lat: number;
  lng: number;
}

const LiveTrackingScreen: React.FC<{
  taskId?: string;
  taskTitle?: string;
  taskLatitude?: string | number;
  taskLongitude?: string | number;
  workerPhone?: string;
}> = ({ taskId, taskTitle, taskLatitude, taskLongitude, workerPhone }) => {
  const nav = useNav();
  const { user } = useAuth();
  const isParent = user?.role === "parent"; // resolveSOS chỉ hiện cho phụ huynh (theo spec port)

  // QA-FIX-UI 3.2: fade-in animation khi mount (RN Animated.timing → CSS transition)
  const [faded, setFaded] = useState(false);

  const [liveData, setLiveData] = useState<LiveLocationData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [offlineAlertActive, setOfflineAlertActive] = useState(false);
  // QA-FIX-2 / B3: track trạng thái offline/stale từ API để hiển thị rõ
  // "vị trí cuối cùng lúc X" thay vì giả như vị trí live khi carepartner mất mạng.
  const [isLocationStale, setIsLocationStale] = useState(false);
  const [isLocationOffline, setIsLocationOffline] = useState(false);
  const [offlineThresholdSeconds, setOfflineThresholdSeconds] = useState<number | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([]);
  const [verificationExpanded, setVerificationExpanded] = useState(false);
  // Mở rộng theo spec port: SOS alerts + offline alerts history + location history (path)
  const [sosAlerts, setSosAlerts] = useState<SosAlertItem[]>([]);
  const [offlineAlertsHistory, setOfflineAlertsHistory] = useState<OfflineAlertItem[]>([]);
  const [locationHistory, setLocationHistory] = useState<HistoryPoint[]>([]);
  const [photoPreview, setPhotoPreview] = useState<{ uri: string; title: string } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceStatusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAlertIdRef = useRef<number | string | null>(null);
  const mountedRef = useRef(true);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

  /* ---- EmergencyAlarmService → HTMLAudio loop best-effort (PLATFORM ADAPTATION) ---- */
  const playEmergencyAlarm = useCallback(() => {
    try {
      if (!alarmAudioRef.current) {
        const audio = new Audio("/static/sounds/police_siren.mp3");
        audio.loop = true;
        alarmAudioRef.current = audio;
      }
      alarmAudioRef.current.currentTime = 0;
      const p = alarmAudioRef.current.play();
      if (p && typeof p.catch === "function") p.catch(() => {}); // autoplay policy — bỏ qua
    } catch {
      /* webview không hỗ trợ audio — im lặng */
    }
  }, []);
  const stopEmergencyAlarm = useCallback(() => {
    try {
      alarmAudioRef.current?.pause();
    } catch {
      /* ignore */
    }
  }, []);
  const unloadEmergencyAlarm = useCallback(() => {
    try {
      alarmAudioRef.current?.pause();
      alarmAudioRef.current = null;
    } catch {
      /* ignore */
    }
  }, []);

  // Trigger alarm sound + vibration khi có offline alert mới
  // (RN: EmergencyAlarmService + Vibration + local notification — web: audio loop + vibrate)
  const triggerAlarmSound = useCallback(() => {
    try {
      playEmergencyAlarm();
      // Vibration pattern khẩn cấp: 1s rung, 0.5s nghỉ, lặp 5 lần (như RN)
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000]);
      }
    } catch (e) {
      console.warn("triggerAlarmSound failed:", e);
    }
  }, [playEmergencyAlarm]);

  // Fade-in khi mount (RN Animated.timing ANIM.timingNormal)
  useEffect(() => {
    const r = requestAnimationFrame(() => setFaded(true));
    return () => {
      cancelAnimationFrame(r);
      mountedRef.current = false;
      // QA-FIX-1 / Spec 2.6: stop + unload alarm khi unmount screen
      stopEmergencyAlarm();
      unloadEmergencyAlarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll live location (5s)
  // QA-FIX-2 / B3: parse thêm is_stale/is_offline/last_seen từ response
  const fetchLive = useCallback(async () => {
    if (!taskId) return;
    try {
      // zalo api trả data trực tiếp (RN đọc res.data)
      const data = (await getLiveLocation(taskId)) as LiveLocationData;
      if (!mountedRef.current) return;
      setLiveData(data);
      setLastUpdate(new Date());
      setError(null);
      setIsLocationStale(data?.is_stale || false);
      setIsLocationOffline(data?.is_offline || false);
      if (data?.offline_threshold_seconds) {
        setOfflineThresholdSeconds(data.offline_threshold_seconds);
      }
    } catch (e: any) {
      console.warn("fetchLive error:", e?.response?.status);
      if (e?.response?.status === 403) {
        setError("Bạn không có quyền xem vị trí task này.");
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [taskId]);

  // Poll device status (online/offline + alert) — 10s
  const fetchDeviceStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const status = (await getDeviceStatus(taskId)) as DeviceStatusData;
      if (!mountedRef.current) return;
      setDeviceStatus(status);

      // Detect offline alert mới → chuông kêu (Fix H14/Phan 2 như RN)
      const activeAlert = status.active_alerts?.[0];
      if (activeAlert && activeAlert.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = activeAlert.id;
        setOfflineAlertActive(true);
        // DeviceOfflineAlert LUÔN LUÔN là cảnh báo khẩn cấp (isCritical=true) — invariant hệ thống an toàn
        triggerAlarmSound();
      } else if (!activeAlert) {
        setOfflineAlertActive(false);
      }
    } catch (e: any) {
      console.warn("fetchDeviceStatus error:", e?.response?.status);
    }
  }, [taskId, triggerAlarmSound]);

  // Phan 2 — gọi API acknowledge để dừng retry push ở backend
  // QA-FIX-1 / Spec 2.6: cũng stop alarm audio khi parent acknowledge
  const handleAcknowledgeAlert = useCallback(
    async (alertId?: number | string) => {
      if (!alertId || !taskId) return;
      try {
        stopEmergencyAlarm(); // stop alarm NGAY khi parent bấm "Đã biết"
        await acknowledgeOfflineAlert(taskId, alertId);
        if (!mountedRef.current) return;
        setOfflineAlertActive(false);
        console.log(`[LiveTracking] Acknowledged alert #${alertId} — backend sẽ dừng retry push + alarm stopped`);
      } catch (e: any) {
        console.warn(`[LiveTracking] Acknowledge alert #${alertId} failed:`, e?.response?.status || e.message);
      }
    },
    [taskId, stopEmergencyAlarm]
  );

  useEffect(() => {
    if (!taskId) {
      // Deep-link không có params — không quay vòng loading vô hạn (RN không gặp case này)
      setError("Không tìm thấy thông tin công việc.");
      setIsLoading(false);
      return;
    }
    fetchLive();
    fetchDeviceStatus();
    pollRef.current = setInterval(fetchLive, POLL_INTERVAL_MS);
    deviceStatusPollRef.current = setInterval(fetchDeviceStatus, DEVICE_STATUS_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (deviceStatusPollRef.current) clearInterval(deviceStatusPollRef.current);
    };
  }, [fetchLive, fetchDeviceStatus, taskId]);

  const handleSOS = () => {
    // RN Alert.alert 2 nút ('Huỷ'/'Gửi SOS') → window.confirm (web 1 nút OK/Cancel)
    if (!window.confirm("Gửi SOS khẩn cấp cho Carepartner? Họ sẽ nhận thông báo ngay.")) return;
    (async () => {
      setSosLoading(true);
      try {
        await triggerSOS({ task_id: taskId, message: "Phụ huynh cần hỗ trợ khẩn cấp!" });
        showAlert("✅ Đã gửi", "SOS đã được gửi tới Carepartner.");
      } catch (e) {
        showAlert("Lỗi", "Không thể gửi SOS. Vui lòng gọi điện trực tiếp.");
      } finally {
        setSosLoading(false);
      }
    })();
  };

  // === VERIFICATION PIN HISTORY (30s) ===
  const fetchVerificationHistory = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = (await getVerificationHistory(taskId)) as { checks?: VerificationCheck[] };
      if (mountedRef.current) setVerificationChecks(res?.checks || []);
    } catch (e) {
      // 403 = not parent — ignore silently
    }
  }, [taskId]);

  // B5 — phụ huynh xem ảnh xác minh CarePartner đã nộp.
  // Ảnh KHÔNG public qua /media/ — phải load qua API có auth → blob URL (PLATFORM ADAPTATION
  // của expo-image headers; RN navigate ImagePreview — web render overlay ngay trong màn).
  const handleViewVerificationPhoto = useCallback(async (check: VerificationCheck) => {
    try {
      const uri = await fetchVerificationPhotoUrl(check.id);
      setPhotoPreview({ uri, title: `Ảnh xác minh — ${new Date(check.triggered_at || Date.now()).toLocaleString("vi-VN")}` });
    } catch (e) {
      showAlert("Lỗi", "Không tải được ảnh xác minh. Vui lòng thử lại.");
    }
  }, []);

  const handleCancelCheck = useCallback(
    async (checkId: number | string) => {
      try {
        await cancelVerificationCheck(checkId);
        fetchVerificationHistory();
      } catch (e) {
        /* silent */
      }
    },
    [fetchVerificationHistory]
  );

  /* ---- Mở rộng theo spec port: SOS alerts + offline alerts + location history (30s) ---- */
  const fetchSosAlerts = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = (await getSOSAlerts(taskId)) as SosAlertItem[];
      if (mountedRef.current) setSosAlerts(Array.isArray(res) ? res : []);
    } catch (e) {
      /* 403 non-parent — ignore */
    }
  }, [taskId]);

  const fetchOfflineAlertsHistory = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = (await getOfflineAlerts(taskId)) as { alerts?: OfflineAlertItem[] };
      if (!mountedRef.current) return;
      const alerts = res?.alerts || [];
      setOfflineAlertsHistory(alerts);
      // Alert 'active' chưa ack (chưa thấy qua device-status) → báo động như RN
      const active = alerts.find((a) => a.status === "active");
      if (active && active.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = active.id;
        setOfflineAlertActive(true);
        triggerAlarmSound();
      }
    } catch (e) {
      /* ignore */
    }
  }, [taskId, triggerAlarmSound]);

  const fetchLocationHistory = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = (await getLocationHistory(taskId)) as HistoryPoint[];
      if (mountedRef.current) setLocationHistory(Array.isArray(res) ? res : []);
    } catch (e) {
      /* ignore — path chỉ là layer trực quan */
    }
  }, [taskId]);

  const handleResolveSOS = useCallback(
    async (sosId: number | string) => {
      try {
        await resolveSOS(sosId);
        showAlert("✅ Đã giải quyết", "SOS đã được đánh dấu đã xử lý.");
        fetchSosAlerts();
      } catch (e) {
        showAlert("Lỗi", "Không thể giải quyết SOS.");
      }
    },
    [fetchSosAlerts]
  );

  // Poll chậm 30s: verification history (RN) + SOS/offline/history (mở rộng)
  // RN chỉ poll verification khi isTracking — giữ điều kiện đó cho toàn bộ nhóm.
  const isTrackingNow = !!liveData?.is_tracking;
  useEffect(() => {
    if (!taskId || !isTrackingNow) return;
    fetchVerificationHistory();
    fetchSosAlerts();
    fetchOfflineAlertsHistory();
    fetchLocationHistory();
    const iv = setInterval(() => {
      fetchVerificationHistory();
      fetchSosAlerts();
      fetchOfflineAlertsHistory();
      fetchLocationHistory();
    }, SLOW_POLL_MS);
    return () => clearInterval(iv);
  }, [taskId, isTrackingNow, fetchVerificationHistory, fetchSosAlerts, fetchOfflineAlertsHistory, fetchLocationHistory]);

  const getStatusConfig = (status?: string, verificationType?: string) => {
    // B5 — label khác nhau cho check ảnh: 'Đúng mã' → 'Đã gửi ảnh'
    const isPhoto = verificationType === "photo";
    switch (status) {
      case "confirmed":
        return isPhoto
          ? { icon: "📷", label: "Đã gửi ảnh", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" }
          : { icon: "✅", label: "Đúng mã", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
      case "wrong_code":
        return { icon: "❌", label: "Sai mã", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
      case "timeout":
        return isPhoto
          ? { icon: "⏰", label: "Không gửi ảnh", color: "#d97706", bg: "#fffbeb", border: "#fde68a" }
          : { icon: "⏰", label: "Timeout", color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
      case "cancelled":
        return { icon: "🚫", label: "Đã huỷ", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" };
      default:
        return isPhoto
          ? { icon: "⏳", label: "Đang chờ ảnh...", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" }
          : { icon: "⏳", label: "Đang chờ", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
    }
  };

  /* ================= MAP TĨNH TỰ VẼ (PLATFORM ADAPTATION) =================
   // PLATFORM ADAPTATION: RN maps -> static map simulation
   - Có ≥2 điểm phân biệt (history + worker + parent) → chiếu tuyến tính meters→px
     (tỉ lệ đều 2 trục, padding 25%), geofence ring đúng tỉ lệ 500m.
   - Không đủ điểm → fallback đúng layout % cố định của RN
     (worker 33%/22%, parent 50%/50%, geofence 200×200). */
  const mapVisualRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState<{ w: number; h: number } | null>(null);

  const isTracking = liveData?.is_tracking;
  const location = liveData?.location;

  /* Đo kích thước mapVisual để chiếu toạ độ (chỉ attach khi map đang render) */
  const mapMounted = !!(isTracking && location);
  useEffect(() => {
    if (!mapMounted) return;
    const el = mapVisualRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setMapSize((prev) => (prev && prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapMounted]);

  const mapGeom = useMemo(() => {
    const parseNum = (v: any): number | null => {
      const n = parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    const worker: LatLng | null =
      isTracking && location
        ? (() => {
            const lat = parseNum(location.latitude);
            const lng = parseNum(location.longitude);
            return lat != null && lng != null ? { lat, lng } : null;
          })()
        : null;
    const pLat = parseNum(taskLatitude);
    const pLng = parseNum(taskLongitude);
    const parent: LatLng | null = pLat != null && pLng != null ? { lat: pLat, lng: pLng } : null;

    const hist: LatLng[] = locationHistory
      .map((h) => ({ lat: parseNum(h.latitude), lng: parseNum(h.longitude) }))
      .filter((p): p is LatLng => p.lat != null && p.lng != null);

    if (!worker) return null; // không render map

    const all: LatLng[] = [...hist, worker, ...(parent ? [parent] : [])];
    const distinct = new Set(all.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`));

    // Fallback layout % cố định của RN khi không đủ hình học
    const fixed = {
      mode: "fixed" as const,
      worker: { top: "33%", left: "22%" },
      parent: { top: "50%", left: "50%" },
      geoR: 100, // 200×200 px như RN
      path: [] as Array<{ x: number; y: number }>,
    };
    if (!mapSize || distinct.size < 2) return fixed;

    const lats = all.map((p) => p.lat);
    const lngs = all.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    // meters → px, tỉ lệ đều 2 trục (không méo hình)
    const spanM = Math.max((maxLng - minLng) * 111320 * Math.cos((centerLat * Math.PI) / 180), (maxLat - minLat) * 110540, 80);
    const scale = Math.min(mapSize.w, mapSize.h) / (spanM * 1.5); // padding 25% mỗi bên
    const midMLat = ((minLat + maxLat) / 2 - minLat) * 110540;
    const midMLng = ((minLng + maxLng) / 2 - minLng) * 111320 * Math.cos((centerLat * Math.PI) / 180);
    const project = (p: LatLng) => ({
      x: (p.lng - minLng) * 111320 * Math.cos((centerLat * Math.PI) / 180) * scale - midMLng * scale + mapSize.w / 2,
      y: mapSize.h / 2 - ((p.lat - minLat) * 110540 * scale - midMLat * scale),
    });
    const geoR = Math.min(GEOFENCE_RADIUS * scale, Math.min(mapSize.w, mapSize.h) * 0.45);
    return {
      mode: "projected" as const,
      worker: project(worker),
      parent: parent ? project(parent) : null,
      geoR,
      path: [...hist.map(project), project(worker)],
    };
  }, [isTracking, location, locationHistory, taskLatitude, taskLongitude, mapSize]);

  /* ================= LOADING STATE (RN exact) ================= */
  if (isLoading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", justifyContent: "center", alignItems: "center", background: COLORS.surfaceWarm, gap: 12 }}>
        <Spinner size={30} color={COLORS.primary} />
        <div style={{ ...TYPO.body, color: COLORS.onSurfaceVariant }}>Đang tải vị trí...</div>
      </div>
    );
  }

  /* ================= ERROR STATE (RN exact) ================= */
  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: COLORS.surfaceWarm }}>
        <StatusBarSpacer />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `32px 12px 14px`, background: COLORS.surface, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
          <Touchable onPress={nav.goBack} style={{ width: 44, height: 44, borderRadius: 22, background: COLORS.surfaceContainer, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
          </Touchable>
          <div style={{ ...TYPO.h4, color: COLORS.onSurface, fontWeight: 700 }}>Theo dõi CarePartner</div>
          <div style={{ width: 44 }} />
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: 32, minHeight: "70vh" }}>
          <Icon name="alert-circle-outline" size={48} color={COLORS.error} />
          <div style={{ ...TYPO.h5, color: COLORS.errorDeep }}>Không thể xem vị trí</div>
          <div style={{ ...TYPO.bodySmall, color: COLORS.onSurfaceVariant, textAlign: "center" }}>{error}</div>
        </div>
      </div>
    );
  }

  type BannerAlert = {
    id: number | string;
    last_seen?: string | null;
    last_location?: { latitude?: number | null; longitude?: number | null } | null;
  };
  const bannerAlert: BannerAlert | null =
    deviceStatus?.active_alerts?.[0] ?? offlineAlertsHistory.find((a) => a.status === "active") ?? null;
  const bannerLastSeen: string | null = deviceStatus?.last_seen ?? (bannerAlert as OfflineAlertItem | undefined)?.last_seen ?? null;
  const bannerLat: number | null =
    deviceStatus?.last_location?.latitude ?? (bannerAlert as OfflineAlertItem | undefined)?.last_location?.latitude ?? null;
  const bannerLng: number | null =
    deviceStatus?.last_location?.longitude ?? (bannerAlert as OfflineAlertItem | undefined)?.last_location?.longitude ?? null;
  const bannerSeconds: number | null =
    deviceStatus?.seconds_since_last_seen ??
    (bannerLastSeen ? Math.max(0, Math.floor((Date.now() - new Date(bannerLastSeen).getTime()) / 1000)) : null);
  const showOfflineBanner = offlineAlertActive && !!bannerAlert;

  const fmtTime = (d?: Date | null) => (d ? d.toLocaleTimeString("vi-VN") : "");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: COLORS.surfaceWarm,
        opacity: faded ? 1 : 0,
        transition: `opacity ${ANIM.timingNormal}ms`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StatusBarSpacer />

      {/* Top App Bar — trắng theo Warm Professionalism (RN exact) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px 14px",
          background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.outlineVariant}`,
        }}
      >
        <Touchable
          onPress={nav.goBack}
          style={{ width: 44, height: 44, borderRadius: 22, background: COLORS.surfaceContainer, display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          <Icon name="arrow-back" size={22} color={COLORS.onSurface} />
        </Touchable>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...TYPO.h4, color: COLORS.onSurface, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {taskTitle || `Task #${taskId}`}
          </div>
          {/*
            QA-FIX-2 / B3: hiển thị trạng thái rõ ràng cho phụ huynh:
              - LIVE (online, cập nhật < 30s): "● LIVE · cập nhật HH:MM:SS"
              - STALE (online nhưng vị trí cũ > 30s): "● VỊ TRÍ CUỐI · cập nhật HH:MM:SS"
              - OFFLINE (vượt ngưỡng cấu hình): "● MẤT TÍN HIỆU · lần cuối HH:MM:SS"
          */}
          <div style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, marginTop: 2 }}>
            {isLocationOffline
              ? `● MẤT TÍN HIỆU · lần cuối ${liveData?.last_seen ? new Date(liveData.last_seen).toLocaleTimeString("vi-VN") : ""}`
              : isLocationStale
              ? `● VỊ TRÍ CUỐI · cập nhật ${liveData?.last_seen ? new Date(liveData.last_seen).toLocaleTimeString("vi-VN") : fmtTime(lastUpdate)}`
              : isTracking
              ? "● LIVE · cập nhật " + fmtTime(lastUpdate)
              : "Không có dữ liệu"}
          </div>
        </div>
        <div
          style={{
            background: !isTracking && !isLocationOffline && !isLocationStale
              ? COLORS.outlineVariant
              : isLocationOffline
              ? COLORS.error
              : isLocationStale && !isLocationOffline
              ? COLORS.warning
              : COLORS.secondary,
            borderRadius: 6,
            padding: "4px 8px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: !isTracking && !isLocationOffline && !isLocationStale ? COLORS.onSurfaceVariant : COLORS.textOnPrimary,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 0.5,
            }}
          >
            {isLocationOffline ? "OFFLINE" : isLocationStale ? "STALE" : isTracking ? "LIVE" : "OFF"}
          </span>
        </div>
      </div>

      {/* === DEVICE OFFLINE ALERT BANNER — cảnh báo khẩn cấp (RN exact) === */}
      {showOfflineBanner && (
        <div
          style={{
            background: COLORS.errorDeep,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderBottom: "2px solid #93000a",
            boxShadow: SHADOWS.large,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="warning" size={28} color="#fff" />
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.textOnPrimary, ...TYPO.h4, fontWeight: 900, fontSize: 16 }}>🚨 THIẾT BỊ MẤT KẾT NỐI!</div>
              <div style={{ color: "rgba(255,255,255,0.95)", ...TYPO.bodySmall, marginTop: 2 }}>
                Carepartner đã ngừng gửi tín hiệu. Có thể thiết bị bị tắt, mất mạng hoặc đập máy.
              </div>
            </div>
          </div>
          {(bannerLat != null || bannerLng != null) && (
            <div style={{ color: COLORS.textOnPrimary, ...TYPO.caption, fontStyle: "italic" }}>
              📍 Vị trí cuối: {bannerLat != null ? bannerLat.toFixed(5) : "?"}, {bannerLng != null ? bannerLng.toFixed(5) : "?"}
            </div>
          )}
          {bannerLastSeen && (
            <div style={{ color: "rgba(255,255,255,0.85)", ...TYPO.caption }}>
              ⏰ Lần cuối online: {new Date(bannerLastSeen).toLocaleString("vi-VN")} ({bannerSeconds ?? "?"}s trước)
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {/* Phan 2: "Đã biết" acknowledge → stop alarm + API acknowledge → backend dừng retry push */}
            <Touchable
              onPress={() => handleAcknowledgeAlert(bannerAlert?.id)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: COLORS.surface,
                borderRadius: SIZES.radiusSm,
                padding: "10px 0",
                border: `1.5px solid ${COLORS.errorDeep}`,
              }}
            >
              <Icon name="checkmark-circle" size={16} color={COLORS.errorDeep} />
              <span style={{ color: COLORS.errorDeep, ...TYPO.buttonSmall, fontWeight: 800 }}>Đã biết</span>
            </Touchable>
            <Touchable
              onPress={() => (window.location.href = "tel:113")}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff", borderRadius: SIZES.radiusSm, padding: "10px 0" }}
            >
              <Icon name={ic("call")} size={16} color="#fff" />
              <span style={{ color: COLORS.textOnPrimary, ...TYPO.buttonSmall, fontWeight: 800 }}>Gọi 113</span>
            </Touchable>
            {/* Fix H14: chỉ mở dialer khi có số carepartner */}
            {workerPhone && (
              <Touchable
                onPress={() => (window.location.href = `tel:${workerPhone}`)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.25)",
                  borderRadius: SIZES.radiusSm,
                  padding: "10px 0",
                  border: "1px solid rgba(255,255,255,0.4)",
                }}
              >
                <Icon name="person" size={16} color="#fff" />
                <span style={{ color: COLORS.textOnPrimary, ...TYPO.buttonSmall, fontWeight: 800 }}>Gọi CP</span>
              </Touchable>
            )}
          </div>
        </div>
      )}

      {/* === SOS ALERTS (mở rộng theo spec port — getSOSAlerts + resolveSOS nếu parent) === */}
      {sosAlerts.length > 0 && (
        <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="alert-circle" size={16} color={COLORS.errorDeep} />
              <span style={{ ...TYPO.bodySmall, fontWeight: 700, color: COLORS.onSurface }}>Cảnh báo SOS</span>
            </div>
            <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant }}>
              {sosAlerts.filter((a) => a.status === "active").length} đang hoạt động
            </span>
          </div>
          <div style={{ padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {sosAlerts.slice(0, 3).map((a) => (
              <div
                key={String(a.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  borderRadius: SIZES.radiusSm,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>🆘</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                      {a.status === "active" ? "SOS đang hoạt động" : "Đã xử lý"}
                    </span>
                    {a.created_at && (
                      <span style={{ fontSize: 11, color: COLORS.textMuted }}>{new Date(a.created_at).toLocaleTimeString("vi-VN")}</span>
                    )}
                  </div>
                  {!!a.message && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{a.message}</div>}
                </div>
                {a.status === "active" && isParent && (
                  <Touchable onPress={() => handleResolveSOS(a.id)} style={{ background: "#dc2626", borderRadius: 6, padding: "4px 8px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Đã xử lý</span>
                  </Touchable>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === VERIFICATION PIN HISTORY (collapsible — RN exact) === */}
      {verificationChecks.length > 0 && (
        <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.outlineVariant}` }}>
          <Touchable
            onPress={() => setVerificationExpanded(!verificationExpanded)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="shield-checkmark" size={16} color={COLORS.primary} />
              <span style={{ ...TYPO.bodySmall, fontWeight: 700, color: COLORS.onSurface }}>Xác minh bảo mật</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant }}>
                {verificationChecks.filter((c) => c.status === "confirmed").length}/{verificationChecks.length} thành công
              </span>
              {/* glyph chevron-up thiếu → chevron-down xoay 180° */}
              <Icon
                name="chevron-down"
                size={18}
                color={COLORS.onSurfaceVariant}
                style={verificationExpanded ? { transform: "rotate(180deg)" } : undefined}
              />
            </div>
          </Touchable>
          {verificationExpanded && (
            <div style={{ padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              {verificationChecks.map((check) => {
                const sc = getStatusConfig(check.status, check.verification_type);
                return (
                  <div
                    key={String(check.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: 8,
                      borderRadius: SIZES.radiusSm,
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{sc.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                        <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                          {check.triggered_at ? new Date(check.triggered_at).toLocaleTimeString("vi-VN") : ""}
                        </span>
                      </div>
                      {!!check.attempts && check.attempts > 0 && (
                        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>Nhập sai: {check.attempts} lần</div>
                      )}
                      {!!check.consecutive_timeouts_count && check.consecutive_timeouts_count > 0 && (
                        <div style={{ fontSize: 11, color: "#d97706", marginTop: 2 }}>
                          Timeout liên tiếp: {check.consecutive_timeouts_count}
                        </div>
                      )}
                      {/* B5 — thời điểm nộp ảnh (check loại photo đã xác nhận) */}
                      {check.verification_type === "photo" && check.photo_submitted_at && (
                        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                          Gửi ảnh lúc: {new Date(check.photo_submitted_at).toLocaleTimeString("vi-VN")}
                        </div>
                      )}
                    </div>
                    {/* B5 — nút xem ảnh CarePartner đã nộp (chỉ hiện khi có ảnh) */}
                    {check.has_photo && (
                      <Touchable onPress={() => handleViewVerificationPhoto(check)} style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.primary, borderRadius: 6, padding: "4px 8px" }}>
                        <Icon name={ic("image")} size={14} color="#fff" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Xem ảnh</span>
                      </Touchable>
                    )}
                    {check.status === "pending" && (
                      <Touchable onPress={() => handleCancelCheck(check.id)} style={{ background: "#fef3c7", borderRadius: 6, padding: "4px 8px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>Huỷ</span>
                      </Touchable>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === DEVICE STATUS BAR — trạng thái thiết bị (online/offline + battery) — RN exact === */}
      {deviceStatus?.has_heartbeat && !showOfflineBanner && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 14px",
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.outlineVariant}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: deviceStatus.is_offline ? COLORS.error : COLORS.success }} />
            <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, fontWeight: 600 }}>
              {deviceStatus.is_offline ? "⚠️ Offline" : "🟢 Online"}
              {" · "}
              {deviceStatus.seconds_since_last_seen}s trước
            </span>
          </div>
          {deviceStatus.battery_level != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.surfaceContainer, borderRadius: 10, padding: "3px 8px" }}>
              <Icon name="battery-half" size={12} color={deviceStatus.battery_level < 20 ? COLORS.error : COLORS.success} />
              <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, fontWeight: 700, fontSize: 11 }}>{deviceStatus.battery_level}%</span>
            </div>
          )}
        </div>
      )}

      {/* ================= MAP AREA (RN exact + static map simulation) ================= */}
      <div style={{ flex: 1, minHeight: 260 }}>
        {isTracking && location && mapGeom ? (
          <div style={{ flex: 1, background: COLORS.surfaceContainerLow, display: "flex", flexDirection: "column", minHeight: 260 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: COLORS.surface,
                borderBottom: `1px solid ${COLORS.outlineVariant}`,
                boxShadow: SHADOWS.small,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...TYPO.bodySmall, color: COLORS.onSurface, fontWeight: 700 }}>📍 Vị trí Carepartner</div>
                <div style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, marginTop: 2 }}>
                  {parseFloat(String(location.latitude)).toFixed(5)}, {parseFloat(String(location.longitude)).toFixed(5)}
                </div>
              </div>
              {location.is_outside_geofence && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.errorDeep, borderRadius: 6, padding: "4px 8px" }}>
                  <Icon name="warning" size={12} color="#fff" />
                  <span style={{ color: COLORS.textOnPrimary, fontSize: 10, fontWeight: 700 }}>Rời vùng an toàn</span>
                </div>
              )}
            </div>

            {/* PLATFORM ADAPTATION: RN maps -> static map simulation — grid + streets + markers + geofence + path */}
            <div
              ref={mapVisualRef}
              style={{
                flex: 1,
                position: "relative",
                background: "#e8eaed",
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                backgroundSize: "30px 30px",
                overflow: "hidden",
                minHeight: 200,
              }}
            >
              {/* Đường phố trang trí — đúng 3 street của RN */}
              <div style={{ position: "absolute", background: "#fff", opacity: 0.8, left: 0, right: 0, top: "30%", height: 14 }} />
              <div style={{ position: "absolute", background: "#fff", opacity: 0.8, left: "25%", width: 14, top: 0, bottom: 0 }} />
              <div style={{ position: "absolute", background: "#fff", opacity: 0.8, left: 0, right: 0, top: "70%", height: 10 }} />

              {/* Đường di chuyển — SVG polyline từ getLocationHistory (mở rộng theo spec port) */}
              {mapGeom.mode === "projected" && mapGeom.path.length > 1 && (
                <svg
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                  viewBox={`0 0 ${mapSize?.w ?? 0} ${mapSize?.h ?? 0}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={mapGeom.path.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={COLORS.primary}
                    strokeWidth={3}
                    strokeDasharray="6 4"
                    opacity={0.7}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* Geofence ring — quanh nhà phụ huynh, radius 500m theo tỉ lệ (RN: 200px cố định) */}
              {taskLatitude != null && (
                <div
                  style={{
                    position: "absolute",
                    width: mapGeom.geoR * 2,
                    height: mapGeom.geoR * 2,
                    borderRadius: "50%",
                    border: "2px dashed #3b82f6",
                    background: "rgba(59,130,246,0.08)",
                    top: mapGeom.mode === "projected" && mapGeom.parent ? mapGeom.parent.y - mapGeom.geoR : "50%",
                    left: mapGeom.mode === "projected" && mapGeom.parent ? mapGeom.parent.x - mapGeom.geoR : "50%",
                    transform: mapGeom.mode === "projected" && mapGeom.parent ? undefined : "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Carepartner marker (current location) */}
              <div
                style={{
                  position: "absolute",
                  top: mapGeom.mode === "projected" ? mapGeom.worker.y - 18 : "33%",
                  left: mapGeom.mode === "projected" ? mapGeom.worker.x - 18 : "22%",
                  transform: mapGeom.mode === "projected" ? undefined : "translate(-18px, -18px)", // RN marker translate(-18,-18)
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: COLORS.primary,
                    border: "3px solid #fff",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    boxShadow: SHADOWS.large,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🚶</span>
                </div>
                <div style={{ background: "#fff", borderRadius: 8, padding: "3px 8px", marginTop: 4, boxShadow: SHADOWS.small }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.textPrimary }}>Carepartner</span>
                </div>
              </div>

              {/* Parent home marker */}
              {taskLatitude != null && (
                <div
                  style={{
                    position: "absolute",
                    top: mapGeom.mode === "projected" && mapGeom.parent ? mapGeom.parent.y - 18 : "50%",
                    left: mapGeom.mode === "projected" && mapGeom.parent ? mapGeom.parent.x - 18 : "50%",
                    transform: mapGeom.mode === "projected" && mapGeom.parent ? undefined : "translate(-18px, -18px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      background: COLORS.success,
                      border: "3px solid #fff",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      boxShadow: SHADOWS.large,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>🏠</span>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 8, padding: "3px 8px", marginTop: 4, boxShadow: SHADOWS.small }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.textPrimary }}>Nhà bạn</span>
                  </div>
                </div>
              )}

              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  right: 12,
                  background: "rgba(0,0,0,0.7)",
                  color: COLORS.textOnPrimary,
                  fontSize: 11,
                  textAlign: "center",
                  padding: 6,
                  borderRadius: 6,
                }}
              >
                💡 Trong app thật, đây sẽ là bản đồ OpenStreetMap tương tác
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 32, gap: 12, minHeight: 260 }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: COLORS.surfaceContainer, display: "flex", justifyContent: "center", alignItems: "center" }}>
              <Icon name="location-outline" size={48} color={COLORS.textMuted} />
            </div>
            <div style={{ ...TYPO.h5, color: COLORS.onSurface }}>Carepartner chưa chia sẻ vị trí</div>
            <div style={{ ...TYPO.bodySmall, color: COLORS.onSurfaceVariant, textAlign: "center", lineHeight: "18px" }}>
              {liveData?.message || "Vị trí sẽ hiện tại đây khi carepartner bật chia sẻ."}
            </div>
          </div>
        )}
      </div>

      {/* ================= BOTTOM SHEET (RN exact + hotline) ================= */}
      {isTracking && location && (
        <div
          style={{
            background: COLORS.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: "20px 20px 32px",
            boxShadow: SHADOWS.large,
            borderTop: `1px solid ${COLORS.outlineVariant}`,
          }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: COLORS.outlineVariant, margin: "0 auto 16px" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: COLORS.primary,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: `2px solid ${COLORS.surface}`,
                boxShadow: SHADOWS.small,
              }}
            >
              <span style={{ color: COLORS.textOnPrimary, ...TYPO.h4, fontWeight: 800 }}>C</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...TYPO.h4, color: COLORS.onSurface, fontWeight: 700 }}>Carepartner</div>
              <div style={{ ...TYPO.caption, color: COLORS.secondaryDark, marginTop: 2 }}>
                {location.is_outside_geofence ? "⚠️ Đã rời vùng an toàn" : "🟢 Đang làm việc"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              {location.speed != null && (
                <span style={{ ...TYPO.h5, color: COLORS.primary, fontWeight: 900 }}>{(parseFloat(String(location.speed)) * 3.6).toFixed(1)} km/h</span>
              )}
              {location.accuracy != null && (
                <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant, marginTop: 2 }}>±{Math.round(parseFloat(String(location.accuracy)))}m</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 14, padding: "0 4px" }}>
            <Icon name="time-outline" size={14} color={COLORS.textMuted} />
            <span style={{ ...TYPO.caption, color: COLORS.onSurfaceVariant }}>Cập nhật {lastUpdate ? lastUpdate.toLocaleTimeString("vi-VN") : "..."}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {/* RN không gắn onPress cho nút Gọi — theo Fix H14 + spec port: wire tel: khi có số */}
            <Touchable
              onPress={() =>
                workerPhone
                  ? (window.location.href = `tel:${workerPhone}`)
                  : showAlert("Chưa có số điện thoại", "Chưa có số điện thoại CarePartner cho nhiệm vụ này.")
              }
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                background: COLORS.secondary,
                boxShadow: SHADOWS.small,
              }}
            >
              <Icon name={ic("call")} size={16} color="#fff" />
              <span style={{ color: COLORS.textOnPrimary, ...TYPO.buttonSmall, fontWeight: 700 }}>Gọi</span>
            </Touchable>
            {/* N — nút chat thật (cửa sổ còn hiệu lực) */}
            <Touchable
              onPress={() => nav.navigate("Chat", { taskId: taskId != null ? Number(taskId) : undefined, taskTitle })}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                background: COLORS.surfaceContainer,
                border: `1px solid ${COLORS.outlineVariant}`,
                boxShadow: SHADOWS.small,
              }}
            >
              <Icon name={ic("chatbubble")} size={16} color="#fff" />
              <span style={{ color: COLORS.textOnPrimary, ...TYPO.buttonSmall, fontWeight: 700 }}>Nhắn</span>
            </Touchable>
            <Touchable
              onPress={handleSOS}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 14,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                background: COLORS.errorDeep,
                boxShadow: SHADOWS.small,
                opacity: sosLoading ? 0.6 : 1,
              }}
            >
              {sosLoading ? (
                <Spinner size={16} color={COLORS.error} />
              ) : (
                <>
                  <Icon name="alert-circle" size={16} color={COLORS.error} />
                  <span style={{ color: COLORS.textOnPrimary, ...TYPO.buttonSmall, fontWeight: 800, letterSpacing: 1 }}>SOS</span>
                </>
              )}
            </Touchable>
          </div>

          {/* Hotline khẩn cấp — bổ sung theo spec port (RN không có dòng này) */}
          <Touchable
            onPress={() => (window.location.href = "tel:0862427404")}
            style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 10 }}
          >
            <Icon name={ic("call")} size={13} color={COLORS.errorDeep} />
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.errorDeep }}>Hotline khẩn cấp: 0862427404</span>
          </Touchable>
        </div>
      )}

      {/* === IMAGE PREVIEW OVERLAY (RN navigate('ImagePreview') — port thành overlay tại chỗ) === */}
      {photoPreview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "44px 16px 12px", background: "rgba(0,0,0,0.8)" }}>
            <Touchable onPress={() => setPhotoPreview(null)} style={{ padding: 4 }}>
              <Icon name="close" size={24} color="#fff" />
            </Touchable>
            <span style={{ ...TYPO.h5, color: "#fff", fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {photoPreview.title}
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: 12 }}>
            <img src={photoPreview.uri} alt={photoPreview.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTrackingScreen;
