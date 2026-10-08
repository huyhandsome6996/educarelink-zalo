/**
 * Tab bar — port nguyên văn styles.tabBar + TabIcon + raisedFab từ AppNavigator.js (d.498-562).
 * Parent: Trang chủ(home) / Công việc(list) / AI Trợ lý(FAB hardware-chip) / Theo dõi(location) / Tài khoản(person)
 * Worker: Trang chủ(home) / Lịch rảnh(calendar) / AI Trợ lý(FAB) / Công việc(briefcase) / Tài khoản(person)
 */
import React from "react";
import Icon from "@/components/Icon";
import { COLORS, TAB_BAR, TAB_BAR_LABEL, TAB_ICON_BG, TAB_ACTIVE_INDICATOR, RAISED_FAB, RAISED_FAB_FOCUSED, TYPO } from "@/theme";
import { Touchable } from "@/components/ui";
import { useNav } from "@/navigation/router";

export interface TabDef {
  name: string;
  label: string;
  icon: string;
  iconOutline: string;
}

export const PARENT_TABS: TabDef[] = [
  { name: "ParentHome", label: "Trang chủ", icon: "home", iconOutline: "home-outline" },
  { name: "MyTasks", label: "Công việc", icon: "list", iconOutline: "list-outline" },
  { name: "Chatbot", label: "AI Trợ lý", icon: "hardware-chip", iconOutline: "hardware-chip" },
  { name: "TrackingOverview", label: "Theo dõi", icon: "location", iconOutline: "location-outline" },
  { name: "ParentProfile", label: "Tài khoản", icon: "person", iconOutline: "person-outline" },
];

export const WORKER_TABS: TabDef[] = [
  { name: "WorkerFeed", label: "Trang chủ", icon: "home", iconOutline: "home-outline" },
  { name: "MatchingAvailability", label: "Lịch rảnh", icon: "calendar", iconOutline: "calendar-outline" },
  { name: "WorkerChatbot", label: "AI Trợ lý", icon: "hardware-chip", iconOutline: "hardware-chip" },
  { name: "MyJobs", label: "Công việc", icon: "briefcase", iconOutline: "briefcase-outline" },
  { name: "WorkerProfile", label: "Tài khoản", icon: "person", iconOutline: "person-outline" },
];

export const TabBar: React.FC<{ tabs: TabDef[] }> = ({ tabs }) => {
  const nav = useNav();
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-around",
        zIndex: 100,
        ...TAB_BAR,
      }}
    >
      {tabs.map((tab) => {
        const focused = nav.state.tab === tab.name;
        const isFab = tab.name === "Chatbot" || tab.name === "WorkerChatbot";

        if (isFab) {
          return (
            <Touchable
              key={tab.name}
              onPress={() => nav.switchTab(tab.name)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: -20, width: 72 }}
            >
              <div
                style={{
                  ...RAISED_FAB,
                  ...(focused ? RAISED_FAB_FOCUSED : {}),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="hardware-chip" size={26} color="#fff" />
              </div>
              <div style={{ ...TAB_BAR_LABEL, color: focused ? COLORS.primary : COLORS.textMuted }}>{tab.label}</div>
            </Touchable>
          );
        }

        return (
          <Touchable
            key={tab.name}
            onPress={() => nav.switchTab(tab.name)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2, flex: 1, maxWidth: 96 }}
          >
            <div
              style={{
                ...TAB_ICON_BG,
                background: focused ? COLORS.primaryLight : "transparent",
              }}
            >
              <Icon name={focused ? tab.icon : tab.iconOutline} size={22} color={focused ? COLORS.primary : COLORS.textMuted} />
            </div>
            <div style={{ ...TAB_ACTIVE_INDICATOR, background: focused ? COLORS.primary : "transparent" }} />
            <div style={{ ...TAB_BAR_LABEL, color: focused ? COLORS.primary : COLORS.textMuted }}>{tab.label}</div>
          </Touchable>
        );
      })}
    </div>
  );
};

export default TabBar;
