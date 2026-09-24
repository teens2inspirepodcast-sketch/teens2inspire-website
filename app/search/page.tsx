import type { Metadata } from "next";
import { searchPublishedContent } from "@/lib/content";
import { SearchForm } from "@/components/SearchForm";
import { MediaCard } from "@/components/MediaCard";

export const metadata: Metadata = { title: "Search", description: "Search conversations, videos, events and resources from Teens2Inspire." };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams; const results = q.trim() ? await searchPublishedContent(q) : [];
  return <div className="library-page page-shell search-page"><div className="page-intro"><span className="eyebrow eyebrow-line">Find your next something</span><h1>Search <em>around.</em></h1><p>Look through conversations, videos, resources, articles and events.</p></div><SearchForm initialValue={q}/>{q.trim() ? <section className="search-results"><div className="section-heading"><div><span className="eyebrow">A good place to start</span><h2>Results for “{q}” <small>{results.length}</small></h2></div></div>{results.length ? <div className="resource-grid">{results.map((item)=><MediaCard key={item.id} item={item}/>)}</div> : <div className="empty-library"><span className="empty-sparkle">✳</span><h2>Nothing surfaced for that search.</h2><p>Try another word or browse the library instead.</p></div>}</section> : <div className="search-prompt"><span className="prompt-star">✳</span><p>Try searching for <a href="/search?q=friendship">friendship</a>, <a href="/search?q=school">school</a>, or <a href="/search?q=Jewish+life">Jewish life</a>.</p></div>}</div>;
}
