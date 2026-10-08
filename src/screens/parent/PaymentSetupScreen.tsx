/**
 * PaymentSetupScreen — STUB chuyển tiếp. Agent port sẽ thay bằng bản port đầy đủ từ
 * mobile/src/screens/parent/PaymentSetupScreen. (Route đã đăng ký trong registry.tsx.)
 */
import React from "react";
import { Screen, StatusBarSpacer, AppBar } from "@/components/ui";
import { COLORS } from "@/theme";
import { useNav } from "@/navigation/router";

const PaymentSetupScreen: React.FC = () => {
  const nav = useNav();
  return (
    <Screen bg={COLORS.background}>
      <StatusBarSpacer />
      <AppBar title="Thiết lập thanh toán" onBack={nav.goBack} />
      <div style={{ padding: 24, textAlign: "center", color: COLORS.textSecondary }}>
        Màn hình "Thiết lập thanh toán" đang được port từ bản React Native.
      </div>
    </Screen>
  );
};

export default PaymentSetupScreen;
