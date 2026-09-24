import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 }); }
  const name=String(body.name||"").trim(), email=String(body.email||"").trim(), subject=String(body.subject||"").trim(), message=String(body.message||"").trim();
  if(!name || name.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !subject || subject.length>150 || message.length<5 || message.length>5000) return NextResponse.json({error:"Please check your details and message."},{status:400});
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"The contact form is not connected yet."},{status:503});
  const {error}=await supabase.from("messages").insert({name,email,subject,message});
  if(error) return NextResponse.json({error:"We couldn't send your message right now."},{status:503});
  return NextResponse.json({ok:true},{status:201});
}
