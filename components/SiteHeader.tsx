"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  ["Home", "/"], ["Listen", "/listen"], ["Watch", "/watch"],
  ["Resources", "/resources"], ["Events", "/events"], ["Search", "/search"],
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return <header className="site-header">
    <div className="header-inner">
      <Link className="brand" href="/" aria-label="Teens2Inspire home" onClick={() => setOpen(false)}>
        <Image src="/teens2inspire-logo.webp" alt="" className="brand-logo" width={384} height={128} priority />
      </Link>
      <button className="menu-toggle" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>
        <span className="sr-only">{open ? "Close" : "Open"} navigation menu</span><span /><span />
      </button>
      <nav id="primary-navigation" className={`primary-nav${open ? " is-open" : ""}`} aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>)}
        <div className="mobile-account"><Link href="/signup" onClick={() => setOpen(false)}>Join us</Link><Link href="/login" onClick={() => setOpen(false)}>Sign in</Link></div>
      </nav>
      <div className="header-actions"><Link className="header-join" href="/signup">Join us <span aria-hidden="true">↗</span></Link><Link className="header-login" href="/login">Sign in</Link></div>
    </div>
  </header>;
}
