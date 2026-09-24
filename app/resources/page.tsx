import type { Metadata } from "next";
import { getPublishedContent } from "@/lib/content";
import { MediaCard } from "@/components/MediaCard";
import { SearchForm } from "@/components/SearchForm";

export const metadata: Metadata = { title: "Resources", description: "Thoughtful, practical tools for real teen life." };
export default async function ResourcesPage() {
  const [resources, printables, articles] = await Promise.all([getPublishedContent("resource",48),getPublishedContent("printable",24),getPublishedContent("article",24)]);
  const all = [...resources,...printables,...articles].sort((a,b)=>new Date(b.published_at || b.created_at).getTime()-new Date(a.published_at || a.created_at).getTime());
  const categories = [...new Set(all.map((item)=>item.category).filter((value):value is string=>Boolean(value)))];
  return <div className="library-page page-shell"><div className="page-intro"><span className="eyebrow eyebrow-line">A toolbox for your everyday</span><h1>Real life,<br /><em>right here.</em></h1><p>Practical tools, fresh perspectives and small reminders for whatever you’re figuring out.</p></div><SearchForm /><div className="resource-categories"><a href="#all">Everything</a>{categories.map((category)=><a href={`#${encodeURIComponent(category)}`} key={category}>{category}</a>)}</div>{all.length ? categories.length ? categories.map((category)=><section className="resource-group" id={encodeURIComponent(category)} key={category}><div className="section-heading"><div><span className="eyebrow">A collection for you</span><h2>{category}</h2></div></div><div className="resource-grid">{all.filter((item)=>item.category===category).map((item)=><MediaCard key={item.id} item={item} />)}</div></section>) : <section id="all" className="resource-grid">{all.map((item)=><MediaCard key={item.id} item={item} />)}</section> : <div id="all" className="empty-library"><span className="empty-sparkle">✳</span><h2>Good things are taking shape.</h2><p>New guides, printables and thoughtful reads will find a home here soon.</p></div>}</div>;
}
