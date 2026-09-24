import Link from "next/link";
import { getPublishedContent } from "@/lib/content";
import { MediaShelf } from "@/components/MediaShelf";

export default async function HomePage() {
  const [podcasts, videos, resources, events] = await Promise.all([
    getPublishedContent("podcast", 6), getPublishedContent("video", 6),
    getPublishedContent("resource", 4), getPublishedContent("event", 3),
  ]);
  const featured = podcasts[0];
  const upcoming = events.filter((event) => !event.starts_at || new Date(event.starts_at) >= new Date()).slice(0, 2);
  return <>
    <section className="home-hero page-shell">
      <div className="hero-copy"><span className="eyebrow eyebrow-line">A space made for you</span><h1>Inspiring Jewish<br /><em>teen girls.</em></h1><p className="hero-description">A place to listen, watch, explore, connect and grow — together.</p><div className="hero-actions"><Link className="button button-primary" href="/listen">Start exploring <span aria-hidden="true">↗</span></Link><Link className="button button-quiet" href="/signup">Join the community <span aria-hidden="true">→</span></Link></div><div className="hero-footnote"><span className="tiny-flower">✳</span> Thoughtful stories. Real life. Jewish joy.</div></div>
      <div className={`hero-feature${featured?.cover_url ? " has-image" : ""}`} style={featured?.cover_url ? { backgroundImage: `linear-gradient(180deg,rgba(13,12,14,.08),rgba(13,12,14,.9)),url("${featured.cover_url}")` } : undefined}>
        <div className="feature-orbit" aria-hidden="true"><span>✳</span><i /></div>
        <div className="feature-content"><span className="eyebrow">{featured ? "Featured conversation" : "A little room to grow"}</span><div className="feature-bottom">{featured ? <><h2>{featured.title}</h2>{featured.description && <p>{featured.description}</p>}<Link className="feature-play" href={`/content/${featured.slug}`}><span>▶</span> Listen now <b>↗</b></Link></> : <><h2>There’s a place<br />for you here.</h2><p>Real conversations for wherever you are in the becoming.</p><Link className="feature-play" href="/listen"><span>✳</span> Find your next listen <b>↗</b></Link></>}</div>
        </div>
        <span className="feature-index">01 <i /> 04</span>
      </div>
      <div className="hero-aside" aria-hidden="true"><span>JEWISH LIFE · TEEN LIFE · YOU</span><span className="aside-star">✳</span></div>
    </section>

    <section className="mission-section page-shell"><div className="mission-label"><span className="eyebrow">More than a podcast</span><span className="mission-number">01 — 04</span></div><div className="mission-main"><h2>A space to<br /><em>connect &amp; grow.</em></h2><p>Teens2Inspire is a space created especially for Jewish teen girls — with conversations, stories, resources, events and inspiration for real life.</p><div className="mission-pillars"><Link href="/listen"><span>01</span><b>Listen</b><i>↗</i><small>Conversations worth having</small></Link><Link href="/watch"><span>02</span><b>Watch</b><i>↗</i><small>Stories that stay with you</small></Link><Link href="/resources"><span>03</span><b>Explore</b><i>↗</i><small>Tools for your everyday</small></Link><Link href="/events"><span>04</span><b>Connect</b><i>↗</i><small>Find your people</small></Link></div></div></section>

    <div className="home-shelves page-shell"><MediaShelf title="Latest conversations" items={podcasts} href="/listen" /><MediaShelf title="Watch something real" items={videos} href="/watch" empty="Fresh stories are on their way. Check back soon." /></div>

    <section className="home-resource page-shell"><div className="resource-intro"><span className="eyebrow">A little help, right when you need it</span><h2>For real life,<br /><em>and everything in it.</em></h2><p>Study stress, camp packing, a friendship wobble, or a moment to reconnect. Find a resource that meets you where you are.</p><Link className="text-link" href="/resources">Explore the library <span aria-hidden="true">↗</span></Link></div><div className="resource-feature-grid">{resources.length ? resources.slice(0,4).map((item,index)=><Link className={`resource-tile resource-tile-${index+1}`} href={`/content/${item.slug}`} key={item.id}><span className="tile-index">0{index+1}</span><span className="tile-arrow">↗</span><span className="tile-title">{item.title}</span><small>{item.category || "Explore resource"}</small></Link>) : <Link className="resource-tile resource-tile-empty" href="/resources"><span className="tile-index">✳</span><span className="tile-arrow">↗</span><span className="tile-title">The good stuff is on its way.</span><small>See what this space is about</small></Link>}</div></section>

    <section className="events-strip page-shell"><div className="section-heading"><div><span className="eyebrow">Good things happen together</span><h2>Come as you are.</h2></div><Link className="text-link" href="/events">All events <span aria-hidden="true">↗</span></Link></div>{upcoming.length ? <div className="event-list">{upcoming.map((event,index)=><Link className="event-row" href={`/content/${event.slug}`} key={event.id}><span className="event-counter">0{index+1}</span><span className="event-date">{event.starts_at ? new Date(event.starts_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "Coming soon"}</span><span className="event-info"><b>{event.title}</b><small>{event.location || event.category || "Details coming soon"}</small></span><span className="event-description">{event.description || "A chance to learn, meet and make a memory."}</span><span className="event-arrow">↗</span></Link>)}</div> : <div className="event-empty"><span>✳</span><p>We’re dreaming up ways to bring everyone together.<br />New events will show up here soon.</p><Link href="/events">Explore events <span aria-hidden="true">↗</span></Link></div>}</section>

    <section className="closing-cta"><div className="cta-sparkle" aria-hidden="true">✳</div><span className="eyebrow">You belong in the story</span><h2>There’s a place<br /><em>for you here.</em></h2><p>Inspiring Jewish teen girls. One conversation, story and experience at a time.</p><div className="hero-actions"><Link className="button button-primary" href="/signup">Join Teens2Inspire <span aria-hidden="true">↗</span></Link><Link className="button button-quiet" href="/watch">Watch now <span aria-hidden="true">→</span></Link></div></section>
  </>;
}
