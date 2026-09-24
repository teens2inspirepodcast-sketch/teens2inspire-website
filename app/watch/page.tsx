import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedContent } from "@/lib/content";
import { ExpandableDescription } from "@/components/ExpandableDescription";
import { MediaShelf } from "@/components/MediaShelf";

export const metadata: Metadata = { title: "Watch", description: "Original stories, conversations and videos made for Jewish teen girls." };

export default async function WatchPage() {
  const [videos, originals] = await Promise.all([
    getPublishedContent("video", 48),
    getPublishedContent("original", 24),
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
            <ExpandableDescription
              className="watch-feature-description"
              text={featured.description || "A story made for the moments that matter."}
              label={`${featured.title} description`}
            />
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
          </Link>
        </section>
      ) : (
        <section className="watch-empty-feature">
          <span className="eyebrow">A little something to look forward to</span>
          <h2>New stories are on their way.</h2>
          <p>Check back soon for videos made for Jewish teen girls.</p>
        </section>
      )}

      <MediaShelf title="Latest videos" items={latestVideos} empty="Fresh stories are on their way. Check back soon." />
      {remainingOriginals.length > 0 && (
        <MediaShelf title="Teens2Inspire Originals" items={remainingOriginals} empty="Original stories are in the works." />
      )}
    </div>
  );
}
