import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime="nodejs";
export async function POST(request: Request) {
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase is not configured."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Sign in to upload files."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle(); if(!profile || !["administrator","content_editor","event_manager"].includes(profile.role)) return NextResponse.json({error:"You don't have permission to upload files."},{status:403});
  const form=await request.formData(), file=form.get("file"), kind=String(form.get("kind")||""); if(!(file instanceof File) || file.size===0 || file.size>100*1024*1024) return NextResponse.json({error:"Choose a file smaller than 100 MB."},{status:400});
  const allowed=kind==="artwork"?file.type.startsWith("image/"):kind==="podcast"?file.type.startsWith("audio/"):kind==="video"||kind==="original"?file.type.startsWith("video/"):kind==="event"?file.type.startsWith("image/"):kind==="resource"||kind==="printable"||kind==="article"?file.type==="application/pdf":false;
  if(!allowed) return NextResponse.json({error:"Choose a file that matches this content type."},{status:400});
  const safeName=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100); const path=`${user.id}/${Date.now()}-${safeName}`;
  const {error}=await supabase.storage.from("media").upload(path,file,{contentType:file.type,upsert:false}); if(error) return NextResponse.json({error:"Upload couldn't finish. Please try again."},{status:400});
  return NextResponse.json({path:`storage://media/${path}`},{status:201});
}
