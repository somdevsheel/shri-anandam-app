/**
 * Shri Anandam brand palette, spacing scale and type system — taken from
 * the customer-app UI design pass (shri-anandam-customer-app.html). These
 * are the values every screen imports so a future design refresh is a
 * one-file change, not a find-replace across the app.
 */
export const colors = {
  background: "#FFF8F0",
  surface: "#FFFFFF",
  primary: "#B3541E", // warm terracotta — sweets-shop brand tone
  primaryDark: "#8A3F15",
  onPrimary: "#FFFFFF",
  maroon: "#6E2318", // deep header/hero tone, paired with the gold accent below
  accent: "#D4A017", // festive gold accent
  accentOnMaroon: "#E8C77A", // gold text/icons sitting on the maroon header
  text: "#2B2320",
  textMuted: "#7A6F68",
  border: "#EFE3D6",
  success: "#3D8B4C",
  nonVeg: "#8B3A3A", // the brown/maroon square of the standard Indian veg/non-veg mark — green (success) is veg
  danger: "#C0392B",
  warning: "#B7791F",
  warningBackground: "#FBF0DD",
  disabled: "#D9CFC5",
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

/**
 * Font families loaded via @expo-google-fonts in app/_layout.tsx.
 * `display` (Marcellus, a serif) is for screen titles and product names;
 * `sans` (Manrope) is the body/UI workhorse and covers Devanagari, so a
 * Hindi interface needs no second family.
 */
export const fonts = {
  display: "Marcellus_400Regular",
  sansRegular: "Manrope_400Regular",
  sansMedium: "Manrope_500Medium",
  sansSemiBold: "Manrope_600SemiBold",
  sansBold: "Manrope_700Bold",
} as const;

export const typography = {
  display: { fontSize: 26, fontFamily: fonts.display, fontWeight: "400" as const },
  h1: { fontSize: 28, fontFamily: fonts.sansBold, fontWeight: "700" as const },
  h2: { fontSize: 22, fontFamily: fonts.sansBold, fontWeight: "700" as const },
  h3: { fontSize: 18, fontFamily: fonts.sansSemiBold, fontWeight: "600" as const },
  body: { fontSize: 15, fontFamily: fonts.sansRegular, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontFamily: fonts.sansSemiBold, fontWeight: "600" as const },
  caption: { fontSize: 13, fontFamily: fonts.sansRegular, fontWeight: "400" as const },
  price: { fontSize: 17, fontFamily: fonts.sansBold, fontWeight: "700" as const },
};
