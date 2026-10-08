/**
 * RootNavigator — port logic nhánh của AppNavigator.js (d.342-461):
 * isLoading -> LoadingView; !user -> Guest(Splash/GuestHome/Login/Register);
 * user.first_login -> Onboarding (role); worker&&!is_approved -> WorkerScreeningStatus;
 * is_staff -> Admin tree; parent -> ParentTabs(+TabBar); else -> WorkerTabs(+TabBar).
 * Modal routes render phủ toàn màn không tab bar (như presentation:'modal').
 */
import React, { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationsProvider } from "@/components/ui";
import NavProvider, { useNav } from "@/navigation/router";
import { SCREENS, MODAL_ROUTES, NavLoadingView } from "@/navigation/registry";
import { PARENT_TABS, WORKER_TABS, TabBar } from "@/components/TabBar";

type Role = "guest" | "parent" | "worker" | "admin";

const TAB_BAR_SPACE = 84;

const Inner: React.FC = () => {
  const { user, isLoading } = useAuth();
  const nav = useNav();
  const mounted = useRef(false);

  const role: Role = !user
    ? "guest"
    : user.is_staff
    ? "admin"
    : user.role === "parent"
    ? "parent"
    : "worker";

  /* Khởi tạo / đổi nhánh khi auth state thay đổi */
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      if (!mounted.current || nav.role !== "guest") nav.setRole("guest");
      mounted.current = true;
      return;
    }
    mounted.current = true;
    if (user.first_login) return; // Onboarding render trực tiếp, không cần tab
    if (user.role === "worker" && !user.is_approved) return;
    const tab =
      role === "admin" ? "AdminDashboard" : role === "parent" ? "ParentHome" : "WorkerFeed";
    if (nav.role !== role) nav.setRole(role, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, role]);

  if (isLoading) return <NavLoadingView />;

  /* Nhánh Onboarding (first_login) — component theo role như AppNavigator */
  if (user?.first_login) {
    const Onb = SCREENS["Onboarding"];
    return <Onb />;
  }

  /* Worker chờ duyệt */
  if (user?.role === "worker" && !user.is_approved) {
    const Scr = SCREENS["WorkerScreeningStatus"];
    return <Scr />;
  }

  const showTabBar = (role === "parent" || role === "worker") && !nav.state.modal;
  const top = nav.state.modal ?? nav.state.stacks[nav.state.tab]?.[nav.state.stacks[nav.state.tab].length - 1];
  if (!top) return <NavLoadingView />;

  const ScreenComp = SCREENS[top.name] ?? SCREENS["GuestHome"];
  const isModal = !!nav.state.modal && MODAL_ROUTES.has(nav.state.modal.name);

  return (
    <div style={{ minHeight: "100dvh", position: "relative" }}>
      {/* Màn nền phía dưới modal (RN giữ nguyên screen dưới modal) */}
      {nav.state.modal &&
        (() => {
          const entry = nav.state.stacks[nav.state.tab]?.slice(-1)[0];
          if (!entry) return null;
          const Underneath = SCREENS[entry.name];
          if (!Underneath) return null;
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
              <Underneath {...(entry.params ?? {})} />
            </div>
          );
        })()}

      {/* Màn hiện tại */}
      <div key={`${nav.state.tab}/${top.name}`} style={showTabBar ? { paddingBottom: TAB_BAR_SPACE } : undefined}>
        <ScreenComp {...(top.params ?? {})} />
      </div>

      {/* Modal phủ toàn màn */}
      {nav.state.modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: COLORS_BG }}>
          <ScreenComp {...(nav.state.modal.params ?? {})} />
        </div>
      )}

      {/* Tab bar */}
      {showTabBar && <TabBar tabs={role === "parent" ? PARENT_TABS : WORKER_TABS} />}
    </div>
  );
};

const COLORS_BG = "rgba(242,101,34,0)";

const Root: React.FC = () => {
  const { user, isLoading } = useAuth();
  const role: Role = !user ? "guest" : user.is_staff ? "admin" : user.role === "parent" ? "parent" : "worker";
  const defaultTab =
    role === "admin" ? "AdminDashboard" : role === "parent" ? "ParentHome" : role === "worker" ? "WorkerFeed" : "GuestHome";

  return (
    <NotificationsProvider enabled={!isLoading && !!user}>
      <NavProvider role={role} defaultTab={defaultTab}>
        <Inner />
      </NavProvider>
    </NotificationsProvider>
  );
};

const RootNavigator: React.FC = () => (
  <AuthProvider>
    <Root />
  </AuthProvider>
);

export default RootNavigator;
