import Link from "next/link";
import { ContentRecord } from "@/lib/content";
import { MediaCard } from "@/components/MediaCard";

export function MediaShelf({ title, items, href, empty = "New Teens2Inspire content is coming soon.", id }: { title: string; items: ContentRecord[]; href?: string; empty?: string; id?: string }) {
  return <section className="shelf-section" id={id}>
    <div className="section-heading"><div><span className="eyebrow">A little something for you</span><h2>{title}</h2></div>{href && <Link className="text-link" href={href}>View all <span aria-hidden="true">↗</span></Link>}</div>
    {items.length ? <div className="media-shelf">{items.map((item) => <MediaCard key={item.id} item={item} />)}</div> : <div className="empty-note"><span className="empty-sparkle">✳</span><div><strong>Nothing here just yet.</strong><p>{empty}</p></div></div>}
  </section>;
}
