import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudioForm } from "@/components/StudioForm";
import { SchoolCodeManager } from "@/components/SchoolCodeManager";
import type { ContentRecord } from "@/lib/content";
export const metadata: Metadata = { title: "Teens2Inspire Studio" };
export default async function DashboardPage() {
  const supabase=await createClient(); if(!supabase) return <div className="empty-library page-shell"><h1>Teens2Inspire Studio</h1><p>Connect Supabase to open the publishing studio.</p></div>;
  const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("role, first_name").eq("id",user.id).maybeSingle();
  if(!profile || !["administrator","content_editor","event_manager"].includes(profile.role)) redirect("/");
  const now=new Date().toISOString();
  const [{count:published},{count:drafts},{count:events},{data:recent},{data:messages},{count:messageCount},{data:userCount}] = await Promise.all([
    supabase.from("content").select("id",{count:"exact",head:true}).eq("status","published"),
    supabase.from("content").select("id",{count:"exact",head:true}).eq("status","draft"),
    supabase.from("content").select("id",{count:"exact",head:true}).eq("type","event").eq("status","published").gte("starts_at",now),
    supabase.from("content").select("id,title,type,status,created_at").order("created_at",{ascending:false}).limit(6),
    profile.role === "administrator" ? supabase.from("messages").select("id,name,email,subject,message,created_at,is_read").order("created_at",{ascending:false}).limit(8) : Promise.resolve({data:[]}),
    profile.role === "administrator" ? supabase.from("messages").select("id",{count:"exact",head:true}) : Promise.resolve({count:0}),
    profile.role === "administrator" ? supabase.rpc("studio_user_count") : Promise.resolve({data:null}),
  ]);
  const {data:studioItems}=await supabase.from("content").select("*").order("created_at",{ascending:false}).limit(100);
  return <div className="studio-page page-shell"><div className="studio-heading"><div><span className="eyebrow eyebrow-line">Your publishing space</span><h1>Teens2Inspire <em>Studio</em></h1><p>Everything you share here finds its way to the right place.</p></div><Link className="button button-outline" href="/">View the site <span>↗</span></Link></div><div className="studio-stats"><div><span>Published content</span><b>{published ?? 0}</b></div><div><span>Drafts</span><b>{drafts ?? 0}</b></div><div><span>Upcoming events</span><b>{events ?? 0}</b></div>{profile.role === "administrator" && <><div><span>Messages</span><b>{messageCount ?? messages?.length ?? 0}</b></div><div><span>Users</span><b>{userCount ?? 0}</b></div></>}</div><section className="studio-editor"><span className="eyebrow">Make something new</span><h2>Publish to the library</h2><p>New published content appears automatically across the site.</p><StudioForm eventManager={profile.role === "event_manager"} items={(studioItems??[]) as ContentRecord[]}/></section>{profile.role === "administrator" && <SchoolCodeManager />}<section className="studio-lower"><div><div className="section-heading"><div><span className="eyebrow">What’s been happening</span><h2>Recent content</h2></div></div><div className="activity-list">{recent?.length ? recent.map((item:any)=><div className="activity-row" key={item.id}><span className={`status-dot status-${item.status}`}/><div><b>{item.title}</b><small>{item.type} · {item.status} · {new Date(item.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</small></div></div>) : <p className="muted-copy">Your first piece of content will show up here.</p>}</div></div>{profile.role === "administrator" && <div><div className="section-heading"><div><span className="eyebrow">From the community</span><h2>Latest messages</h2></div></div><div className="activity-list">{messages?.length ? messages.map((message:any)=><details className="message-row" key={message.id}><summary><span>{message.name}</span><b>{message.subject}</b><small>{new Date(message.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</small></summary><p>{message.message}</p><a href={`mailto:${message.email}`}>{message.email}</a></details>) : <p className="muted-copy">No new notes yet.</p>}</div></div>}</section></div>;
}
