import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLOUDFLARE_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Add it to .env.local before running this migration.`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: administrator, error: administratorError } = await supabase.from("profiles")
  .select("id").eq("role", "administrator").limit(1).maybeSingle();
if (administratorError) throw administratorError;
if (!administrator?.id) throw new Error("Could not find the Teens2Inspire administrator profile.");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const migrated = new Map();
function parseLegacyRef(ref) {
  const match = /^storage:\/\/(media|video-assets)\/(.+)$/.exec(ref || "");
  if (!match || match[2].split("/").some((part) => !part || part === "." || part === "..")) return null;
  return { bucket: match[1], path: match[2] };
}

async function copyToR2(ref, ownerId) {
  if (ref?.startsWith("r2://")) return ref;
  if (migrated.has(ref)) return migrated.get(ref);
  const legacy = parseLegacyRef(ref);
  if (!legacy) throw new Error(`Unsupported legacy media reference: ${ref}`);
  const { data: blob, error: downloadError } = await supabase.storage.from(legacy.bucket).download(legacy.path);
  if (downloadError || !blob) throw new Error(`Could not download existing ${legacy.bucket} asset.`);
  const name = legacy.path.split("/").at(-1).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "legacy-file";
  const key = `${legacy.bucket}/${ownerId}/${Date.now()}-${randomUUID()}-${name}`;
  const bytes = Buffer.from(await blob.arrayBuffer());
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: bytes,
    ContentLength: bytes.length,
    ContentType: blob.type || "application/octet-stream",
  }));
  const nextRef = `r2://${key}`;
  migrated.set(ref, nextRef);
  return nextRef;
}

let transferred = 0;
const { data: content, error: contentError } = await supabase.from("content")
  .select("id,created_by,cover_url,media_url");
if (contentError) throw contentError;
for (const item of content || []) {
  const ownerId = item.created_by || administrator.id;
  const changes = {};
  if (item.cover_url?.startsWith("storage://")) changes.cover_url = await copyToR2(item.cover_url, ownerId);
  if (item.media_url?.startsWith("storage://")) changes.media_url = await copyToR2(item.media_url, ownerId);
  if (Object.keys(changes).length) {
    const { error } = await supabase.from("content").update(changes).eq("id", item.id);
    if (error) throw error;
    transferred += Object.keys(changes).length;
    console.log(`Updated content ${item.id}`);
  }
}

const { data: assets, error: assetError } = await supabase.from("video_assets").select("content_id,media_url");
if (assetError) throw assetError;
for (const asset of assets || []) {
  if (!asset.media_url?.startsWith("storage://")) continue;
  const { data: item, error: ownerError } = await supabase.from("content").select("created_by").eq("id", asset.content_id).maybeSingle();
  if (ownerError) throw ownerError;
  const nextRef = await copyToR2(asset.media_url, item?.created_by || administrator.id);
  const { error } = await supabase.from("video_assets").update({ media_url: nextRef, updated_at: new Date().toISOString() }).eq("content_id", asset.content_id);
  if (error) {
    const key = nextRef.slice("r2://".length);
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })).catch(() => undefined);
    throw error;
  }
  transferred += 1;
  console.log(`Updated protected video ${asset.content_id}`);
}

console.log(`Finished: migrated ${transferred} content file references to R2. Existing Supabase objects were left untouched as a rollback copy.`);
