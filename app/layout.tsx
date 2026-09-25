import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import "./globals.css";
import "./overrides.css";
import type { Viewport } from "next";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || "https://teens2inspire-website-ra8kiujs6.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: { default: "Teens2Inspire | Inspiring Jewish teen girls.", template: "%s | Teens2Inspire" },
  description: "A space to listen, watch, explore, connect and grow together. Made especially for Jewish teen girls.",
  openGraph: { siteName: "Teens2Inspire", type: "website", title: "Teens2Inspire", description: "Inspiring Jewish teen girls." },
  twitter: { card: "summary_large_image", title: "Teens2Inspire", description: "Inspiring Jewish teen girls." },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Teens2Inspire" },
};

export const viewport: Viewport = { themeColor: "#111012", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader /><main id="main-content">{children}</main><Footer /></body></html>;
}
