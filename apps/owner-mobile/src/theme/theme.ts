/**
 * Same Shri Anandam brand palette as apps/customer-mobile/src/theme/theme.ts
 * (one brand, two apps) plus a few status colors this app needs for order
 * status badges that the customer app doesn't.
 */
export const colors = {
  background: "#FFF8F0",
  surface: "#FFFFFF",
  primary: "#B3541E",
  primaryDark: "#8A3F15",
  onPrimary: "#FFFFFF",
  accent: "#D4A017",
  text: "#2B2320",
  textMuted: "#7A6F68",
  border: "#EFE3D6",
  success: "#3D8B4C",
  danger: "#C0392B",
  warning: "#B7791F",
  disabled: "#D9CFC5",
  info: "#2E6FA3",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 22, fontWeight: "700" as const },
  h3: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontWeight: "600" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  price: { fontSize: 17, fontWeight: "700" as const },
};

/** Order status -> badge color, used by StatusBadge and order cards. */
export const STATUS_COLORS: Record<string, string> = {
  PENDING: colors.warning,
  ACCEPTED: colors.info,
  PREPARING: colors.info,
  READY: colors.success,
  OUT_FOR_DELIVERY: colors.success,
  DELIVERED: colors.textMuted,
  REJECTED: colors.danger,
  CANCELLED: colors.danger,
};
