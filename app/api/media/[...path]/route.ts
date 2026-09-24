import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const {path:parts}=await params; const path=parts.join("/");
  if(!/^[0-9a-f-]{36}\/\d+-[A-Za-z0-9._-]{1,100}$/i.test(path)) return new NextResponse("Not found",{status:404});
  const supabase=await createClient(); if(!supabase) return new NextResponse("Not found",{status:404});
  const storageRef=`storage://media/${path}`;
  const {data:published}=await supabase.from("content").select("id").eq("status","published").or(`media_url.eq.${storageRef},cover_url.eq.${storageRef}`).limit(1).maybeSingle();
  if(!published) return new NextResponse("Not found",{status:404});
  const {data,error}=await supabase.storage.from("media").download(path); if(error || !data) return new NextResponse("Not found",{status:404});
  return new NextResponse(data,{headers:{"Content-Type":data.type||"application/octet-stream","Cache-Control":"public, max-age=300, stale-while-revalidate=3600","X-Content-Type-Options":"nosniff"}});
}
