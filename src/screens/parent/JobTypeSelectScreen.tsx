/**
 * JobTypeSelectScreen — port CHÍNH XÁC mobile/src/screens/Parent/JobTypeSelectScreen.js (633 dòng).
 * Flow 1 Step 1: chọn 1 trong ĐÚNG 3 loại việc — bản thiết kế Google Stitch (Mobile Consumer App).
 * Cấu trúc: App bar (back 38×38 + title "Đăng việc mới" + sub "EduCareLink Caregiver" + help badge),
 * greeting "Hôm nay gia đình / cần hỗ trợ gì?" + context pill vàng "⚡ 120+ CarePartner...",
 * AI express card cam (#F26522) "TỰ ĐỘNG AI / Đăng việc siêu tốc trong 5s" → nav.navigate('Chatbot'),
 * 3 option card (accent strip trái 4px + icon box 48×48 + badge/price pill + tags + chevron):
 *   Gia sư & Kèm học → TutoringForm · Đồng hành cùng trẻ tại nhà → ChildcareForm ·
 *   Đón trẻ tan học → PickupForm,
 * trust strip "CAM KẾT BẢO VỆ 3 LỚP EDUCARE".
 *
 * Khác biệt platform (ghi mobile-parity-map.md):
 * - RN KHÔNG dùng image assets trong screen này (toàn bộ là Ionicons) → giữ nguyên Ionicons;
 *   2 glyph thiếu trong bộ 159 (card, navigate-circle) map sang glyph gần nhất cùng nghĩa
 *   (card-outline, navigate) vì không được sửa ionicons.ts.
 * - Alert.alert 1 nút ("Đã hiểu") → showAlert (window.alert).
 * - SafeAreaInsets → StatusBarSpacer (Zalo) + TabBar height 84 giữ chỗ cuối trang.
 */
import React from "react";
import Icon from "@/components/Icon";
import { Touchable, showAlert, StatusBarSpacer, Screen } from "@/components/ui";
import { SHADOWS, TAB_BAR_HEIGHT } from "@/theme";
import { useNav } from "@/navigation/router";

/* Alias glyph Ionicons thiếu trong bộ 159 → glyph gần nhất cùng nghĩa */
const ic = (name: string) =>
  (
    {
      card: "card-outline",
      "navigate-circle": "navigate",
    } as Record<string, string>
  )[name] ?? name;

const JOB_TYPES = [
  {
    type: "tutoring",
    title: "Gia sư & Kèm học",
    desc: "Dạy kèm Toán, Văn, Anh & năng khiếu (Vẽ, Đàn, Kỹ năng sống, MC nhí)...",
    price: "Từ 70.000đ / giờ",
    badge: "🔥 Được đặt nhiều nhất",
    badgeBg: "#FFF4ED",
    badgeText: "#C2410C",
    badgeBorder: "#FED7AA",
    accentColor: "#F26522",
    iconBg: "#FFF4ED",
    iconBorder: "#FED7AA",
    icon: "school",
    tags: ["Sinh viên giỏi ĐH Top", "Đã kiểm tra bằng cấp"],
    screen: "TutoringForm",
  },
  {
    type: "childcare",
    title: "Đồng hành cùng trẻ tại nhà",
    desc: "Cho bé ăn uống, vui chơi an toàn, rèn nếp tự lập & hướng dẫn thói quen tốt.",
    price: "Từ 60.000đ / giờ",
    badge: "❤️ Chăm sóc tận tâm",
    badgeBg: "#ECFDF5",
    badgeText: "#047857",
    badgeBorder: "#A7F3D0",
    accentColor: "#0D9488",
    iconBg: "#ECFDF5",
    iconBorder: "#A7F3D0",
    icon: "heart",
    tags: ["Đã xác thực CCCD gắn chip", "Kinh nghiệm mầm non"],
    screen: "ChildcareForm",
  },
  {
    type: "pickup",
    title: "Đón trẻ tan học",
    desc: "Đón bé từ cổng trường về nhà hoặc tới lớp học thêm với lộ trình giám sát chuẩn.",
    price: "Từ 50.000đ / chuyến",
    badge: "📍 Live GPS Tracking 24/7",
    badgeBg: "#EFF6FF",
    badgeText: "#1D4ED8",
    badgeBorder: "#BFDBFE",
    accentColor: "#2563EB",
    iconBg: "#EFF6FF",
    iconBorder: "#BFDBFE",
    icon: "car",
    tags: ["Báo cáo check-in ảnh", "Có bảo hiểm chuyến đi"],
    screen: "PickupForm",
  },
] as const;

const TRUST_ITEMS = [
  {
    bg: "#ECFDF5",
    icon: "shield-checkmark",
    iconColor: "#10B981",
    bold: "100% Hồ sơ",
    rest: " đối soát CCCD gắn chip & thẻ Sinh viên",
  },
  {
    bg: "#EFF6FF",
    icon: "card", // RN: "card" → alias card-outline
    iconColor: "#2563EB",
    bold: "Ký quỹ MoMo/VietQR:",
    rest: " Chỉ thanh toán khi phụ huynh hài lòng",
  },
  {
    bg: "#FFF4ED",
    icon: "navigate-circle", // RN: "navigate-circle" → alias navigate
    iconColor: "#F26522",
    bold: "An tâm di chuyển:",
    rest: " Giám sát thời gian thực & nút SOS hỗ trợ",
  },
];

const JobTypeSelectScreen: React.FC = () => {
  const nav = useNav();

  const handleHelpPress = () => {
    showAlert(
      "Quy trình ghép cặp Flow 1",
      "Hệ thống EduCareLink sẽ tự động đối soát lịch rảnh và định vị GPS để gợi ý tối đa 8 CarePartner uy tín nhất cho bạn chọn.\n\nSau khi bạn chọn, CarePartner sẽ có thời gian cam kết nhận ca trước khi ca làm bắt đầu."
    );
  };

  const handleAIPress = () => {
    nav.navigate("Chatbot");
  };

  return (
    <Screen bg="#F8FAFC" scroll={false} style={{ height: "100dvh", paddingBottom: TAB_BAR_HEIGHT }}>
      <StatusBarSpacer />

      {/* Top App Bar Navigation */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: "#F8FAFC",
        }}
      >
        <Touchable
          onPress={() => nav.goBack()}
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: SHADOWS.small,
            flexShrink: 0,
          }}
        >
          <Icon name="arrow-back" size={20} color="#1E293B" />
        </Touchable>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", letterSpacing: -0.2 }}>Đăng việc mới</div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "#F26522" }} />
            <div style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>EduCareLink Caregiver</div>
          </div>
        </div>

        <Touchable
          onPress={handleHelpPress}
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: SHADOWS.small,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <Icon name="help-circle-outline" size={21} color="#64748B" />
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 7,
              height: 7,
              borderRadius: 3.5,
              background: "#F26522",
            }}
          />
        </Touchable>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "8px 16px 40px" }}>
          {/* Header & Contextual Greeting */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 23, fontWeight: 800, color: "#0F172A", lineHeight: "30px", letterSpacing: -0.5 }}>
              Hôm nay gia đình
              <br />
              <span style={{ color: "#F26522" }}>cần hỗ trợ gì?</span>
            </div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 6, lineHeight: "19px" }}>
              Chọn loại dịch vụ để hệ thống tự động đề xuất CarePartner phù hợp nhất gần bạn.
            </div>

            {/* Context Live Pill Indicator */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                background: "#FEF3C7",
                border: "1px solid #FDE68A",
                borderRadius: 20,
                padding: "5px 10px",
                marginTop: 10,
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: "#F59E0B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: 4, height: 4, borderRadius: 2, background: "#FFFFFF" }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>
                ⚡ 120+ CarePartner đang sẵn sàng gần bạn
              </div>
            </div>
          </div>

          {/* AI Express Shortcut Card */}
          <Touchable
            activeOpacity={0.9}
            onPress={handleAIPress}
            style={{
              background: "#F26522",
              borderRadius: 18,
              padding: 14,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              boxShadow: "0px 6px 12px rgba(242, 101, 34, 0.28)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="flash" size={20} color="#FFFFFF" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.25)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: "#FFFFFF", fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>TỰ ĐỘNG AI</span>
                  </div>
                  <span style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700, flex: 1 }}>Đăng việc siêu tốc trong 5s</span>
                </div>
                <div
                  style={{
                    color: "#FFEDD5",
                    fontSize: 11,
                    marginTop: 2,
                    lineHeight: "15px",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                  }}
                >
                  Chỉ cần gõ hoặc nói tự nhiên, AI tự động chọn đối tác & gợi ý mức phí.
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                background: "#FFFFFF",
                padding: "6px 10px",
                borderRadius: 14,
                gap: 2,
                marginLeft: 8,
                boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#F26522", fontSize: 11, fontWeight: 800 }}>Thử ngay</span>
              <Icon name="chevron-forward" size={13} color="#F26522" />
            </div>
          </Touchable>

          {/* 3 Core Service Selection Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {JOB_TYPES.map((item) => (
              <Touchable
                key={item.type}
                activeOpacity={0.88}
                onPress={() => nav.navigate(item.screen)}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 18,
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "0px 2px 8px rgba(15, 23, 42, 0.05)",
                  display: "block",
                }}
              >
                {/* Left Decorative Accent Strip */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: item.accentColor,
                  }}
                />

                <div style={{ padding: 14, paddingLeft: 16 }}>
                  {/* Top Badge & Price */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: "3px 8px",
                        borderRadius: 12,
                        border: `1px solid ${item.badgeBorder}`,
                        background: item.badgeBg,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: item.badgeText }}>{item.badge}</span>
                    </div>
                    <div
                      style={{
                        padding: "3px 8px",
                        borderRadius: 8,
                        border: `1px solid ${item.badgeBorder}`,
                        background: item.badgeBg,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 800, color: item.badgeText }}>{item.price}</span>
                    </div>
                  </div>

                  {/* Main Body: Icon + Details */}
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        border: `1px solid ${item.iconBorder}`,
                        background: item.iconBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={item.icon} size={26} color={item.accentColor} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{item.title}</span>
                        <Icon name="chevron-forward" size={18} color="#94A3B8" />
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748B",
                          marginTop: 3,
                          lineHeight: "17px",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        }}
                      >
                        {item.desc}
                      </div>

                      {/* Tags */}
                      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {item.tags.map((tag, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              flexDirection: "row",
                              alignItems: "center",
                              background: "#F1F5F9",
                              padding: "2.5px 7px",
                              borderRadius: 10,
                              gap: 4,
                            }}
                          >
                            <Icon name="checkmark-circle" size={12} color="#10B981" />
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#475569" }}>{tag}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Touchable>
            ))}
          </div>

          {/* Trust & Safety Assurance Strip */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              border: "1px solid #E2E8F0",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingBottom: 6,
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#10B981" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#475569", letterSpacing: 0.5 }}>
                CAM KẾT BẢO VỆ 3 LỚP EDUCARE
              </span>
            </div>

            {TRUST_ITEMS.map((t, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: t.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={ic(t.icon)} size={14} color={t.iconColor} />
                </div>
                <div style={{ fontSize: 11, color: "#475569", flex: 1, lineHeight: "16px" }}>
                  <span style={{ fontWeight: 700, color: "#0F172A" }}>{t.bold}</span>
                  {t.rest}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
};

export default JobTypeSelectScreen;
