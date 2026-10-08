/** Matching (prefix riêng /api/matching/ — booking id là UUID) — port mobile/src/api/matching.js */
import api from "./client";
import { AI_TIMEOUT } from "./client";

// CROSS-REVIEW FIX (7-c, P1): 2 constant dưới đây copy NGUYÊN mobile/src/api/matching.js:121-138.
// Bản cũ: MATCH_LEVEL_LABELS rỗng {} + CANCEL_REASONS dùng code tự chế
// (force_majeure/sick/...) không tồn tại trong backend → 400 khi cancel.
// Các screen (BookingDetail/MyJobs/Appeal) đang dùng bản local đúng — sửa ở đây
// để mọi nơi import sau này không lệch contract RN.
export const MATCH_LEVEL_LABELS: Record<string, string> = {
  very_high: "Rất phù hợp",
  high: "Phù hợp cao",
  medium: "Phù hợp",
  low: "Có thể cân nhắc",
};

// 8 lý do hủy (Step 5.3) — force majeure cần note >= 20 ký tự (giống RN)
export const CANCEL_REASONS = [
  { code: "school_schedule", label: "Trùng lịch học đột xuất", forceMajeure: true },
  { code: "health", label: "Sức khỏe không tốt", forceMajeure: true },
  { code: "family_emergency", label: "Việc gia đình khẩn cấp", forceMajeure: true },
  { code: "accident", label: "Tai nạn / sự cố di chuyển", forceMajeure: true },
  { code: "wrong_job_info", label: "Thông tin công việc không đúng mô tả", forceMajeure: true },
  { code: "transport", label: "Không thể di chuyển", forceMajeure: false },
  { code: "personal", label: "Lý do cá nhân", forceMajeure: false },
  { code: "other", label: "Khác (bắt buộc ghi chú)", forceMajeure: false },
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
