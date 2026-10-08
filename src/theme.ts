/**
 * Design tokens — chuyển đổi 1:1 từ mobile/src/theme/colors.js (React Native).
 * Mọi screen/port phải dùng token từ đây; screen RN có inline style thì giữ
 * đúng giá trị thực tế của screen đó (không áp token chung làm lệch màn khác).
 */

export const COLORS = {
  primary: '#F26522',
  primaryDark: '#D4541E',
  primaryLight: '#FFF4ED',
  primarySoft: '#FFCFB3',
  primaryDeep: '#a63b00',
  onPrimaryContainer: '#4f1800',
  primaryFixedDim: '#ffb599',

  secondary: '#2DB84B',
  secondaryDark: '#1E9439',
  secondaryLight: '#EAFBEF',
  secondaryContainer: '#76fa84',
  onSecondaryContainer: '#007326',

  background: '#F7F7F7',
  surface: '#FFFFFF',
  surfaceAlt: '#FFF9F5',
  surfaceWarm: '#fff8f6',
  surfaceContainerLow: '#fff1ec',
  surfaceContainer: '#ffe9e2',
  surfaceContainerHigh: '#fde3da',
  surfaceDim: '#eed5cc',

  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#6B7280',
  textOnPrimary: '#FFFFFF',
  onSurface: '#261813',
  onSurfaceVariant: '#594138',

  success: '#10B981',
  successBg: '#ECFDF5',
  successDeep: '#1E9439',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  errorDeep: '#ba1a1a',
  errorContainer: '#ffdad6',

  amber: '#F59E0B',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  sky: '#0284C7',
  skyBg: '#E0F2FE',
  skyBorder: '#BAE6FD',
  canvas: '#F8FAFC',
  ink: '#0F172A',
  inkSecondary: '#475569',
  inkMuted: '#94A3B8',

  tierGold: '#a67c00',
  tierGoldBg: '#fff4d6',
  tierSilver: '#7d6a5d',
  tierSilverBg: '#f0e6df',
  ratingStar: '#f59e0b',

  border: '#F0F0F0',
  divider: '#E5E7EB',
  borderHover: '#D1D5DB',
  outline: '#8d7166',
  outlineVariant: '#e1bfb3',

  shadow: '#000000',
} as const;

export const SIZES = {
  radiusXs: 6,
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXl: 28,
  radiusFull: 999,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Manrope cho tiêu đề, Plus Jakarta Sans cho body — giống App.js Font.loadAsync */
export const FONT_HEAD = "'Manrope', system-ui, -apple-system, sans-serif";
export const FONT_BODY = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

export interface Typo {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
}

/** TYPO nguyên văn từ colors.js (RN fontSize/lineHeight = dp == px logical) */
export const TYPO = {
  h1: { fontFamily: FONT_HEAD, fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 34 },
  h2: { fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 800, letterSpacing: -0.3, lineHeight: 28 },
  h3: { fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 800, letterSpacing: -0.2, lineHeight: 24 },
  h4: { fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, letterSpacing: 0, lineHeight: 22 },
  h5: { fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, letterSpacing: 0.1, lineHeight: 20 },

  body: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: 500, letterSpacing: 0.1, lineHeight: 22 },
  bodyLarge: { fontFamily: FONT_BODY, fontSize: 17, fontWeight: 600, letterSpacing: 0, lineHeight: 24 },
  bodySmall: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, letterSpacing: 0.1, lineHeight: 18 },

  caption: { fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, lineHeight: 16 },
  overline: { fontFamily: FONT_BODY, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, lineHeight: 14 },
  button: { fontFamily: FONT_BODY, fontSize: 16, fontWeight: 700, letterSpacing: 0.2, lineHeight: 20 },
  buttonSmall: { fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, letterSpacing: 0.3, lineHeight: 18 },
} satisfies Record<string, Typo>;

export type TypoKey = keyof typeof TYPO;

/** SHADOWS — chuyển boxShadow của RN (boxShadow string) sang CSS box-shadow */
export const SHADOWS = {
  small: '0px 2px 8px rgba(0, 0, 0, 0.05)',
  medium: '0px 4px 14px rgba(0, 0, 0, 0.07)',
  large: '0px 6px 20px rgba(242, 101, 34, 0.2)',
  cardHover: '0px 4px 16px rgba(242, 101, 34, 0.12)',
  inputFocus: '0px 2px 8px rgba(242, 101, 34, 0.1)',
} as const;

export const ANIM = {
  timingFast: 150,
  timingNormal: 250,
  timingSlow: 400,
} as const;

/** Ghi đè style typo lên 1 style object */
export function typo(key: TypoKey, overrides?: React.CSSProperties): React.CSSProperties {
  const t = TYPO[key];
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight as React.CSSProperties['fontWeight'],
    letterSpacing: t.letterSpacing,
    lineHeight: `${t.lineHeight}px`,
    ...overrides,
  };
}

/** Tab bar của AppNavigator (styles.tabBar — dòng 498–562) */
export const TAB_BAR_HEIGHT = 84; // Android (iOS 88 — Zalo chạy Android/Android-like webview)
export const TAB_BAR = {
  height: TAB_BAR_HEIGHT,
  backgroundColor: COLORS.surface,
  borderTop: 'none',
  paddingBottom: 24,
  paddingTop: 6,
  boxShadow: '0px -2px 12px rgba(242, 101, 34, 0.06)',
} as const;

export const TAB_BAR_LABEL: React.CSSProperties = {
  ...TYPO.caption,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: -0.2,
  marginTop: 2,
  textAlign: 'center',
};

/** FAB AI nổi giữa (raisedFab) */
export const RAISED_FAB = {
  width: 52,
  height: 52,
  borderRadius: 26,
  backgroundColor: COLORS.primary,
  boxShadow: `${SHADOWS.medium}, 0 6px 12px rgba(0,0,0,0.08)`,
} as const;

export const RAISED_FAB_FOCUSED = {
  backgroundColor: '#D45A1C',
  boxShadow: SHADOWS.large,
} as const;

/** TabIcon: khối nền 40×28 radius 10 + thanh chỉ báo 16×3 */
export const TAB_ICON_BG: React.CSSProperties = {
  width: 40,
  height: 28,
  borderRadius: SIZES.radiusSm,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

export const TAB_ACTIVE_INDICATOR: React.CSSProperties = {
  width: 16,
  height: 3,
  borderRadius: 1.5,
  marginTop: 2,
};

/** Chuyển px RN (dp) -> css px: tại DPR chuẩn 1dp = 1px logical */
export const px = (n: number) => `${n}px`;
