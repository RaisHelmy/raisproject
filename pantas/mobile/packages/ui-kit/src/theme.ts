/**
 * Bootstrap 5's actual design tokens, ported to React Native primitives.
 * This is the single source of truth every component in this kit reads
 * from, so the three native apps and the Bootstrap web app read as one
 * product family — see CLAUDE.md "Mobile apps (Expo)".
 */
export const colors = {
  primary: "#0d6efd",
  primaryDark: "#0a58ca",
  secondary: "#6c757d",
  success: "#198754",
  danger: "#dc3545",
  warning: "#ffc107",
  info: "#0dcaf0",
  light: "#f8f9fa",
  dark: "#212529",
  white: "#ffffff",
  black: "#000000",
  bodyBg: "#ffffff",
  bodyColor: "#212529",
  border: "#dee2e6",
  muted: "#6c757d",
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 16,
  4: 24,
  5: 48,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  pill: 999,
} as const;

export const fontSize = {
  sm: 14,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export type ColorName = keyof typeof colors;
