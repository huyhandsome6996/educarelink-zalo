/** Payments + Notifications + Chat + CareDiary + Moderation + Admin + AI — port các module RN còn lại */
import api from "./client";
import { AI_TIMEOUT } from "./client";

/* ---------- Payments ---------- */
export const setupPayment = (taskId: number | string, method: string) =>
  api.post("/payments/setup/", { task_id: taskId, method });
export const setupPayOS = (taskId: number | string) => api.post("/payments/payos-setup/", { task_id: taskId });
export const getPaymentDetail = (paymentId: number | string) => api.get(`/payments/${paymentId}/`);
export const getMyPayments = () => api.get("/payments/my/");
export const getMyEarnings = () => api.get("/payments/my-earnings/");
export const getSettlements = () => api.get("/payments/settlements/");
export const getSettlementDetail = (id: number | string) => api.get(`/payments/settlements/${id}/`);
export const getPaymentStatus = (paymentId: number | string) => api.get(`/payments/${paymentId}/status/`);
export const cancelSelection = (paymentId: number | string) => api.post(`/payments/${paymentId}/cancel-selection/`);
export const getPaymentOverview = () => api.get("/payments/admin/overview/");
export const getAllPayments = (params: Record<string, any> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return api.get(`/payments/admin/payments/${qs ? `?${qs}` : ""}`);
};
export const retryPayout = (id: number | string) => api.post(`/payments/admin/payments/${id}/retry-payout/`);
export const regenerateSettlementQR = (id: number | string) =>
  api.post(`/payments/admin/settlements/${id}/regenerate-qr/`);
export const runMonthlySettlement = (payload: Record<string, any>) => api.post("/payments/admin/run-settlement/", payload);
export const getPaymentLogs = (params: Record<string, any> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return api.get(`/payments/admin/logs/${qs ? `?${qs}` : ""}`);
};
export const checkPaymentHealth = () => api.get("/payments/health/");

/* ---------- Notifications (poll 30s ở NotificationBell) ---------- */
export const getNotifications = () => api.get("/notifications/");
export const getUnreadCount = () => api.get("/notifications/unread-count/");
export const markNotificationsRead = (payload: { notification_ids?: number[]; mark_all?: boolean }) =>
  api.post("/notifications/mark-read/", payload);

/* ---------- Chat (poll 4s) ---------- */
export const getConversations = (limit = 50) => api.get(`/chat/conversations/?limit=${limit}`);
export const getConversation = (taskId: number | string) => api.get(`/chat/conversations/${taskId}/`);
export const getMessages = (taskId: number | string, since: string | number | null = null) =>
  api.get(`/chat/conversations/${taskId}/messages/${since ? `?since=${since}` : ""}`);
export const sendMessage = (taskId: number | string, content: string) =>
  api.post(`/chat/conversations/${taskId}/messages/send/`, { content });
export const markChatRead = (taskId: number | string) => api.post(`/chat/conversations/${taskId}/read/`);

/* ---------- Care Diary ---------- */
export const createCareDiaryEntry = (taskId: number | string, data: Record<string, any>) =>
  api.post(`/worker/tasks/${taskId}/care-diary/`, data);
export const updateCareDiaryEntry = (taskId: number | string, data: Record<string, any>) =>
  api.patch(`/worker/tasks/${taskId}/care-diary/`, data);
export const getCareDiaryEntry = (taskId: number | string) => api.get(`/tasks/${taskId}/care-diary/`);
export const uploadCareDiaryAttachments = (taskId: number | string, formData: FormData) =>
  api.post(`/worker/tasks/${taskId}/care-diary/attachments/`, formData);
export const getCareDiaryHistory = () => api.get("/parent/care-diary-history/");

/* ---------- Moderation ---------- */
export const getTaskModeration = (taskId: number | string) => api.get(`/moderation/task/${taskId}/`);
export const createComplaint = (formData: FormData) => api.post("/moderation/complaints/", formData, AI_TIMEOUT);
export const getMyComplaints = () => api.get("/moderation/complaints/mine/");
export const getModerationQueue = (status = "needs_review") =>
  api.get(`/moderation/admin/tasks/?status=${status}`);
export const overrideModeration = (id: number | string, status: string, adminNote: string) =>
  api.post(`/moderation/admin/tasks/${id}/override/`, { status, admin_note: adminNote });
export const reModerateTask = (taskId: number | string) =>
  api.post(`/moderation/admin/tasks/${taskId}/re-moderate/`, {}, AI_TIMEOUT);
export const getComplaints = (status: string) => api.get(`/moderation/admin/complaints/?status=${status}`);
export const resolveComplaint = (id: number | string, data: Record<string, any>) =>
  api.post(`/moderation/admin/complaints/${id}/resolve/`, data);
export const aiAnalyzeComplaint = (id: number | string) =>
  api.post(`/moderation/admin/complaints/${id}/ai-analyze/`, {}, AI_TIMEOUT);
export const checkModerationHealth = () => api.get("/moderation/health/");

/* ---------- Admin ---------- */
export const getPendingWorkers = () => api.get("/admin/pending-workers/");
export const getAllWorkers = () => api.get("/admin/all-workers/");
export const getAllUsers = () => api.get("/admin/all-users/");
export const workerAction = (userId: number | string, payload: Record<string, any>) =>
  api.post(`/admin/workers/${userId}/action/`, payload);
export const toggleUserActive = (userId: number | string) => api.post(`/admin/users/${userId}/toggle-active/`);
export const revokeCarepartner = (userId: number | string) => api.post(`/admin/users/${userId}/revoke-carepartner/`);
export const getPendingCredentials = (status = "pending") =>
  api.get(`/admin/credential-submissions/?status=${status}`);
export const reviewCredential = (id: number | string, payload: Record<string, any>) =>
  api.post(`/admin/credential-submissions/${id}/review/`, payload);
export const sendNotification = (payload: Record<string, any>) => api.post("/admin/send-notification/", payload);
export const getPendingProfileChanges = (status = "pending") =>
  api.get(`/admin/profile-change-requests/?status=${status}`);
export const reviewProfileChange = (id: number | string, payload: Record<string, any>) =>
  api.post(`/admin/profile-change-requests/${id}/review/`, payload);
export const seedDemoData = () => api.post("/admin/seed-demo-data/");
export const sendAdminChatMessage = (formData: FormData) => api.post("/admin/chatbot/", formData, AI_TIMEOUT);
export const getKeepaliveStats = () => api.get("/admin/keepalive-stats/");
export const getAllTasksAdmin = (moderationStatus = "all") =>
  api.get(`/admin/all-tasks/?moderation_status=${moderationStatus}`);
export const moderateTask = (taskId: number | string, payload: Record<string, any>) =>
  api.post(`/admin/all-tasks/${taskId}/moderate/`, payload);

/* ---------- AI Recommendations (timeout 60s) ---------- */
export const getWorkerRecommendations = (forceRefresh = false) =>
  api.get(`/ai/recommendations/worker/${forceRefresh ? `?_t=${Date.now()}` : ""}`, AI_TIMEOUT);
export const getCandidateRecommendations = (taskId: number | string, forceRefresh = false) =>
  api.get(`/ai/recommendations/candidates/${taskId}/${forceRefresh ? `?_t=${Date.now()}` : ""}`, AI_TIMEOUT);
export const clearRecommendationsCache = (payload: Record<string, any> = {}) =>
  api.post("/ai/recommendations/clear-cache/", payload);
