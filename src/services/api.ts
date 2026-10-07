import { Task, TaskApplication, User, AuthResponse, NotificationItem } from '@/types';

/* ============================================================
 * EduCareLink API Client
 * - Production: Render backend (mặc định)
 * - Dev: dùng relative /api để tận dụng vite proxy (không CORS)
 * - Local fallback: http://localhost:8000
 * - JWT: tự động refresh access token khi gặp 401
 * ============================================================ */

export const RENDER_API_BASE = 'https://educarelink-backend.onrender.com/api';
export const LOCAL_API_BASE = 'http://localhost:8000/api';
export const DEV_PROXY_BASE = '/api';

const IS_DEV =
  typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;

export const DEFAULT_API_BASE = IS_DEV ? DEV_PROXY_BASE : RENDER_API_BASE;

export const getApiBaseUrl = (): string => {
  const saved = localStorage.getItem('educarelink_api_url');
  if (saved) return saved;
  return DEFAULT_API_BASE;
};

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('educarelink_api_url', url);
};

// Danh sách base dự phòng khi mạng/CORS lỗi: primary -> proxy dev -> render -> local
function buildFallbackChain(primary: string): string[] {
  const chain = [primary];
  if (IS_DEV && primary !== DEV_PROXY_BASE) chain.push(DEV_PROXY_BASE);
  if (primary !== RENDER_API_BASE) chain.push(RENDER_API_BASE);
  if (primary !== LOCAL_API_BASE) chain.push(LOCAL_API_BASE);
  return chain;
}

export const getToken = (): string | null => {
  return localStorage.getItem('educarelink_access_token');
};

export const setTokens = (access: string, refresh?: string) => {
  localStorage.setItem('educarelink_access_token', access);
  if (refresh) localStorage.setItem('educarelink_refresh_token', refresh);
};

export const clearTokens = () => {
  localStorage.removeItem('educarelink_access_token');
  localStorage.removeItem('educarelink_refresh_token');
  localStorage.removeItem('educarelink_current_user');
};

const isDemoToken = (t: string | null) => !!t && t.startsWith('demo-');

/* ---------- JWT refresh (gọi thẳng Render, không qua wrapper) ---------- */
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('educarelink_refresh_token');
  if (!refresh || isDemoToken(refresh)) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${RENDER_API_BASE}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.access) {
        setTokens(data.access, data.refresh || refresh);
        return data.access as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/* ---------- Generic request wrapper ---------- */
async function rawFetch<T>(baseUrl: string, endpoint: string, options: RequestInit): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  const token = getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && !isDemoToken(token)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  // Render free-tier cold start có thể mất ~30-60s cho request đầu tiên
  const timeoutMs = options.method === 'GET' ? 25000 : 35000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `Lỗi máy chủ (${response.status})`;
      let errJson: any = null;
      try {
        errJson = await response.json();
        errorMsg =
          (typeof errJson === 'object' && (errJson.error || errJson.detail || errJson.message)) ||
          JSON.stringify(errJson);
      } catch {
        errorMsg = response.statusText || errorMsg;
      }
      const error: any = new Error(errorMsg);
      error.status = response.status;
      error.payload = errJson;
      throw error;
    }

    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, _skipRetry = false): Promise<T> {
  const primary = getApiBaseUrl();
  const chain = buildFallbackChain(primary);

  let lastError: any = null;
  for (let i = 0; i < chain.length; i++) {
    try {
      return await rawFetch<T>(chain[i], endpoint, options);
    } catch (err: any) {
      lastError = err;
      const networkErr =
        err.name === 'AbortError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('fetch');

      // Lỗi HTTP logic (400/403/404...) -> không thử base khác, throw luôn
      if (!networkErr && typeof err.status === 'number') {
        // 401 -> thử refresh token 1 lần rồi gọi lại
        if (err.status === 401 && !_skipRetry && !endpoint.startsWith('auth/')) {
          const newAccess = await refreshAccessToken();
          if (newAccess) {
            return request<T>(endpoint, options, true);
          }
          clearTokens();
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        throw err;
      }
      // Network/CORS -> thử base tiếp theo trong chain
      if (i === chain.length - 1) {
        // Hết đường: nếu 401 vẫn thử refresh trước khi báo lỗi
        if (err.status === 401 && !_skipRetry && !endpoint.startsWith('auth/')) {
          const newAccess = await refreshAccessToken();
          if (newAccess) return request<T>(endpoint, options, true);
        }
        throw err;
      }
      console.warn(`[EduCareLink] Base ${chain[i]} lỗi (${err.message}), thử base dự phòng...`);
    }
  }
  throw lastError;
}

export const api = {
  /* ------------------- AUTH ------------------- */
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.tokens?.access) {
      setTokens(res.tokens.access, res.tokens.refresh);
      localStorage.setItem(
        'educarelink_current_user',
        JSON.stringify({
          id: res.user_id,
          username: res.username,
          role: res.role,
          first_name: res.first_name,
          last_name: res.last_name,
          is_approved: res.is_approved,
        })
      );
    }
    return res;
  },

  async register(data: Record<string, any>): Promise<any> {
    return request('auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getProfile(): Promise<User> {
    return request<User>('profile/');
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    return request<User>('profile/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /** Upload giấy tờ xác thực (CCCD 2 mặt, chân dung, bằng cấp) qua FormData */
  async uploadVerificationDocuments(files: {
    id_card_front?: File | null;
    id_card_back?: File | null;
    selfie_photo?: File | null;
    certificate_photo?: File | null;
  }): Promise<any> {
    const fd = new FormData();
    Object.entries(files).forEach(([key, file]) => {
      if (file) fd.append(key, file);
    });
    return request('profile/', { method: 'PATCH', body: fd });
  },

  async refreshToken(): Promise<any> {
    const refresh = localStorage.getItem('educarelink_refresh_token');
    return request('auth/token/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    });
  },

  /* ------------------- TASKS (Bảng tin) ------------------- */
  async getTasks(): Promise<Task[]> {
    return request<Task[]>('tasks/');
  },

  async getTaskDetail(id: number): Promise<Task> {
    return request<Task>(`tasks/${id}/`);
  },

  async createTask(data: {
    title: string;
    description: string;
    price: number;
    category?: number;
    location: string;
    scheduled_time: string;
    latitude?: number;
    longitude?: number;
    geofence_radius?: number;
  }): Promise<Task> {
    return request<Task>('tasks/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateTaskStatus(id: number, status: string): Promise<Task> {
    return request<Task>(`tasks/${id}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /* ------------------- PARENT FLOW ------------------- */
  async getParentTasks(): Promise<Task[]> {
    return request<Task[]>('parent/my-tasks/');
  },

  async getTaskCandidates(taskId: number): Promise<TaskApplication[]> {
    return request<TaskApplication[]>(`parent/tasks/${taskId}/candidates/`);
  },

  async approveCandidate(applicationId: number): Promise<any> {
    return request(`parent/applications/${applicationId}/approve/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async submitReview(taskId: number, rating: number, comment: string): Promise<any> {
    return request('parent/review/', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, rating, comment }),
    });
  },

  /* ------------------- WORKER / CAREPARTNER FLOW ------------------- */
  async applyTask(taskId: number, note?: string): Promise<any> {
    return request(`worker/tasks/${taskId}/apply/`, {
      method: 'POST',
      body: JSON.stringify({
        note: note || 'Tôi muốn nhận công việc này và cam kết hoàn thành tốt.',
      }),
    });
  },

  async getWorkerJobs(): Promise<TaskApplication[]> {
    return request<TaskApplication[]>('worker/my-jobs/');
  },

  async getWorkerProfile(workerId: number): Promise<any> {
    return request(`worker/${workerId}/profile/`);
  },

  async getMyEarnings(): Promise<any> {
    return request('payments/my-earnings/');
  },

  /* ------------------- AI CHATBOT (Gemini) -------------------
   * Backend nhận key "message" (đã kiểm chứng live API ngày 08/10)
   * Giữ tương thích "prompt" cho phiên bản backend cũ.
   */
  async askChatbot(prompt: string): Promise<{ response: string; suggestions?: string[] }> {
    return request('chatbot/', {
      method: 'POST',
      body: JSON.stringify({ message: prompt, prompt }),
    });
  },

  async askWorkerChatbot(prompt: string): Promise<{ response: string }> {
    return request('worker/chatbot/', {
      method: 'POST',
      body: JSON.stringify({ message: prompt, prompt }),
    });
  },

  async askHelpCenter(query: string): Promise<any> {
    return request('help-center/', {
      method: 'POST',
      body: JSON.stringify({ message: query, query }),
    });
  },

  /* ------------------- TRACKING & SOS ------------------- */
  async getLiveLocation(taskId: number): Promise<any> {
    return request(`tracking/${taskId}/live/`);
  },

  async updateLocation(latitude: number, longitude: number, taskId?: number): Promise<any> {
    return request('tracking/location/', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, task_id: taskId }),
    });
  },

  async sendSOS(taskId: number, reason: string): Promise<any> {
    return request('tracking/sos/', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, reason }),
    });
  },

  async getDeviceStatus(taskId: number): Promise<any> {
    return request(`tracking/${taskId}/device-status/`);
  },

  /* ------------------- NOTIFICATIONS ------------------- */
  async getNotifications(): Promise<NotificationItem[]> {
    return request<NotificationItem[]>('notifications/');
  },

  async getUnreadCount(): Promise<{ unread_count: number }> {
    return request('notifications/unread-count/');
  },

  async markNotificationsRead(): Promise<any> {
    return request('notifications/mark-read/', { method: 'POST', body: JSON.stringify({}) });
  },

  /* ------------------- HEALTH ------------------- */
  async checkHealth(): Promise<any> {
    return request('health/');
  },
};
