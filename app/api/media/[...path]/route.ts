import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createR2DownloadUrl, getR2Object, keyFromR2Ref } from "@/lib/r2";
import { getViewerAccess } from "@/lib/membership-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const privateVideoRef = /^storage:\/\/video-assets\/([0-9a-f-]{36})\/(\d+-[A-Za-z0-9._-]{1,100})$/i;
const videoRangeSize = 4 * 1024 * 1024;
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;

  // Check membership on every request, including each video seek/range request.
  if (parts[0] === "video" && parts.length === 2 && /^[0-9a-f-]{36}$/i.test(parts[1])) {
    const supabase = await createClient();
    const admin = createAdminClient();
    if (!supabase || !admin) return new NextResponse("Not found", { status: 404 });
    const access = await getViewerAccess(supabase);
    if (!access.canWatchVideos) return new NextResponse("Membership required", { status: access.isSignedIn ? 403 : 401 });

    const { data: item } = await supabase.from("content").select("id,type,status")
      .eq("id", parts[1]).eq("status", "published").maybeSingle();
    if (!item || (item.type !== "video" && item.type !== "original")) return new NextResponse("Not found", { status: 404 });
    const { data: asset } = await admin.from("video_assets").select("media_url").eq("content_id", item.id).maybeSingle();
    const ref = asset?.media_url || "";
    const r2Key = keyFromR2Ref(ref);
    const legacyMatch = privateVideoRef.exec(ref);
    if (!r2Key && !legacyMatch) return new NextResponse("Video unavailable", { status: 404 });

    const requestedRange = request.headers.get("range") || `bytes=0-${videoRangeSize - 1}`;
    const byteRange = /^bytes=(\d+)-(\d*)$/i.exec(requestedRange.trim());
    if (!byteRange) return new NextResponse("Invalid range", { status: 416, headers: privateHeaders });
    const start = Number(byteRange[1]);
    const requestedEnd = byteRange[2] ? Number(byteRange[2]) : start + videoRangeSize - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start) return new NextResponse("Invalid range", { status: 416, headers: privateHeaders });
    const range = `bytes=${start}-${Math.min(requestedEnd, start + videoRangeSize - 1)}`;

    let upstream: Response | null = null;
    if (r2Key?.startsWith("video-assets/")) {
      upstream = await getR2Object(r2Key, range).catch(() => null);
    } else if (legacyMatch) {
      const objectPath = `${legacyMatch[1]}/${legacyMatch[2]}`;
      const { data: signed, error: signError } = await admin.storage.from("video-assets").createSignedUrl(objectPath, 60);
      if (!signError && signed?.signedUrl) {
        upstream = await fetch(signed.signedUrl, { headers: { Range: range }, cache: "no-store", redirect: "error" }).catch(() => null);
      }
    }
    if (!upstream?.ok && upstream?.status !== 206) return new NextResponse("Video unavailable", { status: 502, headers: privateHeaders });
    const responseHeaders = new Headers({ ...privateHeaders,
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Accept-Ranges": "bytes",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  }

  const isR2 = parts[0] === "r2" && parts.length === 4 && parts[1] === "media";
  const storagePath = isR2 ? parts.slice(1).join("/") : parts.join("/");
  if (!isR2 && !/^[0-9a-f-]{36}\/\d+-[A-Za-z0-9._-]{1,100}$/i.test(storagePath)) return new NextResponse("Not found", { status: 404 });
  const storageRef = isR2 ? `r2://${storagePath}` : `storage://media/${storagePath}`;
  const r2Key = isR2 ? keyFromR2Ref(storageRef) : null;
  if (isR2 && !r2Key) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return new NextResponse("Media unavailable", { status: 503 });
  const { data: privateVideo, error: privateVideoError } = await admin.from("video_assets").select("content_id").eq("media_url", storageRef).limit(1).maybeSingle();
  if (privateVideoError) return new NextResponse("Media unavailable", { status: 503 });
  if (privateVideo) return new NextResponse("Not found", { status: 404 });
  const [{ data: publishedMedia }, { data: publishedCover }] = await Promise.all([
    supabase.from("content").select("id").eq("status", "published").eq("media_url", storageRef).limit(1).maybeSingle(),
    supabase.from("content").select("id").eq("status", "published").eq("cover_url", storageRef).limit(1).maybeSingle(),
  ]);
  if (!publishedMedia && !publishedCover) return new NextResponse("Not found", { status: 404 });

  if (r2Key) {
    const signedUrl = await createR2DownloadUrl(r2Key, 300);
    if (!signedUrl) return new NextResponse("Media unavailable", { status: 503 });
    return new NextResponse(null, { status: 307, headers: { Location: signedUrl, ...privateHeaders } });
  }
  const { data, error } = await supabase.storage.from("media").createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(null, { status: 307, headers: { Location: data.signedUrl, ...privateHeaders } });
}
