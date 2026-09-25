import Link from "next/link";
import Image from "next/image";
import { InstallAppButton } from "@/components/InstallAppButton";

export function Footer() {
  return <footer className="site-footer">
    <div className="footer-top">
      <div><Link href="/" className="footer-brand" aria-label="Teens2Inspire home"><Image src="/teens2inspire-logo.webp" alt="" className="brand-logo" width={384} height={128} /></Link><p>Inspiring Jewish teen girls.</p><InstallAppButton /></div>
      <nav className="footer-links" aria-label="Footer navigation">
        <div><strong>Explore</strong><Link href="/listen">Listen</Link><Link href="/watch">Watch</Link><Link href="/resources">Resources</Link><Link href="/events">Events</Link></div>
        <div><strong>Connect</strong><Link href="/search">Search</Link><Link href="/signup">Join the community</Link><Link href="/contact">Contact</Link></div>
      </nav>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Teens2Inspire</span><span>Made for the girls becoming who they are.</span><div><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Terms</Link></div></div>
  </footer>;
}
