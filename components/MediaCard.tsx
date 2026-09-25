import Link from "next/link";
import { ContentRecord, contentHref, contentLabel } from "@/lib/content";
import { ExpandableDescription } from "@/components/ExpandableDescription";

export function MediaCard({ item, compact = false, canWatchVideos = false }: { item: ContentRecord; compact?: boolean; canWatchVideos?: boolean }) {
  const isLocked = (item.type === "video" || item.type === "original") && !canWatchVideos;
  return <article className={`media-card media-card-${item.type}${compact ? " media-card-compact" : ""}`}>
    <Link href={contentHref(item)} className="media-art" aria-label={`Open ${item.title}`}>
      {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" /> : <span className="art-placeholder"><i>{item.type === "podcast" ? "✳" : item.type === "video" ? "▶" : "✦"}</i></span>}
      <span className="art-type">{contentLabel(item.type)}</span>
      {isLocked && <span className="media-lock" role="img" aria-label="Membership required"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V4.5a3.5 3.5 0 0 1 7 0V6h.75A1.75 1.75 0 0 1 14 7.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5A1.75 1.75 0 0 1 3.75 6zm1.5 0h4V4.5a2 2 0 0 0-4 0zM8 8.5a1.25 1.25 0 0 0-.75 2.25v1.5h1.5v-1.5A1.25 1.25 0 0 0 8 8.5" fill="currentColor"/></svg></span>}
      <span className="art-open" aria-hidden="true">↗</span>
    </Link>
    <div className="media-copy"><span className="eyebrow muted">{item.category || contentLabel(item.type)}</span><h3><Link href={contentHref(item)}>{item.title}</Link></h3>{item.description && (item.type === "video" || item.type === "original" ? <ExpandableDescription text={item.description} label={item.title} /> : <p>{item.description}</p>)}</div>
  </article>;
}
