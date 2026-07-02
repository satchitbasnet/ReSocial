/** Normalize app URL (no trailing slash). */
function normalizeAppUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Public app URL used for OAuth redirect URIs, Stripe return URLs, and emails.
 * Prefer NEXT_PUBLIC_APP_URL (documented in README / render.yaml), then NEXT_PUBLIC_URL.
 */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_URL?.trim() ||
    "http://localhost:3000";

  return normalizeAppUrl(raw);
}

/** OAuth callback URL for a provider slug (e.g. `tiktok`, `google-drive`). */
export function getOAuthCallbackUrl(provider: string): string {
  return `${getAppUrl()}/api/auth/callback/${provider}`;
}
