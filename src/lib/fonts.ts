/**
 * ReSocial typography
 *
 * - Logo wordmark & marketing headlines → Satoshi (Bold / Medium) via `font-display`
 * - Product UI (dashboard, forms) → Inter via `font-sans`
 *
 * Satoshi is loaded from Fontshare in globals.css.
 * Inter is loaded via next/font in app/layout.tsx (`--font-inter`).
 */

export const FONT_ROLES = {
  display: "font-display",
  ui: "font-sans",
} as const;
