import Link from "next/link";
import { ContentRecord, contentHref, contentLabel } from "@/lib/content";

export function MediaCard({ item, compact = false }: { item: ContentRecord; compact?: boolean }) {
  return <article className={`media-card${compact ? " media-card-compact" : ""}`}>
    <Link href={contentHref(item)} className="media-art" aria-label={`Open ${item.title}`}>
      {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" /> : <span className="art-placeholder"><i>{item.type === "podcast" ? "✳" : item.type === "video" ? "▶" : "✦"}</i></span>}
      <span className="art-type">{contentLabel(item.type)}</span>
      <span className="art-open" aria-hidden="true">↗</span>
    </Link>
    <div className="media-copy"><span className="eyebrow muted">{item.category || contentLabel(item.type)}</span><h3><Link href={contentHref(item)}>{item.title}</Link></h3>{item.description && <p>{item.description}</p>}</div>
  </article>;
}
