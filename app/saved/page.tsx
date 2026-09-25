import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContentRecord, withMediaUrls } from "@/lib/content";
import { MediaCard } from "@/components/MediaCard";
import { getViewerAccess } from "@/lib/membership-access";
export const metadata: Metadata = { title: "Saved" };
export default async function SavedPage() {
  const supabase = await createClient(); if (!supabase) return <div className="empty-library page-shell"><h1>Saved for later</h1><p>Connect Supabase to keep your favorite things close.</p></div>;
  const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
  const {data}=await supabase.from("favorites").select("content(*)").eq("user_id",user.id).order("created_at",{ascending:false});
  const items=(data??[]).map((row:any)=>row.content).filter((item:any)=>item?.status==="published").map((item:any)=>withMediaUrls(item as ContentRecord));
  const access = await getViewerAccess(supabase);
  return <div className="library-page page-shell"><div className="page-intro"><span className="eyebrow eyebrow-line">All the good things you’ve kept</span><h1>Saved <em>for later.</em></h1><p>Your favorite Teens2Inspire content, all in one place.</p></div>{items.length?<div className="resource-grid">{items.map((item)=><MediaCard key={item.id} item={item} canWatchVideos={access.canWatchVideos}/>)}</div>:<div className="empty-library"><span className="empty-sparkle">♡</span><h2>Nothing saved yet.</h2><p>When you find something you love, save it here and come back anytime.</p><Link className="button button-primary" href="/listen">Explore Teens2Inspire <span aria-hidden="true">↗</span></Link></div>}</div>;
}
