/** Auth + Profile + Onboarding — port mobile/src/api/auth.js + AuthContext storage keys */
import api from "./client";
import storage from "@/utils/storage";

export interface LoginResponse {
  message?: string;
  tokens: { access: string; refresh: string };
  user_id: number;
  username: string;
  role: "parent" | "worker";
  is_staff?: boolean;
  is_approved?: boolean;
  first_name?: string;
  last_name?: string;
  first_login?: boolean;
  status?: string;
  permissions?: string[];
}

export const login = (username: string, password: string) =>
  api.post<LoginResponse>("/auth/login/", { username, password });

/** register: có file -> FormData (web: File/Blob — KHÔNG gửi {uri,type,name} của RN) */
export const register = (
  payload: Record<string, any>,
  files?: { id_card_front?: File; id_card_back?: File; selfie_photo?: File; certificate_photo?: File }
) => {
  if (files && Object.keys(files).length) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    }
    for (const [k, f] of Object.entries(files)) if (f) fd.append(k, f);
    return api.post("/auth/register/", fd);
  }
  return api.post("/auth/register/", payload);
};

export const getProfile = () => api.get("/profile/");
export const updateProfile = (payload: Record<string, any>) => api.patch("/profile/", payload);
export const updateCertificate = (certificatePhoto: File) => {
  const fd = new FormData();
  fd.append("certificate_photo", certificatePhoto);
  return api.patch("/profile/", fd);
};
export const getOAuthConfig = () => api.get("/auth/oauth-config/");
export const completeOnboarding = (payload: Record<string, any> = {}) => api.post("/onboarding/complete/", payload);
export const loginWithGoogle = (accessToken: string, role = "parent") =>
  api.post("/auth/google/", { access_token: accessToken, role });
export const loginWithFacebook = (accessToken: string, role = "parent") =>
  api.post("/auth/facebook/", { access_token: accessToken, role });

/** Lưu session đúng keys RN: access_token/refresh_token/user_role/is_staff/user_id */
export async function saveSession(data: LoginResponse) {
  await storage.setItem("access_token", data.tokens.access);
  await storage.setItem("refresh_token", data.tokens.refresh);
  await storage.setItem("user_role", data.role);
  if (data.is_staff) await storage.setItem("is_staff", "true");
}

export async function clearAllSession() {
  for (const k of ["access_token", "refresh_token", "user_role", "is_staff", "user_id", "tracking_task_id"]) {
    await storage.deleteItem(k);
  }
}
