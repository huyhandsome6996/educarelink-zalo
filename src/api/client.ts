/**
 * API client — port 1:1 mobile/src/api/client.js của RN.
 * - BASE_URL prod mặc định: https://educarelink-backend.onrender.com/api
 * - Dev (localhost) dùng '/api' tương đối -> vite proxy về Render (như EXPO_PUBLIC_USE_DEV_BACKEND)
 * - Bearer token tự attach từ storage('access_token')
 * - 401 -> hàng đợi refresh (failedQueue) + rotate refresh token; refresh fail -> xoá session
 * - Khác biệt có chủ đích (ghi trong docs/mobile-parity-map.md): /auth/login/ & /auth/register/
 *   KHÔNG đi vào luồng refresh (RN Quirk: login sai mật khẩu lại gọi refresh gây lỗi nhiễu).
 * - Timeout mặc định 45s; AI endpoints override 60s (giống RN AI_TIMEOUT).
 */
import storage from "@/utils/storage";

const PROD_URL = "https://educarelink-backend.onrender.com/api";

const IS_DEV_HOST =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "");

export const API_BASE_URL = IS_DEV_HOST ? "/api" : PROD_URL;
export const RENDER_ORIGIN = IS_DEV_HOST ? "" : "https://educarelink-backend.onrender.com";

export const DEFAULT_TIMEOUT = 45_000;
export const AI_TIMEOUT = 60_000;

export class ApiError extends Error {
  status?: number;
  data?: any;
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/* ---------------- Refresh queue (nguyên bản RN client.js:72-174) ---------------- */
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

async function clearSession() {
  await storage.deleteItem("access_token");
  await storage.deleteItem("refresh_token");
  await storage.deleteItem("user_role");
  await storage.deleteItem("is_staff");
}

/** Endpoint không được đi qua refresh queue (login/register 401 là nghiệp vụ) */
function isAuthEndpoint(url: string): boolean {
  return /\/auth\/(login|register|google|facebook)\/?$/.test(url.replace(API_BASE_URL, ""));
}

/* ---------------- Core request ---------------- */
export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: any; // object -> JSON; FormData -> multipart (browser tự đặt boundary)
  timeout?: number;
  headers?: Record<string, string>;
  _retry?: boolean; // cờ nội bộ chống refresh lặp
}

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeout = DEFAULT_TIMEOUT, headers = {}, _retry } = options;

  const finalHeaders: Record<string, string> = { ...headers };
  const token = await storage.getItem("access_token");
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  if (body && !(body instanceof FormData) && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    // Network fail: RNaxios -> error không có response. Giữ nguyên semantics.
    throw new ApiError(e?.name === "AbortError" ? "Hết thời gian chờ kết nối" : "Lỗi kết nối mạng", undefined, undefined);
  }
  clearTimeout(timer);

  // 401 flow — nguyên bản RN
  if (res.status === 401 && !_retry && !isAuthEndpoint(path)) {
    const original: RequestOptions = { ...options, _retry: true };

    if (isRefreshing) {
      return new Promise<T>((resolve, reject) => {
        failedQueue.push({ resolve: (t) => resolve(t as any), reject });
      }).then(() => request<T>(path, original));
    }

    isRefreshing = true;
    try {
      const refreshToken = await storage.getItem("refresh_token");
      if (!refreshToken) {
        await clearSession();
        isRefreshing = false;
        processQueue(new ApiError("Không có refresh token", 401), null);
        throw new ApiError("Phiên đăng nhập hết hạn", 401);
      }

      // Refresh KHÔNG qua wrapper (tránh vòng lặp) — giống RN dùng axios thô
      const refreshRes = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!refreshRes.ok) throw new Error("refresh_failed");
      const tokens = await refreshRes.json();

      await storage.setItem("access_token", tokens.access);
      if (tokens.refresh) await storage.setItem("refresh_token", tokens.refresh); // rotate + blacklist

      isRefreshing = false; // Fix H10: reset TRƯỚC processQueue tránh race
      processQueue(null, tokens.access);

      return request<T>(path, original); // retry request gốc với token mới
    } catch (refreshError) {
      await clearSession();
      isRefreshing = false;
      processQueue(refreshError, null);
      throw new ApiError("Phiên đăng nhập hết hạn", 401);
    }
  }

  // 401 lần 2 (đã retry) hoặc 401 ở auth endpoint -> xoá session như RN
  if (res.status === 401 && !isAuthEndpoint(path)) {
    await clearSession();
  }

  const contentType = res.headers.get("content-type") || "";
  const data: any = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.detail)) || (typeof data === "string" && data) || `Lỗi HTTP ${res.status}`;
    const err = new ApiError(typeof msg === "string" ? msg : JSON.stringify(msg), res.status, data);
    (err as any).response = { status: res.status, data }; // giữ shape axios để screen đọc e.response.data
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string, timeout?: number) => request<T>(path, { method: "GET", timeout }),
  post: <T = any>(path: string, body?: any, timeout?: number, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body, timeout, headers }),
  patch: <T = any>(path: string, body?: any, timeout?: number) => request<T>(path, { method: "PATCH", body, timeout }),
  put: <T = any>(path: string, body?: any, timeout?: number) => request<T>(path, { method: "PUT", body, timeout }),
  delete: <T = any>(path: string, timeout?: number) => request<T>(path, { method: "DELETE", timeout }),
};

export default api;
