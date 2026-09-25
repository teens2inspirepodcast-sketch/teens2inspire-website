import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contentLabel, getPublishedBySlug, getRelatedContent } from "@/lib/content";
import { FavoriteButton } from "@/components/FavoriteButton";
import { RecentlyViewedTracker } from "@/components/RecentlyViewedTracker";
import { MediaShelf } from "@/components/MediaShelf";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { getViewerAccess } from "@/lib/membership-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublishedBySlug(slug);
  if (!item) return { title: "Content not found" };
  const description = item.description || `Explore ${item.title} on Teens2Inspire.`;
  return {
    title: item.title,
    description,
    alternates: { canonical: `/content/${item.slug}` },
    openGraph: { title: `${item.title} | Teens2Inspire`, description, images: item.cover_url ? [item.cover_url] : [] },
    twitter: { card: "summary_large_image", title: `${item.title} | Teens2Inspire`, description, images: item.cover_url ? [item.cover_url] : [] },
  };
}

function LockIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V4.5a3.5 3.5 0 0 1 7 0V6h.75A1.75 1.75 0 0 1 14 7.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5A1.75 1.75 0 0 1 3.75 6zm1.5 0h4V4.5a2 2 0 0 0-4 0zM8 8.5a1.25 1.25 0 0 0-.75 2.25v1.5h1.5v-1.5A1.25 1.25 0 0 0 8 8.5" fill="currentColor"/></svg>;
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const item = await getPublishedBySlug(slug);
  if (!item) notFound();

  const isVideo = item.type === "video" || item.type === "original";
  const [related, supabase] = await Promise.all([getRelatedContent(item), createClient()]);
  const access = await getViewerAccess(supabase);
  let initiallySaved = false;
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("favorites").select("content_id").eq("user_id", user.id).eq("content_id", item.id).maybeSingle();
      initiallySaved = Boolean(data);
    }
  }

  let videoAvailable = false;
  if (isVideo && access.canWatchVideos) {
    const admin = createAdminClient();
    if (admin) {
      const { data: asset } = await admin.from("video_assets").select("media_url").eq("content_id", item.id).maybeSingle();
      videoAvailable = Boolean(asset?.media_url);
    }
  }

  const date = item.published_at ? new Date(item.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const siteOrigin = getSiteOrigin() || "https://teens2inspire-website-ra8kiujs6.vercel.app";
  const backHref = item.type === "podcast" ? "/listen" : isVideo ? "/watch" : item.type === "event" ? "/events" : "/resources";
  const backLabel = item.type === "podcast" ? "Listen" : isVideo ? "Watch" : item.type === "event" ? "Events" : "Explore";

  return <div className="detail-page page-shell">
    <RecentlyViewedTracker contentId={item.id} />
    <Link href={backHref} className="back-link">← Back to {backLabel}</Link>
    <section className={`detail-layout${isVideo ? " detail-video-layout" : ""}`}>
      {!isVideo && <div className="detail-art">{item.cover_url ? <img src={item.cover_url} alt={`Cover art for ${item.title}`} /> : <span>✳</span>}</div>}
      <div className="detail-copy">
        <span className="eyebrow">{item.category || contentLabel(item.type)}</span>
        <h1>{item.title}</h1>
        {item.description && (isVideo
          ? <ExpandableDescription className="detail-description" text={item.description} label={`${item.title} description`} />
          : <p className="detail-description">{item.description}</p>)}
        {item.type === "podcast" && item.media_url && <audio className="audio-player" controls preload="metadata" src={item.media_url}>Your browser does not support audio playback.</audio>}
        {(item.type === "resource" || item.type === "printable") && (item.media_url || item.external_url) && <a className="button button-primary" href={item.media_url || item.external_url || "#"} target="_blank" rel="noreferrer">Open this {item.type} <span>↗</span></a>}
        {item.type === "event" && <div className="event-meta">
          {item.starts_at && <span>{new Date(item.starts_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}{item.ends_at ? ` – ${new Date(item.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</span>}
          {item.location && <span>{item.location}</span>}{item.address && <span>{item.address}</span>}{item.organizer && <span>Hosted by {item.organizer}</span>}{item.capacity && <span>{item.capacity} spots</span>}{item.ticket_info && <p>{item.ticket_info}</p>}
        </div>}
        {item.type === "event" && item.external_url && <a className="button button-primary" href={item.external_url} target="_blank" rel="noreferrer">Registration details <span>↗</span></a>}
        <div className="detail-meta">{date && <span>Published {date}</span>}{item.tags?.length ? <div className="detail-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}</div>
        <FavoriteButton contentId={item.id} initialSaved={initiallySaved} />
      </div>
    </section>

    {isVideo && <section className="detail-video-stage" aria-label={access.canWatchVideos ? "Video player" : "Members-only video"}>
      {access.canWatchVideos && videoAvailable ? <video className="video-player" controls playsInline preload="metadata" poster={item.cover_url || undefined} src={`/api/media/video/${item.id}`}>Your browser does not support video playback.</video>
        : access.canWatchVideos ? <div className="video-unavailable"><strong>This video is being prepared.</strong><p>Please check back soon.</p></div>
        : <div className="video-access-gate">
          {item.cover_url && <img src={item.cover_url} alt="" loading="lazy" />}
          <span className="media-lock video-gate-lock" role="img" aria-label="Membership required"><LockIcon /></span>
          <div><span className="eyebrow">Paid members only</span><h2>There’s more waiting for you.</h2><p>Sign in with an active paid Teens2Inspire membership to watch this story.</p>
            <div className="video-gate-actions"><Link className="button button-primary" href={access.isSignedIn ? "/profile" : "/signup"}>{access.isSignedIn ? "View your membership" : "Join Teens2Inspire"} <span aria-hidden="true">↗</span></Link>{!access.isSignedIn && <Link className="text-link" href="/login">Already a member? Sign in</Link>}</div>
          </div>
        </div>}
    </section>}

    <div className="detail-share"><span>Pass it along to someone who’d love it.</span><a href={`mailto:?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(`Thought you might like this: ${siteOrigin}/content/${item.slug}`)}`}>Share this <span>↗</span></a></div>
    {related.length > 0 && <MediaShelf title="You might also like" items={related} canWatchVideos={access.canWatchVideos} />}
  </div>;
}
