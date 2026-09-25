import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = { bucket: string; endpoint: string; accessKeyId: string; secretAccessKey: string };
let client: S3Client | null | undefined;

export function getR2Config(): R2Config | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { bucket, endpoint: `https://${accountId}.r2.cloudflarestorage.com`, accessKeyId, secretAccessKey };
}

function getClient() {
  const config = getR2Config();
  if (!config) return null;
  if (!client) client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return client;
}

export function keyFromR2Ref(value: string | null | undefined) {
  if (!value?.startsWith("r2://")) return null;
  const key = value.slice("r2://".length);
  return /^(?:media|video-assets)\/[0-9a-f-]{36}\/[0-9]+-[0-9a-f-]{36}-[A-Za-z0-9._-]{1,100}$/i.test(key) ? key : null;
}

export async function createR2UploadUrl(key: string, contentType: string) {
  const config = getR2Config();
  const s3 = getClient();
  if (!config || !s3) return null;
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
}

export async function createR2DownloadUrl(key: string, seconds = 300) {
  const config = getR2Config();
  const s3 = getClient();
  if (!config || !s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: seconds });
}

export async function getR2Object(key: string, range?: string) {
  const url = await createR2DownloadUrl(key, 60);
  if (!url) return null;
  return fetch(url, { headers: range ? { Range: range } : undefined, cache: "no-store", redirect: "error" });
}

export async function deleteR2Object(ref: string | null | undefined) {
  const key = keyFromR2Ref(ref);
  const config = getR2Config();
  const s3 = getClient();
  if (!key || !config || !s3) return;
  await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
