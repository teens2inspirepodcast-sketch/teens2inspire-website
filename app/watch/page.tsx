import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedContent } from "@/lib/content";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { MediaShelf } from "@/components/MediaShelf";
import { getViewerAccess } from "@/lib/membership-access";

export const metadata: Metadata = { title: "Watch", description: "Original stories, conversations and videos made for Jewish teen girls." };

export default async function WatchPage() {
  const [videos, originals, access] = await Promise.all([
    getPublishedContent("video", 48),
    getPublishedContent("original", 24),
    getViewerAccess(),
  ]);
  const featured = videos[0] || originals[0];
  const latestVideos = featured?.type === "video" ? videos.slice(1) : videos;
  const remainingOriginals = featured?.type === "original" ? originals.slice(1) : originals;
  const featuredHref = featured ? `/content/${featured.slug}` : "/watch";

  return (
    <div className="library-page page-shell watch-page">
      <div className="page-intro">
        <span className="eyebrow eyebrow-line">Stories you can see yourself in</span>
        <h1>Watch <em>this.</em></h1>
        <p>Original stories, conversations and videos made for Jewish teen girls.</p>
      </div>

      {featured ? (
        <section className="watch-feature" aria-label="Featured video">
          <div className="watch-feature-copy">
            <span className="eyebrow">Featured {featured.type === "original" ? "original" : "video"}</span>
            <h2>{featured.title}</h2>
            {featured.description && <ExpandableDescription
              className="watch-feature-description"
              text={featured.description}
              label={`${featured.title} description`}
            />}
            <Link className="button button-primary" href={featuredHref}>
              Watch now <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <Link className="watch-feature-art" href={featuredHref} aria-label={`Watch ${featured.title}`}>
            {featured.cover_url ? (
              <img src={featured.cover_url} alt="" />
            ) : (
              <span className="watch-feature-placeholder" aria-hidden="true">✳</span>
            )}
            <span className="watch-feature-play" aria-hidden="true">▶</span>
            {!access.canWatchVideos && <span className="media-lock watch-feature-lock" role="img" aria-label="Membership required"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V4.5a3.5 3.5 0 0 1 7 0V6h.75A1.75 1.75 0 0 1 14 7.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5A1.75 1.75 0 0 1 3.75 6zm1.5 0h4V4.5a2 2 0 0 0-4 0zM8 8.5a1.25 1.25 0 0 0-.75 2.25v1.5h1.5v-1.5A1.25 1.25 0 0 0 8 8.5" fill="currentColor"/></svg></span>}
          </Link>
        </section>
      ) : (
        <section className="watch-empty-feature">
          <span className="eyebrow">A little something to look forward to</span>
          <h2>New stories are on their way.</h2>
          <p>Check back soon for videos made for Jewish teen girls.</p>
        </section>
      )}

      <MediaShelf title="Latest videos" items={latestVideos} empty="Fresh stories are on their way. Check back soon." canWatchVideos={access.canWatchVideos} />
      {remainingOriginals.length > 0 && (
        <MediaShelf title="Teens2Inspire Originals" items={remainingOriginals} empty="Original stories are in the works." canWatchVideos={access.canWatchVideos} />
      )}
    </div>
  );
}
