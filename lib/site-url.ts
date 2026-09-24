export function getSiteOrigin(fallback?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin !== "null") return parsed.origin;
    } catch {
      return null;
    }
    return null;
  }
  if (process.env.NODE_ENV === "production") return null;
  if (fallback) {
    try {
      const parsed = new URL(fallback);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.origin;
    } catch {
      return null;
    }
  }
  return null;
}
