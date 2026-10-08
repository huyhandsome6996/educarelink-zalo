/**
 * AuthContext — port mobile/src/context/AuthContext.js.
 * Luồng: boot checkToken (GET /profile/ verify token) -> login (save tokens -> getProfile -> setUser)
 * -> register (worker: pending_approval KHÔNG auto-login; parent: auto-login) -> logout xoá 6 keys.
 * Onboarding flag = user.first_login từ profile (giống RN).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import storage from "@/utils/storage";
import * as authApi from "@/api/auth";
import { sendGpsHeartbeat } from "@/api/tracking";
import type { LoginResponse } from "@/api/auth";

export interface User {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: "parent" | "worker";
  phone_number?: string;
  address?: string;
  is_verified?: boolean;
  is_approved?: boolean;
  is_staff?: boolean;
  first_login?: boolean;
  avatar_url?: string | null;
  ai_profile_summary?: string | null;
  avg_rating?: number | string;
  review_count?: number;
  tier?: string;
  tier_label?: string;
  [key: string]: any;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (payload: Record<string, any>, files?: Record<string, File>) => Promise<{ status: string } | User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeOnboardingInContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  login: async () => null as any,
  register: async () => null as any,
  logout: async () => {},
  refreshUser: async () => {},
  completeOnboardingInContext: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** login — nguyên bản RN: loginApi -> save 4 keys -> getProfile -> setUser -> user_id */
  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const data = response as unknown as LoginResponse;
    await authApi.saveSession(data);

    const profileResp = await authApi.getProfile();
    const profile = profileResp as unknown as User;
    setUser(profile);

    if (profile?.id) await storage.setItem("user_id", String(profile.id));
    return profile;
  }, []);

  /** register — worker KHÔNG auto-login (pending_approval); parent auto-login (giống RN) */
  const register = useCallback(
    async (payload: Record<string, any>, files?: Record<string, File>) => {
      await authApi.register(payload, files as any);
      if (payload.role === "worker") return { status: "pending_approval" };
      return await login(payload.username, payload.password);
    },
    [login]
  );

  /** logout — RN xoá 6 keys: access/refresh/user_role/is_staff/user_id/tracking_task_id */
  const logout = useCallback(async () => {
    await authApi.clearAllSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = (await authApi.getProfile()) as unknown as User;
      setUser(profile);
      if (profile?.id) await storage.setItem("user_id", String(profile.id));
    } catch {
      /* interceptor đã xử lý session hết hạn */
    }
  }, []);

  /** POST /onboarding/complete/ — luôn set first_login=false kể cả API fail (giống RN) */
  const completeOnboardingInContext = useCallback(async () => {
    try {
      await authApi.completeOnboarding();
    } catch {
      /* vẫn đi tiếp */
    }
    setUser((prev) => (prev ? { ...prev, first_login: false } : prev));
  }, []);

  /* ---- GPS matching heartbeat (port syncGpsToBackend — RN AuthContext.js d.82-153) ----
   * Chỉ role worker: xin geolocation -> POST /tracking/gps-heartbeat/.
   * gps_sync === 'no_matching_consent' -> backoff 24h (key gps_no_consent_until).
   * Trigger: sau login/hydrate + interval 5 phút. Lỗi im lặng (fire-and-forget như RN). */
  const syncGpsRef = useRef(false);
  const syncGpsToBackend = useCallback(async (u: User | null) => {
    if (!u || u.role !== "worker" || syncGpsRef.current) return;
    syncGpsRef.current = true;
    try {
      const backoff = await storage.getItem("gps_no_consent_until");
      if (backoff && Date.now() < Number(backoff)) return;
      if (!navigator.geolocation) return;
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 120_000,
        })
      );
      const res = await sendGpsHeartbeat({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      });
      if ((res as any)?.gps_sync === "no_matching_consent") {
        await storage.setItem("gps_no_consent_until", String(Date.now() + 24 * 60 * 60 * 1000));
      }
    } catch {
      /* permission denied / timeout / mạng — im lặng như RN */
    } finally {
      syncGpsRef.current = false;
    }
  }, []);

  /** worker: interval 5 phút khi app active (giống RN AuthContext.js d.146-148) */
  useEffect(() => {
    if (!user || user.role !== "worker") return;
    syncGpsToBackend(user);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") syncGpsToBackend(user);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, syncGpsToBackend]);

  /** checkToken lúc mở app — nguyên bản RN */
  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await storage.getItem("access_token");
        if (token) {
          const profile = (await authApi.getProfile()) as unknown as User;
          setUser(profile);
          if (profile?.id) await storage.setItem("user_id", String(profile.id));
        }
      } catch {
        await storage.deleteItem("access_token");
        await storage.deleteItem("user_role");
        await storage.deleteItem("user_id");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkToken();
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, refreshUser, completeOnboardingInContext }),
    [user, isLoading, login, register, logout, refreshUser, completeOnboardingInContext]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
