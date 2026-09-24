import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase is not configured."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Sign in first."},{status:401});
  let contentId=""; try { contentId=String((await request.json()).contentId||""); } catch { return NextResponse.json({error:"Invalid request."},{status:400}); }
  if(!/^[0-9a-f-]{36}$/i.test(contentId)) return NextResponse.json({error:"Invalid content."},{status:400});
  const {data:existing}=await supabase.from("favorites").select("content_id").eq("user_id",user.id).eq("content_id",contentId).maybeSingle();
  if(existing) { const {error}=await supabase.from("favorites").delete().eq("user_id",user.id).eq("content_id",contentId); if(error) return NextResponse.json({error:"Could not update saved items."},{status:503}); return NextResponse.json({saved:false}); }
  const {error}=await supabase.from("favorites").insert({user_id:user.id,content_id:contentId}); if(error) return NextResponse.json({error:"Could not update saved items."},{status:503});
  return NextResponse.json({saved:true});
}
