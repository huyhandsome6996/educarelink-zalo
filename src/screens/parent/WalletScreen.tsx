/**
 * WalletScreen — port CHÍNH XÁC mobile/src/screens/Parent/WalletScreen.js (181 dòng).
 * Ví credit phụ huynh (credit ảo, KHÔNG tiền thật): số dư + lịch sử giao dịch.
 * Dữ liệu: getCreditBalance() (@/api/matching — client trả data trực tiếp).
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - useFocusEffect + RefreshControl (pull-to-refresh) → refetch silent khi route
 *   nhận focus lại + nút "Thử lại" khi lỗi (không có pull-to-refresh trên web).
 * - RN quirk tái tạo 1:1: theme colors.js KHÔNG có COLORS.white / COLORS.gray /
 *   COLORS.text / SIZES.padding (undefined → RN render giá trị mặc định: chữ đen,
 *   padding 0). Web không có "undefined style" → map tường minh: WHITE/GRAY/TEXT
 *   = '#000000' (mặc định RN), padding = 0 đúng như RN render. Nếu sau này RN sửa
 *   theme (white/gray/text/padding) thì cập nhật 4 hằng này.
 * - FlatList → map array thường (danh sách ngắn, không cần virtual hoá).
 * - ActivityIndicator size large → Spinner size 36.
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import { Touchable, Spinner, Screen } from "@/components/ui";
import { COLORS, SHADOWS } from "@/theme";
import { useNav } from "@/navigation/router";
import { getCreditBalance } from "@/api/matching";

const KIND_LABELS: Record<string, string> = {
  platform_credit: "Đền bù từ hệ thống",
  service_fee_offset: "Dùng trừ phí dịch vụ",
  admin_adjust: "Điều chỉnh",
};

const GRAY = "#000000"; // COLORS.gray undefined trong RN theme → RN render mặc định đen
const WHITE = "#000000"; // COLORS.white undefined trong RN theme → RN render mặc định đen
const TEXT = "#000000"; // COLORS.text undefined trong RN theme → RN render mặc định đen
const PADDING = 0; // SIZES.padding undefined trong RN theme → padding thực tế = 0

interface CreditData {
  credit_vnd?: number;
  history?: Array<{
    id?: string | number;
    kind?: string;
    note?: string;
    issued_at?: string;
    amount_vnd?: number;
  }>;
}

const WalletScreen: React.FC = () => {
  const nav = useNav();
  const [data, setData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = (await getCreditBalance()) as CreditData;
      setData(res);
    } catch (err) {
      // Lỗi mạng/server → thông báo tiếng Việt + nút thử lại (không crash)
      setError("Không tải được ví credit. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  // RN useFocusEffect: load mỗi lần màn nhận focus
  const loadRef = useRef(load);
  loadRef.current = load;
  const topRoute = nav.state.modal?.name ?? nav.state.stacks[nav.state.tab]?.slice(-1)[0]?.name;
  const isFocused = topRoute === "WalletCredits" || topRoute === "Wallet";
  useEffect(() => {
    if (isFocused) loadRef.current();
  }, [isFocused]);

  if (error && !data) {
    return (
      <Screen bg={COLORS.background} scroll={false}>
        <div style={{ ...S.center }}>
          <Icon name="cloud-offline-outline" size={44} color="#d1d5db" />
          <span style={{ ...S.errorText, color: GRAY, textAlign: "center" }}>{error}</span>
          <Touchable style={{ ...S.retryBtn, background: COLORS.primary }} onPress={load} activeOpacity={0.8}>
            <span style={{ ...S.retryText, color: WHITE }}>Thử lại</span>
          </Touchable>
        </div>
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen bg={COLORS.background} scroll={false}>
        <div style={S.center}>
          <Spinner size={36} color={COLORS.primary} />
        </div>
      </Screen>
    );
  }

  return (
    <Screen bg={COLORS.background}>
      {/* Top bar */}
      <div style={S.topBar}>
        <Touchable
          style={S.backBtn}
          onPress={nav.goBack}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color={COLORS.textPrimary || "#1A1A2E"} />
        </Touchable>
        <span style={{ ...S.topBarTitle, color: COLORS.textPrimary || "#1A1A2E", paddingLeft: PADDING, paddingRight: PADDING }}>
          Ví Credit
        </span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Balance card */}
        <div style={{ ...S.balanceCard, background: COLORS.primary }}>
          <Icon name="wallet" size={26} color={WHITE} />
          <span style={{ ...S.balanceLabel, color: "rgba(255,255,255,0.9)" }}>Số dư credit</span>
          <span style={{ ...S.balance, color: WHITE }}>
            {(data?.credit_vnd ?? 0).toLocaleString("vi-VN")}đ
          </span>
          <span style={{ ...S.balanceNote, color: "rgba(255,255,255,0.85)", textAlign: "center" }}>
            Credit dùng để trừ phí dịch vụ cho các đơn tiếp theo — không phải tiền mặt, không rút được.
          </span>
        </div>

        <span style={{ ...S.historyTitle, color: TEXT }}>Lịch sử giao dịch</span>

        {/* History list */}
        <div style={{ padding: `0 ${PADDING}px 40px` }}>
          {(data?.history ?? []).length === 0 ? (
            <div style={S.empty}>
              <Icon name="receipt-outline" size={40} color="#ddd" />
              <span style={{ ...S.emptyText, color: GRAY, marginTop: 10 }}>Chưa có giao dịch nào.</span>
            </div>
          ) : (
            (data?.history ?? []).map((item, idx) => (
              <div key={item.id ?? idx} style={S.txRow}>
                <div style={{ ...S.txIcon, background: COLORS.primaryLight }}>
                  <Icon
                    name={item.kind === "platform_credit" ? "gift" : "arrow-down-circle"}
                    size={20}
                    color={item.kind === "platform_credit" ? "#0E9F6E" : GRAY}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...S.txTitle, color: TEXT }}>{KIND_LABELS[item.kind || ""] || item.kind}</span>
                  <span style={{ ...S.txNote, color: GRAY, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                    {item.note || ""}
                  </span>
                  <span style={{ ...S.txTime, color: GRAY, marginTop: 2 }}>
                    {item.issued_at ? new Date(item.issued_at).toLocaleString("vi-VN") : ""}
                  </span>
                </div>
                <span style={{ ...S.txAmount, color: item.kind === "platform_credit" ? "#0E9F6E" : GRAY }}>
                  +{(item.amount_vnd ?? 0).toLocaleString("vi-VN")}đ
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Screen>
  );
};

const S: Record<string, React.CSSProperties> = {
  center: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.background,
    padding: 24,
    gap: 4,
  },
  topBar: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `12px ${PADDING}px`,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  topBarTitle: { fontSize: 18, fontWeight: 700 },
  balanceCard: {
    margin: `${PADDING}px ${PADDING}px 8px`,
    borderRadius: 18,
    padding: 22,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxShadow: SHADOWS.medium,
  },
  balanceLabel: { fontSize: 13, marginTop: 6 },
  balance: { fontSize: 36, fontWeight: 800, marginTop: 2, lineHeight: "42px" },
  balanceNote: { fontSize: 11, marginTop: 8, lineHeight: "16px" },
  historyTitle: {
    padding: `12px ${PADDING}px 8px`,
    fontSize: 15,
    fontWeight: 700,
  },
  txRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    boxShadow: SHADOWS.small,
    gap: 12,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  txTitle: { fontSize: 14, fontWeight: 600, display: "block" },
  txNote: { fontSize: 12, display: "block" },
  txTime: { fontSize: 11, display: "block" },
  txAmount: { fontSize: 14, fontWeight: 700, flexShrink: 0 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 50 },
  emptyText: {},
  errorText: { marginTop: 10, fontSize: 15 },
  retryBtn: {
    marginTop: 14,
    padding: "8px 20px",
    borderRadius: 16,
  },
  retryText: { fontWeight: 600, fontSize: 14 },
};

export default WalletScreen;
