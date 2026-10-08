/** Tracking — port mobile/src/api/tracking.js. Polling matrix giữ nguyên RN. */
import api from "./client";
import { RENDER_ORIGIN, AI_TIMEOUT } from "./client";

export const grantConsent = (taskId: number | string, granted = true) =>
  api.post("/tracking/consent/", { task_id: taskId, granted });
export const revokeConsent = (taskId: number | string) => api.post(`/tracking/consent/${taskId}/revoke/`);
export const updateLocation = (payload: Record<string, any>) => api.post("/tracking/location/", payload);
export const getLiveLocation = (taskId: number | string) => api.get(`/tracking/${taskId}/live/`);
export const getLocationHistory = (taskId: number | string, limit = 1000) =>
  api.get(`/tracking/${taskId}/history/?limit=${limit}`);
export const checkConsent = (taskId: number | string) => api.get(`/tracking/${taskId}/consent/`);
export const triggerSOS = (payload: Record<string, any>) => api.post("/tracking/sos/", payload);
export const getSOSAlerts = (taskId: number | string) => api.get(`/tracking/sos/${taskId}/`);
export const resolveSOS = (sosId: number | string) => api.post(`/tracking/sos/${sosId}/resolve/`);
export const getAdminTrackingOverview = () => api.get("/tracking/admin/overview/");
export const runOfflineCheck = () => api.post("/tracking/admin/run-offline-check/");
export const sendHeartbeat = (payload: Record<string, any>) => api.post("/tracking/heartbeat/", payload);
export const getDeviceStatus = (taskId: number | string) => api.get(`/tracking/${taskId}/device-status/`);
export const getOfflineAlerts = (taskId: number | string, limit = 50) =>
  api.get(`/tracking/${taskId}/offline-alerts/?limit=${limit}`);
export const acknowledgeOfflineAlert = (taskId: number | string, alertId: number | string) =>
  api.post(`/tracking/${taskId}/offline-alerts/${alertId}/acknowledge/`);
export const setVerificationPin = (payload: Record<string, any>) => api.post("/tracking/verification-pin/set/", payload);
export const getPendingVerificationCheck = () => api.get("/tracking/verification-checks/pending/");
export const respondVerificationCheck = (checkId: number | string, payload: Record<string, any>) =>
  api.post(`/tracking/verification-checks/${checkId}/respond/`, payload);

/** Upload ảnh verification: FormData field `photo` + lat/lng dạng String (giống RN) */
export const submitVerificationPhoto = (
  checkId: number | string,
  { photo, latitude, longitude }: { photo: File; latitude?: number | null; longitude?: number | null }
) => {
  const fd = new FormData();
  fd.append("photo", photo);
  if (latitude != null) fd.append("latitude", String(latitude));
  if (longitude != null) fd.append("longitude", String(longitude));
  return api.post(`/tracking/verification-checks/${checkId}/photo/`, fd, 30_000);
};

/** GET ảnh cần Bearer — trả về blob URL để <img src> (RN dùng expo-image headers) */
export async function fetchVerificationPhotoUrl(checkId: number | string): Promise<string> {
  const token = (await import("@/utils/storage")).default.getItem("access_token");
  const res = await fetch(`${RENDER_ORIGIN}/api/tracking/verification-checks/${checkId}/photo/`, {
    headers: token ? { Authorization: `Bearer ${await token}` } : {},
  });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const getAdminVerificationChecks = (params: Record<string, any> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return api.get(`/tracking/admin/verification-checks/${qs ? `?${qs}` : ""}`);
};
export const triggerVerificationCheck = (payload: Record<string, any>) =>
  api.post("/tracking/admin/trigger-verification-check/", payload);
export const checkTrackingHealth = () => api.get("/tracking/health/");
export const getVerificationHistory = (taskId: number | string, limit = 50) =>
  api.get(`/tracking/${taskId}/verification-checks/history/?limit=${limit}`);
export const cancelVerificationCheck = (checkId: number | string, reason = "") =>
  api.post(`/tracking/verification-checks/${checkId}/cancel/`, { reason });
export const uploadBatchLocations = (payload: Record<string, any>) => api.post("/tracking/location/batch/", payload);
export const sendGpsHeartbeat = (payload: Record<string, any>) => api.post("/tracking/gps-heartbeat/", payload);
export const getMatchingGpsConsent = () => api.get("/tracking/matching-gps-consent/");
export const setMatchingGpsConsent = (granted: boolean) => api.post("/tracking/matching-gps-consent/", { granted });
export { AI_TIMEOUT };
