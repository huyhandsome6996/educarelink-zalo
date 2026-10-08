/** Matching (prefix riêng /api/matching/ — booking id là UUID) — port mobile/src/api/matching.js */
import api from "./client";
import { AI_TIMEOUT } from "./client";

export const MATCH_LEVEL_LABELS: Record<string, string> = {};
export const CANCEL_REASONS = [
  { code: "force_majeure", label: "Bất khả kháng", forceMajeure: true },
  { code: "emergency", label: "Khẩn cấp gia đình" },
  { code: "sick", label: "Bị ốm" },
  { code: "schedule_conflict", label: "Trùng lịch" },
  { code: "weather", label: "Thời tiết xấu" },
  { code: "transport", label: "Vấn đề di chuyển" },
  { code: "other", label: "Lý do khác" },
];

export const createJob = (payload: Record<string, any>) => api.post("/matching/jobs/", payload);
export const publishJob = (jobId: string) => api.post(`/matching/jobs/${jobId}/publish/`, null, AI_TIMEOUT);
export const getMatchingCandidates = (jobId: string) => api.post("/matching/candidates/", { job_id: jobId });

/** Header Idempotency-Key bắt buộc (giống RN selectCarePartner) */
export const selectCarePartner = (jobId: string, carepartnerId: number | string, idempotencyKey: string) =>
  api.post(`/matching/jobs/${jobId}/select-carepartner/`, { carepartner_id: carepartnerId }, undefined, {
    "Idempotency-Key": idempotencyKey,
  });

export const getBookings = ({ role, status }: { role?: string; status?: string } = {}) => {
  const q = new URLSearchParams();
  if (role) q.set("role", role);
  if (status) q.set("status", status);
  const qs = q.toString();
  return api.get(`/matching/bookings/${qs ? `?${qs}` : ""}`);
};
export const getBookingDetail = (bookingId: string) => api.get(`/matching/bookings/${bookingId}/`);
export const cancelBooking = (bookingId: string, payload: Record<string, any>) =>
  api.post(`/matching/bookings/${bookingId}/cancel/`, payload);
export const cancelBookingByParent = (bookingId: string, note = "") =>
  api.post(`/matching/bookings/${bookingId}/cancel-parent/`, { note });
export const reportNoShow = (bookingId: string, arrived: boolean) =>
  api.post(`/matching/bookings/${bookingId}/report-no-show/`, { arrived });
export const commitBooking = (bookingId: string) => api.post(`/matching/bookings/${bookingId}/commit/`);
export const startBooking = (bookingId: string) => api.post(`/matching/bookings/${bookingId}/start/`);
export const completeBooking = (bookingId: string) => api.post(`/matching/bookings/${bookingId}/complete/`);
export const createAppeal = (bookingId: string, payload: Record<string, any>) =>
  api.post(`/matching/bookings/${bookingId}/appeal/`, payload);
export const getAppeal = (bookingId: string) => api.get(`/matching/bookings/${bookingId}/appeal/`);
export const requestReschedule = (bookingId: string, payload: Record<string, any>) =>
  api.post(`/matching/bookings/${bookingId}/reschedule/`, payload);
export const respondReschedule = (bookingId: string, decision: string) =>
  api.post(`/matching/bookings/${bookingId}/reschedule/respond/`, { decision });

export const getAvailability = () => api.get("/matching/carepartners/me/availability/");
export const addAvailability = (payload: Record<string, any>) =>
  api.post("/matching/carepartners/me/availability/", payload);
export const updateAvailability = (id: number | string, payload: Record<string, any>) =>
  api.put(`/matching/carepartners/me/availability/${id}/`, payload);
export const deleteAvailability = (id: number | string) =>
  api.delete(`/matching/carepartners/me/availability/${id}/`);
export const bulkReplaceAvailability = (windows: any[]) =>
  api.put("/matching/carepartners/me/availability/bulk/", { windows });

export const getBlackouts = () => api.get("/matching/carepartners/me/blackouts/");
export const addBlackout = (payload: Record<string, any>) =>
  api.post("/matching/carepartners/me/blackouts/", payload);
export const deleteBlackout = (id: number | string) =>
  api.delete(`/matching/carepartners/me/blackouts/${id}/`);

export const getCreditBalance = () => api.get("/matching/credits/balance/");
export const getTrustProfile = () => api.get("/matching/carepartner/trust/");
export const getMatchingNotifications = (unreadOnly = false) =>
  api.get(`/matching/notifications/${unreadOnly ? "?unread=true" : ""}`);
export const getMatchingUnreadCount = () => api.get("/matching/notifications/unread-count/");
export const getOnboardingStatus = () => api.get("/matching/carepartners/me/onboarding-status/");
export const registerDeviceToken = (platform: string, token: string) =>
  api.post("/matching/device-token/", { platform, token });
