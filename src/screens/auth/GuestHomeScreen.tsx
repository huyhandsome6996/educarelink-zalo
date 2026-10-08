/**
 * GuestHomeScreen — port CHÍNH XÁC mobile/src/screens/Auth/GuestHomeScreen.js (1503 dòng).
 * - Sticky header mờ 95%: logo badge 36 nền trắng shadow cam + EduCare|Link + tagline + hotline pill + VN pill + online dot
 *   (health check GET /tracking/health/ → fallback /payments/health/; fail → dot xám — theo đề bài, RN chỉ ẩn dot).
 * - Hero carousel 3 slide autoplay 4s (gradient bgMain→bgBottom, watermark 110 trắng 12%, promo badge #FBBF24, CTA mở role modal).
 * - QuickStats (50.000+ / 4.9★ / 100% CCCD), 4 bento "Hệ Sinh Thái Dịch Vụ", Safety 3 lớp,
 *   testimonial "Chị Thu Trang", student banner #0F172A, CTA cam + login link.
 * - Bottom nav giả 5 slot (FAB AI 46×46 viền trắng 3px) — item không active → showAlert yêu cầu đăng nhập (giống RN).
 * - Role modal bottom-sheet radius-top 28 render absolute phủ màn + backdrop (KHÔNG dùng openModal — GuestHome là 1 route).
 * Khác platform (ghi mobile-parity-map.md): Alert.alert đa nút (FAB/nav) → showAlert 1 nút;
 * ScrollView ngang + snapToInterval → scroll-snap div; tel: link vẫn mở như Linking.openURL.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, showAlert, StatusBarSpacer } from "@/components/ui";
import { COLORS } from "@/theme";
import { useNav } from "@/navigation/router";
import api from "@/api/client";

/* Glyph Ionicons 7.4.0 thiếu trong src/components/icons/ionicons.ts (file chung không được phép sửa) — nhúng cục bộ đúng path */
const LOCAL_ICONS: Record<string, string> = {
  headset:
    '<path d="M411.16 97.46C368.43 55.86 311.88 32 256 32S143.57 55.86 100.84 97.46C56.45 140.67 32 197 32 256c0 26.67 8.75 61.09 32.88 125.55S137 473 157.27 477.41c5.81 1.27 12.62 2.59 18.73 2.59a60.06 60.06 0 0030-8l14-8c15.07-8.82 19.47-28.13 10.8-43.35l-86.92-152.57a31.73 31.73 0 00-43.57-11.76l-13.69 8a56.49 56.49 0 00-14 11.59 4 4 0 01-7-2A114.68 114.68 0 0164 256c0-50.31 21-98.48 59.16-135.61C160 84.55 208.39 64 256 64s96 20.55 132.84 56.39C427 157.52 448 205.69 448 256a114.68 114.68 0 01-1.68 17.91 4 4 0 01-7 2 56.49 56.49 0 00-14-11.59l-13.69-8a31.73 31.73 0 00-43.57 11.76L281.2 420.65c-8.67 15.22-4.27 34.53 10.8 43.35l14 8a60.06 60.06 0 0030 8c6.11 0 12.92-1.32 18.73-2.59C375 473 423 446 447.12 381.55S480 282.67 480 256c0-59-24.45-115.33-68.84-158.54z"/>',
  "lock-closed":
    '<path d="M368 192h-16v-80a96 96 0 10-192 0v80h-16a64.07 64.07 0 00-64 64v176a64.07 64.07 0 0064 64h224a64.07 64.07 0 0064-64V256a64.07 64.07 0 00-64-64zm-48 0H192v-80a64 64 0 11128 0z"/>',
};

/** Icon: dùng glyph cục bộ nếu thiếu, còn lại dùng <Icon> chuẩn dự án */
const Glyph: React.FC<{ name: string; size: number; color: string; style?: React.CSSProperties }> = ({
  name,
  size,
  color,
  style,
}) => {
  const local = LOCAL_ICONS[name];
  if (local) {
    return (
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        style={{ color, flexShrink: 0, ...style }}
        dangerouslySetInnerHTML={{ __html: local }}
      />
    );
  }
  return <Icon name={name} size={size} color={color} style={style} />;
};

/** rgba từ hex — dùng cho shadow theo màu slide (RN shadowColor + shadowOpacity) */
const hexA = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* 3 slides theo chuẩn Stitch Mockup — NGUYÊN VĂN từ file RN */
const HERO_SLIDES = [
  {
    id: 1,
    badgeText: "Top 5% SV các trường Đại học Huế",
    badgeIcon: "star",
    badgeColor: "#FDE047",
    headline: "Gia sư kèm cặp tận tâm\nngay tại gia đình",
    subtext: "An tâm gửi gắm, trọn vẹn yêu thương với sinh viên ưu tú.",
    promoBadge: "GIẢM 50K CA ĐẦU",
    btnText: "Đặt ngay",
    iconName: "school",
    roleTarget: "parent",
    bgMain: "#EA580C",
    bgBottom: "#C2410C",
    glowColor: "rgba(234, 88, 12, 0.35)",
  },
  {
    id: 2,
    badgeText: "GPS định vị 2 chiều trực tiếp",
    badgeIcon: "navigate",
    badgeColor: "#6EE7B7",
    headline: "Đón con tan trường\nchuẩn xác từng phút",
    subtext: "Cập nhật ảnh điểm danh tại cổng trường và lộ trình về nhà.",
    promoBadge: "Chỉ từ 90k/chuyến",
    btnText: "Xem lộ trình",
    iconName: "walk",
    roleTarget: "parent",
    bgMain: "#0284C7",
    bgBottom: "#075985",
    glowColor: "rgba(2, 132, 199, 0.3)",
  },
  {
    id: 3,
    badgeText: "Bảo chứng 100% MoMo Escrow",
    badgeIcon: "shield-checkmark",
    badgeColor: "#FDE047",
    headline: "Minh bạch tuyệt đối\nan toàn tài chính",
    subtext: "Chỉ giải ngân khi buổi dạy hoàn tất đúng tiến độ và cam kết.",
    promoBadge: "An tâm 100%",
    btnText: "Khám phá",
    iconName: "shield-checkmark",
    roleTarget: "parent",
    bgMain: "#059669",
    bgBottom: "#064E3B",
    glowColor: "rgba(5, 150, 105, 0.3)",
  },
] as const;

/* 4 Trụ Cột Dịch Vụ Chủ Lực — NGUYÊN VĂN từ file RN */
interface ServiceItem {
  id: string;
  title: string;
  desc: string;
  price: string;
  icon: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  priceColor: string;
  role: string;
  badge?: string;
  isAi?: boolean;
}
const SERVICE_ECOSYSTEM: ServiceItem[] = [
  {
    id: "tutor",
    title: "Gia sư tại nhà",
    desc: "Toán, Tiếng Việt/Văn, Ngoại ngữ & luyện chữ chuẩn sư phạm.",
    price: "Từ 120k/h",
    icon: "book",
    iconBg: "#FFF7ED",
    iconBorder: "#FED7AA",
    iconColor: "#EA580C",
    priceColor: "#EA580C",
    role: "parent",
  },
  {
    id: "pickup",
    title: "Đón trẻ an toàn",
    desc: "Đón tận cổng trường về nhà, GPS định vị & bảo hiểm hành trình.",
    price: "Từ 90k/lượt",
    icon: "walk",
    iconBg: "#EFF6FF",
    iconBorder: "#BFDBFE",
    iconColor: "#0284C7",
    priceColor: "#0284C7",
    role: "parent",
  },
  {
    id: "childcare",
    title: "Đồng hành cùng trẻ tại nhà",
    desc: "Chăm sóc bé, hỗ trợ ăn uống, trò chuyện rèn kỹ năng cảm xúc.",
    price: "Từ 100k/h",
    icon: "heart",
    iconBg: "#FFF1F2",
    iconBorder: "#FECDD3",
    iconColor: "#E11D48",
    priceColor: "#E11D48",
    role: "parent",
  },
  {
    id: "ai_radar",
    title: "AI Trợ Lý Radar",
    badge: "MỚI",
    desc: "Tìm kiếm & tự động ghép đôi CarePartner thích hợp trong 30s.",
    price: "Miễn phí trải nghiệm",
    icon: "hardware-chip",
    iconBg: "#FFF7ED",
    iconBorder: "#FDBA74",
    iconColor: "#F26522",
    priceColor: "#EA580C",
    isAi: true,
    role: "parent",
  },
];

/* 3 Lớp Cam Kết Xác Thực — NGUYÊN VĂN từ file RN */
const SAFETY_PILLARS = [
  {
    id: 1,
    title: "Xác minh CCCD chip & Thẻ sinh viên",
    desc: "Đối soát hồ sơ trực tiếp với danh sách sinh viên trường ĐH uy tín.",
  },
  {
    id: 2,
    title: "Giám sát lộ trình GPS 2 chiều",
    desc: "Phụ huynh theo dõi trực tiếp vị trí và nhận thông báo theo thời gian thực.",
  },
  {
    id: 3,
    title: "Bảo lãnh ký quỹ MoMo Escrow 100%",
    desc: "Học phí được giữ trung gian, chỉ chi trả khi phụ huynh xác nhận hài lòng.",
  },
] as const;

/* Bottom Nav — NGUYÊN VĂN từ file RN */
const NAV_ITEMS: NavItem[] = [
  { id: 1, icon: "home", iconOutline: "home-outline", label: "Trang chủ", active: true },
  { id: 2, icon: "receipt", iconOutline: "receipt-outline", label: "Hoạt động", active: false },
  { id: 3, icon: "hardware-chip", iconOutline: "hardware-chip-outline", label: "AI", active: false, isFab: true },
  { id: 4, icon: "people", iconOutline: "people-outline", label: "Cộng đồng", active: false },
  { id: 5, icon: "person", iconOutline: "person-outline", label: "Tài khoản", active: false },
];

interface NavItem {
  id: number;
  icon: string;
  iconOutline: string;
  label: string;
  active: boolean;
  isFab?: boolean;
}

const GuestHomeScreen: React.FC = () => {
  const nav = useNav();

  /* States — như RN */
  const [activeSlide, setActiveSlide] = useState(0);
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [modalUp, setModalUp] = useState(false); // translateY 300 -> 0 (RN modalSlideAnim)
  const [entered, setEntered] = useState(false); // fadeAnim 0->1 + slideUpAnim 24->0, 500ms

  const carouselRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [cardW, setCardW] = useState(0); // CAROUSEL_WIDTH = min(SCREEN_WIDTH - 32, 398)

  /* Health-check backend live — RN: apiClient.get('/health/') check status==='ok'.
     Zalo: /tracking/health/ -> fallback /payments/health/ (theo đề bài); fail -> dot xám */
  useEffect(() => {
    let isMounted = true;
    api
      .get("/tracking/health/")
      .catch(() => api.get("/payments/health/"))
      .then((res: any) => {
        if (isMounted && res?.status === "ok") setIsBackendOnline(true);
      })
      .catch(() => {
        if (isMounted) setIsBackendOnline(false);
      });

    const raf = requestAnimationFrame(() => setEntered(true));
    return () => {
      isMounted = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  /* Đo bề rộng carousel (RN: Dimensions.get('window')) */
  useLayoutEffect(() => {
    const measure = () => {
      const el = carouselRef.current;
      if (el) setCardW(Math.min(el.clientWidth, 398));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* Autoplay Hero Carousel 4s — như RN */
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % HERO_SLIDES.length;
        if (carouselRef.current) {
          carouselRef.current.scrollTo({ left: next * (cardW + 12), behavior: "smooth" });
        }
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [cardW]);

  /* Modal slide-up spring (tension 65/friction 11) → transition cubic-bezier */
  useEffect(() => {
    if (!roleModalVisible) return undefined;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setModalUp(true)));
    return () => cancelAnimationFrame(id);
  }, [roleModalVisible]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const openRoleModal = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setRoleModalVisible(true);
  };

  const closeRoleModal = () => {
    setModalUp(false); // RN: timing 200ms về 300 rồi unmount
    closeTimer.current = window.setTimeout(() => setRoleModalVisible(false), 200);
  };

  const handleSelectRole = (role: "parent" | "worker") => {
    setRoleModalVisible(false);
    setModalUp(false);
    nav.navigate("Register", { role });
  };

  const handleCallHotline = () => {
    try {
      window.location.href = "tel:19006828";
    } catch {
      showAlert("Hotline EduCareLink", "Tổng đài hỗ trợ: 1900 6828 (Miễn phí)");
    }
  };

  const handleNavPress = (item: NavItem) => {
    if (item.id === 1) {
      // Home
      return;
    }
    if (item.id === 5) {
      // Tài khoản
      nav.navigate("Login");
      return;
    }
    if (item.isFab) {
      // AI button — RN Alert 3 nút ('Để sau'/'Đăng nhập'/'Đăng ký') → web showAlert 1 nút (platform limit)
      showAlert(
        "AI Trợ Lý EduCareLink",
        "Tính năng AI tự động ghép cặp và phân tích nhu cầu. Hãy tạo tài khoản hoặc đăng nhập để trải nghiệm!"
      );
      return;
    }
    // Hoạt động / Cộng đồng — RN Alert ['Huỷ'/'Đăng nhập'] → showAlert
    showAlert("Yêu cầu đăng nhập", `Vui lòng đăng nhập để truy cập tính năng ${item.label}.`);
  };

  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || !cardW) return;
    const idx = Math.max(0, Math.min(HERO_SLIDES.length - 1, Math.round(el.scrollLeft / (cardW + 12))));
    setActiveSlide(idx);
  };

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#F8FAFC",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{".edc-noscroll{scrollbar-width:none}.edc-noscroll::-webkit-scrollbar{display:none}"}</style>

      {/* BEGIN: TopBrandBar — sticky, nền mờ 95% */}
      <div
        style={{
          background: "rgba(248, 250, 252, 0.95)",
          borderBottom: "1px solid #E2E8F0",
          padding: "0 16px 10px",
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        <StatusBarSpacer />
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Logo chính thức EduCareLink */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: "#ffffff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                boxShadow: "0px 4px 6px rgba(242, 101, 34, 0.3)",
                flexShrink: 0,
              }}
            >
              <img src="/static/images/logo.png" alt="EduCareLink" style={{ width: 28, height: 28, objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", letterSpacing: -0.5, lineHeight: "20px" }}>
                EduCare<span style={{ color: "#F26522" }}>Link</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.2, marginTop: 1 }}>
                CARE WITH LOVE &amp; TECH
              </div>
            </div>
          </div>

          {/* Quick Actions (Hotline + Status/VN) */}
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Touchable
              onPress={handleCallHotline}
              activeOpacity={0.75}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                background: "#FFF7ED",
                border: "1px solid #FED7AA",
                padding: "5px 10px",
                borderRadius: 999,
              }}
            >
              <Glyph name="headset" size={14} color={COLORS.primary} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#EA580C" }}>1900 6828</span>
            </Touchable>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                padding: "5px 8px",
                borderRadius: 999,
              }}
            >
              <span style={{ fontSize: 11 }}>🇻🇳</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#334155" }}>VN</span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: isBackendOnline ? "#0E9F6E" : "#CBD5E1", // fail → dot xám (đề bài)
                  marginLeft: 2,
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {/* END: TopBrandBar */}

      {/* Main Content Stream */}
      <div className="edc-noscroll" style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "12px 16px 106px" }}>
          <div
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.5s, transform 0.5s",
            }}
          >
            {/* BEGIN: HeroPromoCarousel */}
            <div style={{ marginBottom: 16 }}>
              <div
                ref={carouselRef}
                onScroll={onCarouselScroll}
                className="edc-noscroll"
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "4px 0",
                  overflowX: "auto",
                  scrollSnapType: "x mandatory",
                  scrollBehavior: "smooth",
                  maxWidth: 398,
                  scrollbarWidth: "none",
                }}
              >
                {HERO_SLIDES.map((slide) => (
                  <div
                    key={slide.id}
                    style={{
                      flexShrink: 0,
                      width: cardW || "100%",
                      minHeight: 195,
                      borderRadius: 24,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      overflow: "hidden",
                      background: `linear-gradient(180deg, ${slide.bgMain}, ${slide.bgBottom})`,
                      boxShadow: `0px 8px 14px ${hexA(slide.bgMain, 0.28)}`,
                      scrollSnapAlign: "start",
                    }}
                  >
                    {/* Decorative corner icon watermark */}
                    <div style={{ position: "absolute", right: -4, bottom: -6, pointerEvents: "none" }}>
                      <Glyph name={slide.iconName} size={110} color="rgba(255,255,255,0.12)" />
                    </div>

                    {/* Top content */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", position: "relative" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          alignSelf: "flex-start",
                          background: "rgba(255, 255, 255, 0.22)",
                          padding: "4px 10px",
                          borderRadius: 999,
                          marginBottom: 10,
                        }}
                      >
                        <Glyph name={slide.badgeIcon} size={12} color={slide.badgeColor} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", letterSpacing: 0.2 }}>
                          {slide.badgeText}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: "#FFFFFF",
                          lineHeight: "26px",
                          marginBottom: 6,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {slide.headline}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255, 255, 255, 0.9)",
                          fontWeight: 500,
                          lineHeight: "17px",
                          maxWidth: 240,
                        }}
                      >
                        {slide.subtext}
                      </div>
                    </div>

                    {/* Bottom action bar */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderTop: "1px solid rgba(255, 255, 255, 0.2)",
                        paddingTop: 10,
                        marginTop: 10,
                        position: "relative",
                      }}
                    >
                      <div style={{ background: "#FBBF24", padding: "3px 8px", borderRadius: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#0F172A", letterSpacing: 0.5 }}>
                          {slide.promoBadge}
                        </span>
                      </div>
                      <Touchable onPress={openRoleModal} activeOpacity={0.85} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF" }}>{slide.btnText}</span>
                        <Icon name="arrow-forward" size={15} color="#FFFFFF" />
                      </Touchable>
                    </div>
                  </div>
                ))}
              </div>

              {/* Carousel Indicators */}
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10 }}>
                {HERO_SLIDES.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: activeSlide === i ? 22 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: activeSlide === i ? "#F26522" : "#CBD5E1",
                      transition: "width 0.2s, background 0.2s",
                    }}
                  />
                ))}
              </div>
            </div>
            {/* END: HeroPromoCarousel */}

            {/* BEGIN: QuickStatsBanner */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                padding: "12px 8px",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
                boxShadow: "0px 2px 6px rgba(15, 23, 42, 0.05)",
              }}
            >
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>50.000+</div>
                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 500, marginTop: 2 }}>Phụ huynh tin chọn</div>
              </div>
              <div style={{ width: 1, height: 24, background: "#F1F5F9" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>4.9</span>
                  <span style={{ color: "#F59E0B", fontSize: 13, fontWeight: 900, marginLeft: 2 }}>★</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 500, marginTop: 2 }}>Đánh giá hài lòng</div>
              </div>
              <div style={{ width: 1, height: 24, background: "#F1F5F9" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                  <Icon name="shield-checkmark" size={15} color="#0E9F6E" style={{ marginRight: 2 }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>100%</span>
                </div>
                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 500, marginTop: 2 }}>CCCD gắn chip</div>
              </div>
            </div>
            {/* END: QuickStatsBanner */}

            {/* BEGIN: ServiceEcosystemGrid */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  padding: "0 2px",
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", lineHeight: "20px" }}>Hệ Sinh Thái Dịch Vụ</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Tiêu chuẩn đồng hành toàn diện cho trẻ em</div>
                </div>
                <Touchable onPress={openRoleModal} activeOpacity={0.7} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EA580C" }}>4 Trụ cột</span>
                  <Icon name="chevron-forward" size={14} color={COLORS.primary} />
                </Touchable>
              </div>

              <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {SERVICE_ECOSYSTEM.map((svc) => (
                  <Touchable
                    key={svc.id}
                    onPress={openRoleModal}
                    activeOpacity={0.8}
                    style={{
                      width: "calc((100% - 10px) / 2)",
                      background: "#FFFFFF",
                      borderRadius: 16,
                      padding: 13,
                      border: `1px solid ${svc.isAi ? "#FED7AA" : "#E2E8F0"}`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      minHeight: 146,
                      boxShadow: "0px 2px 5px rgba(15, 23, 42, 0.04)",
                      ...(svc.isAi ? { background: "#FFFDF9" } : {}),
                      boxSizing: "border-box",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          border: `1px solid ${svc.iconBorder}`,
                          background: svc.iconBg,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Icon name={svc.icon} size={22} color={svc.iconColor} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{svc.title}</span>
                        {"badge" in svc && svc.badge ? (
                          <div style={{ background: "#FFEDD5", padding: "1px 5px", borderRadius: 4 }}>
                            <span style={{ fontSize: 8.5, fontWeight: 800, color: "#C2410C" }}>{svc.badge}</span>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748B", lineHeight: "14.5px" }}>{svc.desc}</div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 8,
                        borderTop: "1px solid #F1F5F9",
                        marginTop: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: svc.priceColor }}>{svc.price}</span>
                      <Icon name={svc.isAi ? "flash" : "add-circle"} size={18} color={svc.isAi ? COLORS.primary : "#94A3B8"} />
                    </div>
                  </Touchable>
                ))}
              </div>
            </div>
            {/* END: ServiceEcosystemGrid */}

            {/* BEGIN: SafetyCommitment */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 20,
                padding: 15,
                border: "1px solid #E2E8F0",
                marginBottom: 18,
                boxShadow: "0px 3px 6px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "#ECFDF5",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Icon name="shield-checkmark" size={18} color="#0E9F6E" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Cam Kết Xác Thực 3 Lớp Độc Quyền</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {SAFETY_PILLARS.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                      background: "#F8FAFC",
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #F1F5F9",
                    }}
                  >
                    <Icon name="checkmark-circle" size={18} color="#0E9F6E" style={{ marginTop: 1 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 10.5, color: "#64748B", lineHeight: "14.5px" }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* END: SafetyCommitment */}

            {/* BEGIN: ParentTestimonialCard */}
            <div
              style={{
                background: "#FFFDF9",
                borderRadius: 18,
                padding: 15,
                border: "1px solid #FDE68A",
                marginBottom: 18,
                boxShadow: "0px 2px 6px rgba(245, 158, 11, 0.08)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      background: "#FFEDD5",
                      border: "1px solid #FDBA74",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#EA580C" }}>TT</span>
                  </div>
                  <div>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Chị Thu Trang</span>
                      <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>● Đã xác thực</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#64748B", marginTop: 1 }}>Mẹ bé Hải Nam · TP. Huế (18 ca hoàn thành)</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "#F59E0B", letterSpacing: 1 }}>★★★★★</span>
              </div>
              <div style={{ fontSize: 11.5, fontStyle: "italic", color: "#334155", lineHeight: "17px" }}>
                “Bạn gia sư ĐH Khoa học Huế kèm con tôi môn Toán rất kiên nhẫn. Thích nhất là tính năng theo dõi GPS và giải ngân MoMo an toàn
                100%!”
              </div>
            </div>
            {/* END: ParentTestimonialCard */}

            {/* BEGIN: StudentPartnerBanner */}
            <div
              style={{
                background: "#0F172A",
                borderRadius: 18,
                padding: 15,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
                boxShadow: "0px 4px 8px rgba(15, 23, 42, 0.15)",
              }}
            >
              <div style={{ flex: 1, paddingRight: 10 }}>
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.2)",
                    border: "1px solid rgba(52, 211, 153, 0.4)",
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    padding: "2px 7px",
                    borderRadius: 999,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 8.5, fontWeight: 800, color: "#6EE7B7", letterSpacing: 0.4 }}>DÀNH CHO SINH VIÊN</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", marginBottom: 3 }}>Trở thành CarePartner</div>
                <div style={{ fontSize: 10.5, color: "#CBD5E1", lineHeight: "14.5px" }}>
                  Thu nhập 120k - 200k/h · Tự do chủ động thời gian theo lịch học.
                </div>
              </div>
              <Touchable
                onPress={() => handleSelectRole("worker")}
                activeOpacity={0.85}
                style={{
                  background: "#FFFFFF",
                  padding: "9px 13px",
                  borderRadius: 12,
                  boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Đăng ký ngay</span>
              </Touchable>
            </div>
            {/* END: StudentPartnerBanner */}

            {/* BEGIN: StickyBottomActionDock */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, alignItems: "center", marginBottom: 10 }}>
              <Touchable
                onPress={openRoleModal}
                activeOpacity={0.88}
                style={{
                  width: "100%",
                  background: "#F26522",
                  padding: "14px 0",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0px 6px 10px rgba(242, 101, 34, 0.35)",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF" }}>Bắt đầu kết nối ngay</span>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" />
              </Touchable>

              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>Đã có tài khoản?</span>
                <Touchable onPress={() => nav.navigate("Login")} hitSlop={8}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EA580C", textDecoration: "underline" }}>Đăng nhập tại đây</span>
                </Touchable>
              </div>

              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Glyph name="lock-closed" size={12} color="#0E9F6E" />
                <span style={{ fontSize: 10, color: "#94A3B8" }}>Bảo mật thông tin theo tiêu chuẩn an toàn dữ liệu số</span>
              </div>
            </div>
            {/* END: StickyBottomActionDock */}
          </div>
        </div>
      </div>

      {/* BEGIN: FixedBottomNavBar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(255, 255, 255, 0.96)",
          borderTop: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingTop: 8,
          paddingBottom: 10,
          boxShadow: "0px -4px 12px rgba(0, 0, 0, 0.05)",
          zIndex: 20,
        }}
      >
        {NAV_ITEMS.map((item) => {
          if (item.isFab) {
            return (
              <div key={item.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", marginTop: -20 }}>
                <Touchable
                  onPress={() => handleNavPress(item as NavItem)}
                  activeOpacity={0.85}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    background: "#F26522",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    border: "3px solid #FFFFFF",
                    boxShadow: "0px 4px 6px rgba(242, 101, 34, 0.35)",
                  }}
                >
                  <Icon name="hardware-chip" size={24} color="#FFFFFF" />
                </Touchable>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: "#EA580C", marginTop: 2 }}>AI</span>
              </div>
            );
          }
          return (
            <Touchable
              key={item.id}
              onPress={() => handleNavPress(item as NavItem)}
              activeOpacity={0.7}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name={item.active ? item.icon : item.iconOutline} size={22} color={item.active ? COLORS.primary : "#64748B"} />
              <span
                style={{
                  fontSize: 10,
                  color: item.active ? "#EA580C" : "#64748B",
                  fontWeight: item.active ? 700 : 500,
                  marginTop: 2,
                }}
              >
                {item.label}
              </span>
            </Touchable>
          );
        })}
      </div>
      {/* END: FixedBottomNavBar */}

      {/* BEGIN: RoleSelectionModal — absolute phủ màn + backdrop (GuestHome là 1 route, không dùng openModal) */}
      {roleModalVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            zIndex: 300,
          }}
          onClick={closeRoleModal}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: "20px 20px 32px",
              boxShadow: "0px -4px 12px rgba(0, 0, 0, 0.2)",
              transform: modalUp ? "translateY(0)" : "translateY(300px)",
              transition: modalUp ? "transform 0.35s cubic-bezier(0.34, 1.3, 0.44, 1)" : "transform 0.2s ease-in",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                borderBottom: "1px solid #F1F5F9",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#0F172A" }}>Chọn vai trò của bạn</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>EduCareLink tối ưu trải nghiệm theo nhu cầu riêng</div>
              </div>
              <Touchable
                onPress={closeRoleModal}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: "#F1F5F9",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Icon name="close" size={20} color="#64748B" />
              </Touchable>
            </div>

            {/* Role Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {/* Option 1: Phụ huynh */}
              <Touchable
                onPress={() => handleSelectRole("parent")}
                activeOpacity={0.8}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 14,
                  borderRadius: 18,
                  border: "1.5px solid #E2E8F0",
                  background: "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "#FFEDD5",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="people" size={26} color={COLORS.primary} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>Tôi là Phụ huynh</div>
                    <div style={{ fontSize: 11, color: "#64748B", lineHeight: "15px" }}>
                      Cần tìm Gia sư, Đón trẻ hoặc Đồng hành cùng trẻ tại nhà
                    </div>
                  </div>
                </div>
                <Icon name="chevron-forward" size={18} color="#94A3B8" />
              </Touchable>

              {/* Option 2: Sinh viên / CarePartner */}
              <Touchable
                onPress={() => handleSelectRole("worker")}
                activeOpacity={0.8}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 14,
                  borderRadius: 18,
                  border: "1.5px solid #E2E8F0",
                  background: "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "#D1FAE5",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="school" size={26} color="#047857" />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>Tôi là Sinh viên (CarePartner)</div>
                    <div style={{ fontSize: 11, color: "#64748B", lineHeight: "15px" }}>Nhận lịch dạy, đưa đón &amp; tăng thêm thu nhập</div>
                  </div>
                </div>
                <Icon name="chevron-forward" size={18} color="#94A3B8" />
              </Touchable>
            </div>

            {/* Disclaimer */}
            <div style={{ fontSize: 10.5, color: "#94A3B8", textAlign: "center", lineHeight: "15px", padding: "0 10px" }}>
              Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng &amp; Chính sách bảo mật của EduCareLink.
            </div>
          </div>
        </div>
      )}
      {/* END: RoleSelectionModal */}
    </div>
  );
};

export default GuestHomeScreen;
