module.exports = {
  darkMode: ["selector", '[zaui-theme="dark"]'],
  content: ["./src/**/*.{js,jsx,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // EduCareLink Brand Tokens (chuẩn mobile-prototype gốc)
        primary: {
          DEFAULT: "#F26522",
          dark: "#D4541E",
          light: "#FFF4ED",
          soft: "#FFCFB3",
        },
        brand: {
          blue: "#0051D5",
          teal: "#0D9488",
          navy: "#1A1A2E",
          green: "#10B981",
          secondary: "#2DB84B",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          alt: "#FFF9F5",
        },
        status: {
          warning: "#F59E0B",
          warningbg: "#FFFBEB",
          error: "#EF4444",
          errorbg: "#FEF2F2",
          info: "#3B82F6",
          infobg: "#EFF6FF",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Manrope'", "'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'Roboto Mono'", "monospace"],
      },
      animation: {
        "spin-slow": "spin 2.5s linear infinite",
        "fade-in": "fadeIn 0.35s ease-out both",
        "fade-in-up": "fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "shimmer": "shimmer 1.8s linear infinite",
        "radar-sweep": "radarSweep 3s linear infinite",
        "pulse-ring": "pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        radarSweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.85)", opacity: "1" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
};
