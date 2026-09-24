import { createClient } from "@/lib/supabase/server";

export type ContentType = "podcast" | "video" | "resource" | "printable" | "event" | "article" | "original";

export type ContentRecord = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  status: "draft" | "published" | "archived";
  media_url: string | null;
  cover_url: string | null;
  external_url: string | null;
  published_at: string | null;
  created_at: string;
  location?: string | null;
  address?: string | null;
  organizer?: string | null;
  capacity?: number | null;
  ticket_info?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

function resolveStoragePath(value: string | null) {
  if (!value?.startsWith("storage://media/")) return value;
  const path = value.slice("storage://media/".length).split("/").map(encodeURIComponent).join("/");
  return `/api/media/${path}`;
}

function withMediaUrls(item: ContentRecord): ContentRecord {
  return { ...item, cover_url: resolveStoragePath(item.cover_url), media_url: resolveStoragePath(item.media_url) };
}

export async function getPublishedContent(type?: ContentType, limit = 12): Promise<ContentRecord[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("content").select("*").eq("status", "published");
  if (type) query = query.eq("type", type);
  const { data } = await query.order("published_at", { ascending: false }).limit(limit);
  return ((data ?? []) as ContentRecord[]).map(withMediaUrls);
}

export async function getPublishedBySlug(slug: string): Promise<ContentRecord | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("content").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  return data ? withMediaUrls(data as ContentRecord) : null;
}

export async function searchPublishedContent(term: string): Promise<ContentRecord[]> {
  const supabase = await createClient();
  const clean = term.trim().replace(/[,%()[\]{}*"']/g, " ").slice(0, 120);
  if (!supabase || !clean) return [];
  const [textResults, tagResults] = await Promise.all([
    supabase.from("content").select("*").eq("status", "published").or(`title.ilike.%${clean}%,description.ilike.%${clean}%,category.ilike.%${clean}%`).order("published_at", { ascending: false }).limit(48),
    supabase.from("content").select("*").eq("status", "published").contains("tags", [clean]).order("published_at", { ascending: false }).limit(24),
  ]);
  const merged = new Map<string, ContentRecord>();
  for (const item of [...(textResults.data ?? []), ...(tagResults.data ?? [])] as ContentRecord[]) merged.set(item.id, item);
  return [...merged.values()].sort((a,b)=>new Date(b.published_at||b.created_at).getTime()-new Date(a.published_at||a.created_at).getTime()).slice(0,48).map(withMediaUrls);
}

export async function getRelatedContent(item: ContentRecord): Promise<ContentRecord[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("content").select("*").eq("status", "published").neq("id", item.id);
  if (item.tags?.length) query = query.overlaps("tags", item.tags);
  else if (item.category) query = query.eq("category", item.category);
  const { data } = await query.order("published_at", { ascending: false }).limit(4);
  return (data ?? []) as ContentRecord[];
}

export function contentHref(item: Pick<ContentRecord, "slug">) {
  return `/content/${item.slug}`;
}

export function contentLabel(type: string) {
  return type === "podcast" ? "Podcast" : type === "video" || type === "original" ? "Watch" : type === "event" ? "Event" : type;
}
