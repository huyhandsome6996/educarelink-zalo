module.exports = {
  darkMode: ["selector", '[zaui-theme="dark"]'],
  content: ["./src/**/*.{js,jsx,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
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
        },
      },
      fontFamily: {
        mono: ["Roboto Mono", "monospace"],
      },
    },
  },
};

