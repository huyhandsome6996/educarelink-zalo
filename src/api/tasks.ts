/** Tasks + Parent/Worker nghiệp vụ — port mobile/src/api/tasks.js */
import api from "./client";
import { AI_TIMEOUT } from "./client";

export const getAllTasks = () => api.get("/tasks/");
export const getTaskDetail = (taskId: number | string) => api.get(`/tasks/${taskId}/`);
export const createTask = (taskData: Record<string, any>) => api.post("/tasks/", taskData);
export const updateTaskStatus = (taskId: number | string, status: string) =>
  api.patch(`/tasks/${taskId}/status/`, { status });

// Parent
export const getMyTasksAsParent = () => api.get("/parent/my-tasks/");
export const getCandidates = (taskId: number | string) => api.get(`/parent/tasks/${taskId}/candidates/`);
export const approveCandidate = (applicationId: number | string) =>
  api.post(`/parent/applications/${applicationId}/approve/`);
export const createReview = (reviewData: Record<string, any>) => api.post("/parent/review/", reviewData);
export const getSmartMatches = (taskId: number | string) => api.get(`/parent/tasks/${taskId}/smart-matches/`);

// Worker
export const applyTask = (taskId: number | string, consentTracking: any = null) =>
  api.post(`/worker/tasks/${taskId}/apply/`, consentTracking !== null ? { consent_tracking: consentTracking } : {});
export const getMyJobsAsWorker = () => api.get("/worker/my-jobs/");
export const getWorkerProfile = (workerId: number | string) => api.get(`/worker/${workerId}/profile/`);
export const submitCredential = (formData: FormData) => api.post("/worker/submit-credential/", formData);
export const getMyCredentials = () => api.get("/worker/submit-credential/");
export const requestProfileChange = (proposedChanges: Record<string, any>) =>
  api.post("/worker/profile-change-request/", proposedChanges);
export const getMyProfileChangeRequests = () => api.get("/worker/profile-change-request/");

// Chatbot (timeout 60s giống RN AI_TIMEOUT)
export const sendChatMessage = (message: string, history: any[] = []) =>
  api.post("/chatbot/", { message, history }, AI_TIMEOUT);
export const sendWorkerChatMessage = (message: string, history: any[] = []) =>
  api.post("/worker/chatbot/", { message, history }, AI_TIMEOUT);
export const sendHelpCenterMessage = (message: string, history: any[] = []) =>
  api.post("/help-center/", { message, history }, AI_TIMEOUT);

// Khác
export const calculateDistance = (payload: Record<string, any>) => api.post("/distance/", payload);
export const getPriceSuggestion = (payload: Record<string, any>) => api.post("/tasks/price-suggestion/", payload);
export const getCategories = () => api.get("/categories/");

// Availability A2 (legacy)
export const getWorkerAvailability = () => api.get("/worker/availability/");
export const createWorkerAvailability = (data: Record<string, any>) => api.post("/worker/availability/", data);
export const updateWorkerAvailability = (id: number, data: Record<string, any>) =>
  api.put(`/worker/availability/${id}/`, data);
export const deleteWorkerAvailability = (id: number) => api.delete(`/worker/availability/${id}/`);
