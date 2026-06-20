/** Official ReSocial brand palette */
export const BRAND_COLORS = {
  electricBlue: "#0EA5FF",
  brandBlue: "#2563FF",
  indigo: "#6366F1",
  purple: "#8B5CF6",
  vibrantPurple: "#A855F7",
} as const;

export const BRAND_GRADIENT = {
  /** Logo “Re” wordmark, hero accents */
  wordmark: `linear-gradient(135deg, ${BRAND_COLORS.electricBlue} 0%, ${BRAND_COLORS.vibrantPurple} 100%)`,
  /** Primary CTA / marketing backgrounds */
  background: `linear-gradient(to bottom right, ${BRAND_COLORS.brandBlue}, ${BRAND_COLORS.indigo}, ${BRAND_COLORS.purple})`,
} as const;
