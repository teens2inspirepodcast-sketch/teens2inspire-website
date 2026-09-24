export function getSiteOrigin(fallback?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return toOrigin(configured);
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return toOrigin(vercelHost.includes("://") ? vercelHost : `https://${vercelHost}`);

  if (process.env.NODE_ENV !== "production" && fallback) {
    return toOrigin(fallback);
  }
  return null;
}

function toOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin !== "null") return parsed.origin;
  } catch {
    return null;
  }
  return null;
}
