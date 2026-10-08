/**
 * HelpCenterScreen — STUB chuyển tiếp. Agent port sẽ thay bằng bản port đầy đủ từ
 * mobile/src/screens/shared/HelpCenterScreen. (Route đã đăng ký trong registry.tsx.)
 */
import React from "react";
import { Screen, StatusBarSpacer, AppBar } from "@/components/ui";
import { COLORS } from "@/theme";
import { useNav } from "@/navigation/router";

const HelpCenterScreen: React.FC = () => {
  const nav = useNav();
  return (
    <Screen bg={COLORS.background}>
      <StatusBarSpacer />
      <AppBar title="Trung tâm trợ giúp" onBack={nav.goBack} />
      <div style={{ padding: 24, textAlign: "center", color: COLORS.textSecondary }}>
        Màn hình "Trung tâm trợ giúp" đang được port từ bản React Native.
      </div>
    </Screen>
  );
};

export default HelpCenterScreen;
