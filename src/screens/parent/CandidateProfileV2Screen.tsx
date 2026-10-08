/**
 * CandidateProfileV2Screen — STUB chuyển tiếp. Agent port sẽ thay bằng bản port đầy đủ từ
 * mobile/src/screens/parent/CandidateProfileV2Screen. (Route đã đăng ký trong registry.tsx.)
 */
import React from "react";
import { Screen, StatusBarSpacer, AppBar } from "@/components/ui";
import { COLORS } from "@/theme";
import { useNav } from "@/navigation/router";

const CandidateProfileV2Screen: React.FC = () => {
  const nav = useNav();
  return (
    <Screen bg={COLORS.background}>
      <StatusBarSpacer />
      <AppBar title="Hồ sơ ứng viên" onBack={nav.goBack} />
      <div style={{ padding: 24, textAlign: "center", color: COLORS.textSecondary }}>
        Màn hình "Hồ sơ ứng viên" đang được port từ bản React Native.
      </div>
    </Screen>
  );
};

export default CandidateProfileV2Screen;
