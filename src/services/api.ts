import { Task, TaskApplication, User, AuthResponse, NotificationItem } from '@/types';

// Default to Cloud Render backend, with fallback / local toggle support
export const LOCAL_API_BASE = 'http://localhost:8000/api';
export const RENDER_API_BASE = 'https://educarelink-backend.onrender.com/api';
export const DEFAULT_API_BASE = LOCAL_API_BASE;

export const getApiBaseUrl = (): string => {
  const saved = localStorage.getItem('educarelink_api_url');
  if (saved && !saved.includes('onrender.com')) return saved;
  return LOCAL_API_BASE;
};

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('educarelink_api_url', url);
};

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

// Generic fetch wrapper with timeout and Bearer auth
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const primaryBase = getApiBaseUrl();
  const fallbackBase =
    primaryBase === LOCAL_API_BASE ? RENDER_API_BASE : LOCAL_API_BASE;

  const tryFetch = async (baseUrl: string): Promise<T> => {
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    const token = getToken();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutMs = options.method === 'GET' ? 12000 : 18000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Lỗi máy chủ (${response.status})`;
        try {
          const errJson = await response.json();
          errorMsg = errJson.error || errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch {
          errorMsg = response.statusText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    return await tryFetch(primaryBase);
  } catch (err: any) {
    // If network or CORS error on primary, try fallback base url
    if (err.message && (err.message.includes('Failed to fetch') || err.name === 'AbortError')) {
      try {
        console.warn(`Primary URL ${primaryBase} failed, attempting fallback to ${fallbackBase}...`);
        return await tryFetch(fallbackBase);
      } catch {
        // Fall through to throw original error
      }
    }
    throw err;
  }
}

export const api = {
  // --- AUTH ---
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.tokens?.access) {
      setTokens(res.tokens.access, res.tokens.refresh);
      localStorage.setItem('educarelink_current_user', JSON.stringify({
        id: res.user_id,
        username: res.username,
        role: res.role,
        first_name: res.first_name,
        last_name: res.last_name,
        is_approved: res.is_approved,
      }));
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

  // --- TASKS (Feed) ---
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

  // --- PARENT FLOW ---
  async getParentTasks(): Promise<Task[]> {
    return request<Task[]>('parent/my-tasks/');
  },

  async getTaskCandidates(taskId: number): Promise<TaskApplication[]> {
    return request<TaskApplication[]>(`parent/tasks/${taskId}/candidates/`);
  },

  async approveCandidate(applicationId: number): Promise<any> {
    return request(`parent/applications/${applicationId}/approve/`, {
      method: 'POST',
    });
  },

  async submitReview(taskId: number, rating: number, comment: string): Promise<any> {
    return request('parent/review/', {
      method: 'POST',
      body: JSON.stringify({
        task_id: taskId,
        rating,
        comment,
      }),
    });
  },

  // --- WORKER / CAREPARTNER FLOW ---
  async applyTask(taskId: number, note?: string): Promise<any> {
    return request(`worker/tasks/${taskId}/apply/`, {
      method: 'POST',
      body: JSON.stringify({ note: note || 'Tôi muốn nhận công việc này và cam kết hoàn thành tốt.' }),
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

  // --- AI CHATBOT & GEMINI ---
  async askChatbot(prompt: string): Promise<{ response: string; suggestions?: string[] }> {
    return request('chatbot/', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  async askWorkerChatbot(prompt: string): Promise<{ response: string }> {
    return request('worker/chatbot/', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  async askHelpCenter(query: string): Promise<any> {
    return request('help-center/', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  // --- TRACKING & SOS ---
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

  // --- NOTIFICATIONS ---
  async getNotifications(): Promise<NotificationItem[]> {
    return request<NotificationItem[]>('notifications/');
  },

  async getUnreadCount(): Promise<{ unread_count: number }> {
    return request('notifications/unread-count/');
  },

  async markNotificationsRead(): Promise<any> {
    return request('notifications/mark-read/', {
      method: 'POST',
    });
  },

  // --- HEALTH CHECK ---
  async checkHealth(): Promise<any> {
    return request('health/');
  },
};
