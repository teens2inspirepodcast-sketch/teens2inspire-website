import type { Metadata } from "next";
import { getPublishedContent } from "@/lib/content";
import { MediaShelf } from "@/components/MediaShelf";

export const metadata: Metadata = { title: "Listen", description: "Conversations, stories and ideas for Jewish teen girls." };
export default async function ListenPage() {
  const items = await getPublishedContent("podcast", 48);
  const categories = [...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value)))];
  return <div className="library-page page-shell"><div className="page-intro"><span className="eyebrow eyebrow-line">Press play, feel seen</span><h1>Listen <em>in.</em></h1><p>Conversations, stories and ideas for Jewish teen girls. Find a voice that gets it.</p></div>{categories.length > 0 && <nav className="category-pills" aria-label="Podcast categories"><a className="is-active" href="#all">All conversations</a>{categories.map((category)=><a key={category} href={`#category-${encodeURIComponent(category)}`}>{category}</a>)}</nav>}<div id="all"><MediaShelf title="Latest episodes" items={items} empty="New conversations are on their way. Come back soon." /></div>{categories.map((category)=><div id={`category-${encodeURIComponent(category)}`} key={category}><MediaShelf title={category} items={items.filter((item)=>item.category===category)} /></div>)}</div>;
}
