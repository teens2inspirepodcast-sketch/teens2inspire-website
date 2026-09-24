import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import "./globals.css";
import "./overrides.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://teens2inspire-website.vercel.app"),
  title: { default: "Teens2Inspire | Inspiring Jewish teen girls.", template: "%s | Teens2Inspire" },
  description: "A space to listen, watch, explore, connect and grow together. Made especially for Jewish teen girls.",
  openGraph: { siteName: "Teens2Inspire", type: "website", title: "Teens2Inspire", description: "Inspiring Jewish teen girls." },
  twitter: { card: "summary_large_image", title: "Teens2Inspire", description: "Inspiring Jewish teen girls." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader /><main id="main-content">{children}</main><Footer /></body></html>;
}
