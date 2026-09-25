import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createR2UploadUrl, getR2Config } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const allowedByKind: Record<string, string[]> = {
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
  original: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
  podcast: ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a"],
  resource: ["application/pdf"],
  printable: ["application/pdf"],
  article: ["application/pdf"],
  artwork: ["image/jpeg", "image/png", "image/webp", "image/avif"],
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(request.url).origin, process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean));
    if (!allowed.has(origin)) return NextResponse.json({ error: "Upload request was not allowed." }, { status: 403 });
  }
  if (!getR2Config()) return NextResponse.json({ error: "Cloudflare R2 is not configured yet." }, { status: 503 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Sign in to continue." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "administrator") return NextResponse.json({ error: "Only the Teens2Inspire owner can upload content." }, { status: 403 });

  let body: { kind?: unknown; name?: unknown; type?: unknown; size?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid upload details." }, { status: 400 }); }
  const kind = String(body.kind || "");
  const contentType = String(body.type || "").toLowerCase();
  const fileName = String(body.name || "").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80);
  const size = Number(body.size);
  const allowedTypes = allowedByKind[kind];
  if (!allowedTypes || !allowedTypes.includes(contentType) || !fileName || !Number.isSafeInteger(size) || size < 1 || size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: "Choose a supported file under 100 MB." }, { status: 400 });
  }

  const folder = kind === "video" || kind === "original" ? "video-assets" : "media";
  const key = `${folder}/${user.id}/${Date.now()}-${randomUUID()}-${fileName}`;
  const uploadUrl = await createR2UploadUrl(key, contentType);
  if (!uploadUrl) return NextResponse.json({ error: "Cloudflare R2 is not configured yet." }, { status: 503 });
  return NextResponse.json({ uploadUrl, ref: `r2://${key}`, contentType, maxSize: 100 * 1024 * 1024 }, { headers: { "Cache-Control": "no-store" } });
}
