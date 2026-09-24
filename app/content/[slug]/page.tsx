import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contentLabel, getPublishedBySlug, getRelatedContent } from "@/lib/content";
import { FavoriteButton } from "@/components/FavoriteButton";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { MediaShelf } from "@/components/MediaShelf";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const item = await getPublishedBySlug(slug);
  if (!item) return { title: "Content not found" };
  return { title: item.title, description: item.description || `Explore ${item.title} on Teens2Inspire.`, alternates: { canonical: `/content/${item.slug}` }, openGraph: { title: `${item.title} | Teens2Inspire`, description: item.description || "Inspiring Jewish teen girls.", images: item.cover_url ? [item.cover_url] : [] } };
}
export default async function ContentPage({ params }: Props) {
  const { slug } = await params; const item = await getPublishedBySlug(slug); if (!item) notFound();
  const [related, supabase] = await Promise.all([getRelatedContent(item), createClient()]);
  let initiallySaved = false;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("favorites").select("content_id").eq("user_id", user.id).eq("content_id", item.id).maybeSingle();
      initiallySaved = Boolean(data);
    }
  }
  const date = item.published_at ? new Date(item.published_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : null;
  return <div className="detail-page page-shell"><RecentlyViewedTracker contentId={item.id}/><Link href={item.type === "podcast" ? "/listen" : item.type === "video" ? "/watch" : item.type === "event" ? "/events" : "/resources"} className="back-link">← Back to {item.type === "podcast" ? "Listen" : item.type === "video" ? "Watch" : item.type === "event" ? "Events" : "Explore"}</Link><section className="detail-layout"><div className="detail-art">{item.cover_url ? <img src={item.cover_url} alt={`Cover art for ${item.title}`}/> : <span>✳</span>}</div><div className="detail-copy"><span className="eyebrow">{item.category || contentLabel(item.type)}</span><h1>{item.title}</h1>{item.description && <p className="detail-description">{item.description}</p>}{item.type === "podcast" && item.media_url && <audio className="audio-player" controls preload="metadata" src={item.media_url}>Your browser does not support audio playback.</audio>}{(item.type === "video" || item.type === "original") && item.media_url && <video className="video-player" controls playsInline preload="metadata" poster={item.cover_url || undefined} src={item.media_url}>Your browser does not support video playback.</video>}{item.type === "event" && <div className="event-meta">{item.starts_at && <span>{new Date(item.starts_at).toLocaleString("en-US",{dateStyle:"long",timeStyle:"short"})}{item.ends_at?` – ${new Date(item.ends_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`:""}</span>}{item.location && <span>{item.location}</span>}{item.address&&<span>{item.address}</span>}{item.organizer&&<span>Hosted by {item.organizer}</span>}{item.capacity&&<span>{item.capacity} spots</span>}{item.ticket_info&&<p>{item.ticket_info}</p>}</div>}{item.type === "resource" || item.type === "printable" ? (item.media_url || item.external_url) && <a className="button button-primary" href={item.media_url || item.external_url || "#"} target="_blank" rel="noreferrer">Open this {item.type} <span>↗</span></a> : item.type === "event" && item.external_url ? <a className="button button-primary" href={item.external_url} target="_blank" rel="noreferrer">Registration details <span>↗</span></a> : null}<div className="detail-meta">{date && <span>Published {date}</span>}{item.tags?.length ? <div className="detail-tags">{item.tags.map((tag)=><span key={tag}>{tag}</span>)}</div> : null}</div><FavoriteButton contentId={item.id} initialSaved={initiallySaved}/></div></section><div className="detail-share"><span>Pass it along to someone who’d love it.</span><a href={`mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(`Thought you might like this: ${process.env.NEXT_PUBLIC_SITE_URL || ""}/content/${item.slug}`)}`}>Share this <span>↗</span></a></div>{related.length>0 && <MediaShelf title="You might also like" items={related}/>}</div>;
}
