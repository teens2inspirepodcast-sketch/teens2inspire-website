import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteR2Object } from "@/lib/r2";

const types=["podcast","video","resource","printable","event","article","original"];
async function saveContent(request: Request, updating: boolean) {
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase is not configured."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(!profile || profile.role !== "administrator") return NextResponse.json({error:"Only the Teens2Inspire owner can manage content."},{status:403});
  let body:any; try { body=await request.json(); } catch { return NextResponse.json({error:"Invalid form data."},{status:400}); }
  const title=String(body.title||"").trim(), slug=String(body.slug||"").trim(), type=String(body.type||""), status=String(body.status||"draft");
  if(!title || title.length>180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>180 || !types.includes(type) || !["draft","published","archived"].includes(status)) return NextResponse.json({error:"Please check the title, slug, type and status."},{status:400});
  const contentId=String(body.id||"");
  if(updating && !/^[0-9a-f-]{36}$/i.test(contentId)) return NextResponse.json({error:"Choose an item to update."},{status:400});
  const dateValue=(value:unknown):string|null|false=>{if(!value)return null;const date=new Date(String(value));return Number.isNaN(date.getTime())?false:date.toISOString();};
  const requestedPublishedAt=dateValue(body.published_at), startsAt=dateValue(body.starts_at), endsAt=dateValue(body.ends_at);
  if(requestedPublishedAt===false || startsAt===false || endsAt===false) return NextResponse.json({error:"Please check the publication and event dates."},{status:400});
  const publishedAt=status==="published"?(requestedPublishedAt||new Date().toISOString()):null;
  const capacityText=String(body.capacity||"").trim(), capacity=capacityText?Number(capacityText):null;
  if(capacity!==null && (!Number.isInteger(capacity)||capacity<1||capacity>10000)) return NextResponse.json({error:"Event capacity must be between 1 and 10,000."},{status:400});
  const optionalUrl=(value:unknown,storage=false)=>{const text=String(value||"").trim();if(!text)return null;if(storage && (/^storage:\/\/media\/[0-9a-f-]{36}\/\d+-[A-Za-z0-9._-]{1,100}$/i.test(text)||new RegExp(`^r2:\\/\\/media\\/${user.id}\\/\\d+-[0-9a-f-]{36}-[A-Za-z0-9._-]{1,100}$`,'i').test(text)))return text;try{const url=new URL(text);return ["https:","http:"].includes(url.protocol)?url.toString():false;}catch{return false;}};
  const coverUrl=optionalUrl(body.cover_url,true), rawMediaUrl=String(body.media_url||"").trim(), externalUrl=optionalUrl(body.external_url);
  const isVideo = type === "video" || type === "original";
  const uploadedVideo = isVideo && rawMediaUrl ? (new RegExp(`^r2:\\/\\/video-assets\\/${user.id}\\/\\d+-[0-9a-f-]{36}-[A-Za-z0-9._-]{1,100}$`,'i').test(rawMediaUrl) || (/^storage:\/\/video-assets\/[0-9a-f-]{36}\/\d+-[A-Za-z0-9._-]{1,100}$/i.test(rawMediaUrl) && rawMediaUrl.startsWith(`storage://video-assets/${user.id}/`))) : false;
  const mediaUrl = isVideo ? null : optionalUrl(rawMediaUrl,true);
  if(coverUrl===false || mediaUrl===false || externalUrl===false || (isVideo && (rawMediaUrl && !uploadedVideo || externalUrl))) return NextResponse.json({error:"Videos must be uploaded to Teens2Inspire protected storage. Direct video links aren’t accepted."},{status:400});
  const tags=Array.isArray(body.tags)?body.tags.map((tag:unknown)=>String(tag).trim()).filter(Boolean).slice(0,20):[];
  const payload={title,slug,type,status,description:String(body.description||"").trim().slice(0,10000)||null,category:String(body.category||"").trim().slice(0,100)||null,tags,cover_url:coverUrl,media_url:mediaUrl,external_url:externalUrl,published_at:publishedAt,location:String(body.location||"").trim().slice(0,250)||null,address:String(body.address||"").trim().slice(0,500)||null,organizer:String(body.organizer||"").trim().slice(0,180)||null,capacity,ticket_info:String(body.ticket_info||"").trim().slice(0,1000)||null,starts_at:startsAt,ends_at:endsAt,created_by:user.id};
  let error;
  const admin = isVideo || updating ? createAdminClient() : null;
  if (isVideo && !admin) return NextResponse.json({error:"Protected video storage isn’t configured yet."},{status:503});
  let existingVideoPath: string | null = null;
  let existingType: string | null = null;
  let existingMediaUrl: string | null = null;
  let newContentId: string | null = null;
  if(updating) {
    const {data:existing}=await supabase.from("content").select("id,type,media_url").eq("id",contentId).maybeSingle();
    if(!existing) return NextResponse.json({error:"That content could not be found."},{status:404});
    existingType = existing.type;
    existingMediaUrl = existing.media_url;
    if ((existingType === "video" || existingType === "original") && !isVideo && !admin) return NextResponse.json({error:"Protected video storage isn’t configured yet."},{status:503});
    if (isVideo && !uploadedVideo) {
      const {data:storedAsset} = await admin!.from("video_assets").select("media_url").eq("content_id", contentId).maybeSingle();
      existingVideoPath = storedAsset?.media_url ?? null;
    }
  }
  if (isVideo && status === "published" && !uploadedVideo && !existingVideoPath) return NextResponse.json({error:"Upload the video file before publishing this item."},{status:400});
  if (updating && !isVideo && !rawMediaUrl) payload.media_url = existingType === "video" || existingType === "original" ? null : existingMediaUrl;
  if(updating) {
    const {created_by:_createdBy,...updatePayload}=payload;
    ({error}=await supabase.from("content").update(updatePayload).eq("id",contentId));
  } else {
    const {data:created,error:insertError}=await supabase.from("content").insert(payload).select("id").single();
    error = insertError;
    newContentId = created?.id ?? null;
  }
  if(error) return NextResponse.json({error:error.code==="23505"?"That slug is already in use.":"We couldn't save this item. Check its details and try again."},{status:400});
  if ((existingType === "video" || existingType === "original") && !isVideo) await admin?.from("video_assets").delete().eq("content_id", contentId);
  if (isVideo && (uploadedVideo || (updating && existingVideoPath))) {
    const targetId = updating ? contentId : newContentId;
    const pathToSave = uploadedVideo ? rawMediaUrl : existingVideoPath;
    if (!targetId || !pathToSave) return NextResponse.json({error:"The video metadata was saved, but its protected file could not be linked."},{status:503});
    const {error:assetError} = await admin!.from("video_assets").upsert({content_id:targetId,media_url:pathToSave,updated_at:new Date().toISOString()},{onConflict:"content_id"});
    if (assetError) {
      // Keep a failed publish/update from leaving a public listing with a broken video.
      if (updating) await supabase.from("content").update({status:"draft",published_at:null}).eq("id",contentId);
      else if (newContentId) await supabase.from("content").delete().eq("id",newContentId);
      // Uploaded files can be retried from the Studio. Remove only a newly uploaded file,
      // never the previous asset that may still be referenced by the content item.
      if (uploadedVideo && rawMediaUrl !== existingVideoPath) {
        if (rawMediaUrl.startsWith("r2://")) await deleteR2Object(rawMediaUrl);
        else {
          const storagePath = rawMediaUrl.replace(/^storage:\/\/video-assets\//, "");
          await admin!.storage.from("video-assets").remove([storagePath]);
        }
      }
      return NextResponse.json({error:"The protected video could not be linked. The item was kept unpublished; please upload it again."},{status:503});
    }
  }
  return NextResponse.json({ok:true},{status:updating?200:201});
}

export async function POST(request:Request) { return saveContent(request,false); }
export async function PATCH(request:Request) { return saveContent(request,true); }

export async function DELETE(request:Request) {
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase is not configured."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(!profile || profile.role !== "administrator") return NextResponse.json({error:"Only the Teens2Inspire owner can manage content."},{status:403});
  let body:any; try { body=await request.json(); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  const contentId=String(body.id||""); if(!/^[0-9a-f-]{36}$/i.test(contentId)) return NextResponse.json({error:"Choose an item to remove."},{status:400});
  const {data:item}=await supabase.from("content").select("id,type,media_url,cover_url").eq("id",contentId).maybeSingle(); if(!item) return NextResponse.json({error:"That content could not be found."},{status:404});
  let videoRef: string | null = null;
  if (item.type === "video" || item.type === "original") {
    const admin = createAdminClient();
    if (admin) {
      const {data:asset}=await admin.from("video_assets").select("media_url").eq("content_id",contentId).maybeSingle();
      videoRef = asset?.media_url ?? null;
    }
  }
  const {error}=await supabase.from("content").delete().eq("id",contentId); if(error) return NextResponse.json({error:"We couldn't remove this item."},{status:400});
  await Promise.all([deleteR2Object(videoRef), deleteR2Object(item.media_url), deleteR2Object(item.cover_url)]);
  return NextResponse.json({ok:true});
}
