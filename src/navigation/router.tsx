/**
 * Navigation core — mô phỏng react-navigation của RN (AppNavigator.js):
 * - Mỗi tab có stack riêng (nested navigator); tab giữa là AI FAB.
 * - Modal screens (CreateTask, Complaint, ImagePreview, PaymentSetup,
 *   CancellationPolicy, AdminChatbot, AdminSendNotification) render phủ toàn màn, không tab bar.
 * - Hash = nguồn deep-link: #/Tab/Route?params  (vd #/ParentHome/CandidatesList?jobId=3)
 * - Back button (Zalo/web) -> popstate -> pop stack đúng thứ tự.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { parseHash, buildHash } from "@/navigation/hash";

export interface RouteEntry {
  name: string;
  params?: Record<string, any>;
}

export interface NavState {
  tab: string;
  stacks: Record<string, RouteEntry[]>;
  modal: RouteEntry | null;
}

type Role = "guest" | "parent" | "worker" | "admin";

interface NavContextValue {
  state: NavState;
  role: Role;
  setRole: (r: Role, initialTab?: string) => void;
  navigate: (name: string, params?: Record<string, any>) => void;
  replace: (name: string, params?: Record<string, any>) => void;
  push: (name: string, params?: Record<string, any>) => void;
  goBack: () => void;
  switchTab: (tab: string, screen?: string, params?: Record<string, any>) => void;
  openModal: (name: string, params?: Record<string, any>) => void;
  closeModal: () => void;
  reset: (initial: RouteEntry, tab?: string) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav phải dùng trong NavProvider");
  return ctx;
}


export const NavProvider: React.FC<{
  defaultTab: string;
  role: Role;
  onRoleChange?: (r: Role) => void;
  children: React.ReactNode;
}> = ({ defaultTab, role, onRoleChange, children }) => {
  const [state, setState] = useState<NavState>(() => ({
    tab: defaultTab,
    stacks: { [defaultTab]: [{ name: defaultTab }] },
    modal: null,
  }));
  const roleRef = useRef(role);
  roleRef.current = role;
  const suppressHash = useRef(false);

  /** Ghi hash theo visible route (không trigger vòng lặp nhờ cờ suppress) */
  const syncHash = useCallback((s: NavState) => {
    const top = s.modal ?? s.stacks[s.tab]?.[s.stacks[s.tab].length - 1];
    if (!top) return;
    const h = s.modal ? `#/${top.name}` : buildHash(s.tab, top.name, top.params);
    if (window.location.hash !== h) {
      suppressHash.current = true;
      window.history.pushState(null, "", h);
      suppressHash.current = false;
    }
  }, []);

  const apply = useCallback(
    (updater: (s: NavState) => NavState, sync = true) => {
      setState((prev) => {
        const next = updater(prev);
        if (sync) syncHash(next);
        return next;
      });
    },
    [syncHash]
  );

  /* ---- API điều hướng ---- */
  const navigate = useCallback(
    (name: string, params?: Record<string, any>) => {
      apply((s) => {
        // name là tab root -> switchTab
        if (name === "ParentHome" || name === "MyTasks" || name === "Chatbot" || name === "TrackingOverview" || name === "ParentProfile" || name === "WorkerFeed" || name === "MatchingAvailability" || name === "WorkerChatbot" || name === "MyJobs" || name === "WorkerProfile") {
          const stacks = { ...s.stacks, [name]: [{ name, params }] };
          return { tab: name, stacks, modal: null };
        }
        const stack = [...(s.stacks[s.tab] || [{ name: s.tab }])];
        // navigate tới route đã có trong stack -> quay về đó (react-navigation semantics)
        const idx = stack.findIndex((e) => e.name === name);
        if (idx >= 0) {
          stack[idx] = { name, params: params ?? stack[idx].params };
          return { ...s, stacks: { ...s.stacks, [s.tab]: stack.slice(0, idx + 1) }, modal: null };
        }
        stack.push({ name, params });
        return { ...s, stacks: { ...s.stacks, [s.tab]: stack }, modal: null };
      });
    },
    [apply]
  );

  const push = navigate;

  const replace = useCallback(
    (name: string, params?: Record<string, any>) => {
      apply((s) => {
        const stack = [...(s.stacks[s.tab] || [{ name: s.tab }])];
        stack[stack.length - 1] = { name, params };
        return { ...s, stacks: { ...s.stacks, [s.tab]: stack }, modal: null };
      });
    },
    [apply]
  );

  const goBack = useCallback(() => {
    setState((s) => {
      if (s.modal) {
        const next = { ...s, modal: null };
        syncHash(next);
        return next;
      }
      const stack = s.stacks[s.tab] || [];
      if (stack.length > 1) {
        const next = { ...s, stacks: { ...s.stacks, [s.tab]: stack.slice(0, -1) } };
        syncHash(next);
        return next;
      }
      return s; // stack 1 phần tử: no-op (như RN pop ở root)
    });
    // Lùi cả browser history để nút Back Zalo không bật lại route cũ
    try {
      const top = window.location.hash;
      if (top) window.history.back();
    } catch { /* ignore */ }
  }, [syncHash]);

  const switchTab = useCallback(
    (tab: string, screen?: string, params?: Record<string, any>) => {
      apply((s) => {
        const stack = screen && screen !== tab ? [{ name: tab }, { name: screen, params }] : [{ name: tab, params }];
        return { tab, stacks: { ...s.stacks, [tab]: stack }, modal: null };
      });
    },
    [apply]
  );

  const openModal = useCallback(
    (name: string, params?: Record<string, any>) => {
      apply((s) => ({ ...s, modal: { name, params } }));
    },
    [apply]
  );

  const closeModal = useCallback(() => {
    apply((s) => ({ ...s, modal: null }));
  }, [apply]);

  const reset = useCallback(
    (initial: RouteEntry, tab?: string) => {
      const t = tab ?? initial.name;
      apply(() => ({ tab: t, stacks: { [t]: [initial] }, modal: null }));
    },
    [apply]
  );

  /** Đổi role (login/logout) -> dựng lại toàn bộ nav state */
  const setRole = useCallback(
    (r: Role, initialTab?: string) => {
      const tab = initialTab ?? (r === "parent" ? "ParentHome" : r === "worker" ? "WorkerFeed" : r === "admin" ? "AdminDashboard" : "GuestHome");
      setState({ tab, stacks: { [tab]: [{ name: tab }] }, modal: null });
      suppressHash.current = true;
      window.history.replaceState(null, "", buildHash(tab, tab));
      suppressHash.current = false;
      onRoleChange?.(r);
    },
    [onRoleChange]
  );

  /* ---- Hash đồng bộ: deep-link + nút Back ---- */
  useEffect(() => {
    const onPop = () => {
      if (suppressHash.current) return;
      const { tab, route, params } = parseHash(window.location.hash);
      setState((s) => {
        // Back trong cùng tab: route nằm trong stack -> truncate
        if (!tab && route) {
          const stack = s.stacks[s.tab] || [];
          const idx = stack.findIndex((e) => e.name === route);
          if (idx >= 0) return { ...s, stacks: { ...s.stacks, [s.tab]: stack.slice(0, idx + 1) }, modal: null };
          return { ...s, stacks: { ...s.stacks, [s.tab]: [...stack, { name: route, params }] }, modal: null };
        }
        if (tab && route) {
          const stack = s.stacks[tab] || [];
          const idx = stack.findIndex((e) => e.name === route);
          const newStack = idx >= 0 ? stack.slice(0, idx + 1) : [stack[0] ?? { name: tab }, { name: route, params }].filter(Boolean);
          return { tab, stacks: { ...s.stacks, [tab]: newStack }, modal: null };
        }
        return s;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value = useMemo(
    () => ({ state, role, setRole, navigate, replace, push, goBack, switchTab, openModal, closeModal, reset }),
    [state, role, setRole, navigate, replace, push, goBack, switchTab, openModal, closeModal, reset]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
};

export default NavProvider;
