import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const types=["podcast","video","resource","printable","event","article","original"];
async function saveContent(request: Request, updating: boolean) {
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase is not configured."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(!profile || !["administrator","content_editor","event_manager"].includes(profile.role)) return NextResponse.json({error:"You don't have permission to publish content."},{status:403});
  let body:any; try { body=await request.json(); } catch { return NextResponse.json({error:"Invalid form data."},{status:400}); }
  const title=String(body.title||"").trim(), slug=String(body.slug||"").trim(), type=String(body.type||""), status=String(body.status||"draft");
  if(!title || title.length>180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>180 || !types.includes(type) || !["draft","published","archived"].includes(status)) return NextResponse.json({error:"Please check the title, slug, type and status."},{status:400});
  if(profile.role==="event_manager" && type!=="event") return NextResponse.json({error:"Event managers can publish events only."},{status:403});
  const contentId=String(body.id||"");
  if(updating && !/^[0-9a-f-]{36}$/i.test(contentId)) return NextResponse.json({error:"Choose an item to update."},{status:400});
  const dateValue=(value:unknown):string|null|false=>{if(!value)return null;const date=new Date(String(value));return Number.isNaN(date.getTime())?false:date.toISOString();};
  const requestedPublishedAt=dateValue(body.published_at), startsAt=dateValue(body.starts_at), endsAt=dateValue(body.ends_at);
  if(requestedPublishedAt===false || startsAt===false || endsAt===false) return NextResponse.json({error:"Please check the publication and event dates."},{status:400});
  const publishedAt=status==="published"?(requestedPublishedAt||new Date().toISOString()):null;
  const capacityText=String(body.capacity||"").trim(), capacity=capacityText?Number(capacityText):null;
  if(capacity!==null && (!Number.isInteger(capacity)||capacity<1||capacity>10000)) return NextResponse.json({error:"Event capacity must be between 1 and 10,000."},{status:400});
  const optionalUrl=(value:unknown,storage=false)=>{const text=String(value||"").trim();if(!text)return null;if(storage && /^storage:\/\/media\/[0-9a-f-]{36}\/\d+-[A-Za-z0-9._-]{1,100}$/i.test(text))return text;try{const url=new URL(text);return ["https:","http:"].includes(url.protocol)?url.toString():false;}catch{return false;}};
  const coverUrl=optionalUrl(body.cover_url,true), mediaUrl=optionalUrl(body.media_url,true), externalUrl=optionalUrl(body.external_url);
  if(coverUrl===false || mediaUrl===false || externalUrl===false) return NextResponse.json({error:"Use a valid web link for cover, media and external URLs."},{status:400});
  const tags=Array.isArray(body.tags)?body.tags.map((tag:unknown)=>String(tag).trim()).filter(Boolean).slice(0,20):[];
  const payload={title,slug,type,status,description:String(body.description||"").trim().slice(0,10000)||null,category:String(body.category||"").trim().slice(0,100)||null,tags,cover_url:coverUrl,media_url:mediaUrl,external_url:externalUrl,published_at:publishedAt,location:String(body.location||"").trim().slice(0,250)||null,address:String(body.address||"").trim().slice(0,500)||null,organizer:String(body.organizer||"").trim().slice(0,180)||null,capacity,ticket_info:String(body.ticket_info||"").trim().slice(0,1000)||null,starts_at:startsAt,ends_at:endsAt,created_by:user.id};
  let error;
  if(updating) {
    const {data:existing}=await supabase.from("content").select("id,type").eq("id",contentId).maybeSingle();
    if(!existing) return NextResponse.json({error:"That content could not be found."},{status:404});
    if(profile.role==="event_manager" && existing.type!=="event") return NextResponse.json({error:"Event managers can update events only."},{status:403});
    const {created_by:_createdBy,...updatePayload}=payload;
    ({error}=await supabase.from("content").update(updatePayload).eq("id",contentId));
  } else {
    ({error}=await supabase.from("content").insert(payload));
  }
  if(error) return NextResponse.json({error:error.code==="23505"?"That slug is already in use.":"We couldn't save this item. Check its details and try again."},{status:400});
  return NextResponse.json({ok:true},{status:updating?200:201});
}

export async function POST(request:Request) { return saveContent(request,false); }
export async function PATCH(request:Request) { return saveContent(request,true); }

export async function DELETE(request:Request) {
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase is not configured."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(!profile || !["administrator","content_editor","event_manager"].includes(profile.role)) return NextResponse.json({error:"You don't have permission to remove content."},{status:403});
  let body:any; try { body=await request.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  const contentId=String(body.id||""); if(!/^[0-9a-f-]{36}$/i.test(contentId)) return NextResponse.json({error:"Choose an item to remove."},{status:400});
  const {data:item}=await supabase.from("content").select("id,type").eq("id",contentId).maybeSingle(); if(!item) return NextResponse.json({error:"That content could not be found."},{status:404});
  if(profile.role==="event_manager" && item.type!=="event") return NextResponse.json({error:"Event managers can remove events only."},{status:403});
  const {error}=await supabase.from("content").delete().eq("id",contentId); if(error) return NextResponse.json({error:"We couldn't remove this item."},{status:400});
  return NextResponse.json({ok:true});
}
