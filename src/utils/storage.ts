/**
 * Storage abstraction — tương đương mobile/src/utils/storage.js của RN.
 * Zalo webview: localStorage khả dụng; fallback in-memory nếu bị chặn.
 * Keys chuẩn RN: access_token, refresh_token, user_role, is_staff, user_id,
 * tracking_task_id, gps_no_consent_until.
 */

const memory = new Map<string, string>();
let warned = false;

function lsAvailable(): boolean {
  try {
    const k = "__edc_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    if (!warned) {
      console.warn("[EduCareLink] localStorage bị chặn — dùng bộ nhớ tạm trong phiên.");
      warned = true;
    }
    return false;
  }
}

const useLs = typeof window !== "undefined" && lsAvailable();

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (useLs) return window.localStorage.getItem(key);
      return memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (useLs) window.localStorage.setItem(key, value);
      else memory.set(key, value);
    } catch {
      memory.set(key, value);
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      if (useLs) window.localStorage.removeItem(key);
      memory.delete(key);
    } catch {
      memory.delete(key);
    }
  },

  /** Đồng bộ (dùng khi render cần đọc ngay, ví dụ initial route) */
  getSync(key: string): string | null {
    try {
      if (useLs) return window.localStorage.getItem(key);
      return memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
};

export default storage;
