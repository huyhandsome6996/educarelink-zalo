/**
 * OnboardingScreen — port 2 file RN vào 1 file:
 *   mobile/src/screens/Onboarding/ParentOnboardingScreen.js (330 dòng)
 *   mobile/src/screens/Onboarding/WorkerOnboardingScreen.js (315 dòng)
 * user.role !== 'worker' → ParentOnboarding (4 slide "Đăng việc dễ dàng"...), else WorkerOnboarding ("Tìm việc linh hoạt"...).
 * Layout 2 phần: top illustration (surface, radius dưới 28, 2 decor circles, icon 64 trong circle 200/100 viền 4)
 * + bottom content (surfaceWarm, title TYPO.h1 + desc, pill dots 8×2/32×2, nút 'Tiếp theo' pill radius 999 + 'Bỏ qua').
 * Nút cuối ('Bắt đầu ngay' / 'Bắt đầu kiếm việc') → completeOnboardingInContext() → RootNavigator tự chuyển nhánh.
 * Platform: horizontal paging ScrollView → scroll-snap div; glyph thiếu (search-outline, checkmark-done-outline)
 * nhúng cục bộ đúng SVG Ionicons 7.4.0 (không sửa file ionicons.ts chung).
 */
import React, { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Touchable, StatusBarSpacer } from "@/components/ui";
import { COLORS, SHADOWS, typo } from "@/theme";
import { useAuth } from "@/context/AuthContext";

/* Glyph Ionicons 7.4.0 thiếu trong src/components/icons/ionicons.ts — nhúng cục bộ đúng path */
const LOCAL_ICONS: Record<string, string> = {
  "search-outline":
    '<path d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M338.29 338.29L448 448"/>',
  "checkmark-done-outline":
    '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M464 128L240 384l-96-96M144 384l-96-96M368 128L232 284"/>',
};

const SlideIcon: React.FC<{ name: string; size: number; color: string }> = ({ name, size, color }) => {
  const local = LOCAL_ICONS[name];
  if (local) {
    return (
      <svg viewBox="0 0 512 512" width={size} height={size} style={{ color, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: local }} />
    );
  }
  return <Icon name={name} size={size} color={color} />;
};

interface OnbSlide {
  iconName: string;
  title: string;
  desc: string;
  color: string;
}

/* 4 slides Parent — giữ nguyên content, chỉ đổi icon sang Warm style (NGUYÊN VĂN từ file RN) */
const PARENT_SLIDES: OnbSlide[] = [
  {
    iconName: "create-outline",
    title: "Đăng việc dễ dàng",
    desc: "Chỉ cần vài bước — miêu tả nhu cầu, chọn danh mục, đặt giá. EduCareLink sẽ tìm Carepartner phù hợp cho bạn.",
    color: COLORS.primary,
  },
  {
    iconName: "people-outline",
    title: "Duyệt ứng viên",
    desc: "Xem hồ sơ chi tiết, đánh giá từ phụ huynh khác, tóm tắt AI. Chọn người phù hợp nhất cho bé nhà bạn.",
    color: COLORS.secondary,
  },
  {
    iconName: "star-outline",
    title: "Đánh giá sau việc",
    desc: "Sau khi hoàn thành, hãy để lại nhận xét để giúp cộng đồng phụ huynh chọn được Carepartner tốt.",
    color: COLORS.warning,
  },
  {
    iconName: "shield-checkmark-outline",
    title: "Thanh toán an toàn",
    desc: "Hệ thống giữ tiền giúp bạn — chỉ chuyển cho Carepartner khi công việc đã hoàn thành. Hoa hồng 20% tự động trừ.",
    color: COLORS.info,
  },
];

/* 4 slides Worker — NGUYÊN VĂN từ file RN */
const WORKER_SLIDES: OnbSlide[] = [
  {
    iconName: "search-outline",
    title: "Tìm việc linh hoạt",
    desc: "Xem hàng trăm việc làm phù hợp với lịch học của bạn. Lọc theo danh mục, địa điểm, mức lương.",
    color: COLORS.primary,
  },
  {
    iconName: "flash-outline",
    title: "Ứng tuyển 1 chạm",
    desc: 'Thấy việc hợp → bấm "Ứng tuyển". Phụ huynh sẽ duyệt hồ sơ của bạn trong vài giờ.',
    color: COLORS.secondary,
  },
  {
    iconName: "checkmark-done-outline",
    title: "Hoàn thành & đánh giá",
    desc: "Làm việc xong — phụ huynh xác nhận hoàn thành. Nhận đánh giá 5 sao để tăng cơ hội được chọn.",
    color: COLORS.warning,
  },
  {
    iconName: "wallet-outline",
    title: "Nhận tiền MoMo",
    desc: "80% tiền tự động chuyển vào ví MoMo của bạn khi hoàn thành. 20% hoa hồng nền tảng.",
    color: COLORS.info,
  },
];

/** Flow dùng chung — cùng pattern kiểu dáng cho cả 2 bản RN (chỉ khác slides + nhãn nút cuối) */
const OnboardingFlow: React.FC<{ slides: OnbSlide[]; finishLabel: string }> = ({ slides, finishLabel }) => {
  const { completeOnboardingInContext } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const [entered, setEntered] = useState(false); // RN fadeAnim/slideAnim 600ms

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /** RN: handleScroll — idx = round(contentOffset.x / width) */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  };

  const finish = async () => {
    try {
      await completeOnboardingInContext(); // đã tự gọi API + set first_login=false; RootNavigator lo chuyển nhánh
    } catch (e) {
      console.warn("Onboarding complete failed:", e);
    }
  };

  const handleNext = () => {
    if (activeIndex < slides.length - 1) {
      const w = scrollRef.current?.clientWidth ?? 0;
      scrollRef.current?.scrollTo({ left: (activeIndex + 1) * w, behavior: "smooth" });
    } else {
      finish();
    }
  };

  const isLast = activeIndex === slides.length - 1;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.surfaceWarm, // #fff8f6 — nền ấm
        overflow: "hidden",
      }}
    >
      <style>{".edc-noscroll{scrollbar-width:none}.edc-noscroll::-webkit-scrollbar{display:none}"}</style>

      {/* Top half — illustration area */}
      <div
        style={{
          flex: 1,
          background: COLORS.surface, // surface-container-lowest
          borderBottomLeftRadius: 28, // xl radius — bo góc dưới
          borderBottomRightRadius: 28,
          overflow: "hidden",
          boxShadow: SHADOWS.small,
          position: "relative",
          flexShrink: 1,
        }}
      >
        {/* Decorative circles (RN không có blur sẵn → opacity thấp) */}
        <div
          style={{
            position: "absolute",
            top: -64,
            right: -64,
            width: 256,
            height: 256,
            borderRadius: 128,
            background: COLORS.primaryLight, // primary-fixed
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: -64,
            width: 192,
            height: 192,
            borderRadius: 96,
            background: COLORS.secondaryLight, // secondary-fixed
            opacity: 0.4,
          }}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="edc-noscroll"
          style={{
            height: "100%",
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            position: "relative",
          }}
        >
          {slides.map((slide, idx) => (
            <div
              key={idx}
              style={{
                flex: "0 0 100%",
                scrollSnapAlign: "start",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: entered ? 1 : 0,
                  transform: `scale(${entered ? 1 : 0}) translateY(${entered ? 0 : 20}px)`,
                  transition: "opacity 0.6s, transform 0.6s",
                }}
              >
                <div
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: 100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `4px solid ${COLORS.surface}`,
                    background: `${slide.color}15`,
                    boxShadow: SHADOWS.large,
                    boxSizing: "border-box",
                  }}
                >
                  <SlideIcon name={slide.iconName} size={64} color={slide.color} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom half — content area */}
      <div
        style={{
          background: COLORS.surfaceWarm,
          padding: "0 20px 48px", // margin-mobile / pb-xxl
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <StatusBarSpacer />
        <div style={{ paddingTop: 32, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Active slide title + description */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 32, // mb-xl
              opacity: entered ? 1 : 0,
              transform: `translateY(${entered ? 0 : 20}px)`,
              transition: "opacity 0.6s, transform 0.6s",
            }}
          >
            <div style={typo("h1", { color: COLORS.onSurface, textAlign: "center", marginBottom: 16 })}>
              {slides[Math.min(activeIndex, slides.length - 1)].title}
            </div>
            <div
              style={typo("body", {
                color: COLORS.onSurfaceVariant,
                textAlign: "center",
                maxWidth: 360, // max-w-sm
                lineHeight: "24px",
              })}
            >
              {slides[Math.min(activeIndex, slides.length - 1)].desc}
            </div>
          </div>

          {/* Progress dots — pill style (8×2 active, 8×2 inactive) */}
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 32 }}>
            {slides.map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: activeIndex === idx ? 32 : 8, // wider pill (w-8)
                  height: 8,
                  borderRadius: 4,
                  background: activeIndex === idx ? COLORS.primary : COLORS.outlineVariant, // primary-container / surface-variant
                  transition: "width 0.25s, background 0.25s",
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
            <Touchable
              onPress={handleNext}
              activeOpacity={0.85}
              style={{
                background: COLORS.primary, // primary-container
                borderRadius: 999, // rounded-full
                height: 48,
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                boxShadow: SHADOWS.large,
              }}
            >
              <span style={typo("h4", { color: COLORS.textOnPrimary })}>{isLast ? finishLabel : "Tiếp theo"}</span>
              <Icon name={isLast ? "checkmark-circle" : "arrow-forward"} size={20} color="#fff" />
            </Touchable>
            <Touchable
              onPress={finish}
              activeOpacity={0.7}
              style={{ height: 48, display: "flex", justifyContent: "center", alignItems: "center" }}
            >
              <span style={typo("h4", { color: COLORS.primary })}>Bỏ qua</span>
            </Touchable>
          </div>
        </div>
      </div>
    </div>
  );
};

const OnboardingScreen: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === "worker") {
    return <OnboardingFlow slides={WORKER_SLIDES} finishLabel="Bắt đầu kiếm việc" />;
  }
  return <OnboardingFlow slides={PARENT_SLIDES} finishLabel="Bắt đầu ngay" />;
};

export default OnboardingScreen;
