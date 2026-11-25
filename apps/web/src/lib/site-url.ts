const DEFAULT_PRODUCTION_SITE_URL = 'https://coffee-tracker.vercel.app';

/**
 * Resolves the canonical public site URL from NEXT_PUBLIC_SITE_URL.
 * Falls back to a non-localhost placeholder until configured in .env.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) {
    return DEFAULT_PRODUCTION_SITE_URL;
  }
  return configured.replace(/\/+$/, '');
}
