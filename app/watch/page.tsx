import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedContent } from "@/lib/content";
import { MediaShelf } from "@/components/MediaShelf";

export const metadata: Metadata = { title: "Watch", description: "Original stories, conversations and videos made for Jewish teen girls." };
export default async function WatchPage() {
  const [videos, originals] = await Promise.all([getPublishedContent("video", 48), getPublishedContent("original", 24)]);
  const featured = originals[0] || videos[0];
  return <div className="library-page page-shell"><div className="page-intro"><span className="eyebrow eyebrow-line">Stories you can see yourself in</span><h1>Watch <em>this.</em></h1><p>Original stories, conversations and videos made for Jewish teen girls.</p></div>{featured && <Link className="watch-feature" href={`/content/${featured.slug}`} style={featured.cover_url ? {backgroundImage:`linear-gradient(90deg,rgba(17,14,17,.95),rgba(17,14,17,.35)),url("${featured.cover_url}")`} : undefined}><span className="eyebrow">Featured {featured.type === "original" ? "original" : "video"}</span><h2>{featured.title}</h2><p>{featured.description || "A story made for the moments that matter."}</p><span className="button button-primary">Watch now <i>↗</i></span></Link>}<MediaShelf title="Latest videos" items={videos} empty="Fresh stories are on their way. Check back soon." />{originals.length > 0 && <MediaShelf title="Teens2Inspire Originals" items={originals} empty="Original stories are in the works." />}</div>;
}
