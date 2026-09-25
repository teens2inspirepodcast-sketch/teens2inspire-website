"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentRecord } from "@/lib/content";

function localDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}

export function StudioForm({ eventManager = false, items = [] }: { eventManager?: boolean; items?: ContentRecord[] }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [editingId, setEditingId] = useState(""); const [selectedType, setSelectedType] = useState(eventManager ? "event" : "podcast"); const router=useRouter();
  const editing=items.find((item)=>item.id===editingId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget; const values = new FormData(form);
    try {
      const coverFile = values.get("cover_file"), mediaFile = values.get("media_file"); let coverUrl=String(values.get("cover_url")||""), mediaUrl = String(values.get("media_url") || "");
      async function upload(file: FormDataEntryValue | null, kind: string) {
        if (!(file instanceof File) || !file.size) return null;
        const isVideo = kind === "video" || kind === "original";
        const allowedTypes = isVideo ? ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] : kind === "podcast" ? ["audio/mpeg", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a"] : kind === "resource" || kind === "printable" || kind === "article" ? ["application/pdf"] : ["image/jpeg", "image/png", "image/webp", "image/avif"];
        if (allowedTypes && !allowedTypes.includes(file.type)) throw new Error("Choose a file format supported by this content type.");
        if (file.size > 100 * 1024 * 1024) throw new Error("Keep uploads under 100 MB.");
        const uploadRequest = await fetch("/api/r2/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: kind === "artwork" ? "artwork" : kind, name: file.name, type: file.type, size: file.size }),
        });
        const uploadDetails = await uploadRequest.json();
        if (!uploadRequest.ok) throw new Error(uploadDetails.error || "Upload couldn't start.");
        const uploaded = await fetch(uploadDetails.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploaded.ok) throw new Error("Upload couldn't finish. Check the R2 bucket CORS settings and try again.");
        return uploadDetails.ref as string;
      }
      const uploadedCover=await upload(coverFile,"artwork"); if(uploadedCover) coverUrl=uploadedCover;
      const uploadedMedia=await upload(mediaFile,String(values.get("type"))); if(uploadedMedia) mediaUrl=uploadedMedia;
      const payload: Record<string, unknown> = Object.fromEntries(values.entries()); delete payload.cover_file; delete payload.media_file; payload.cover_url=coverUrl||null; payload.media_url = mediaUrl || null;
      if (editingId) payload.id = editingId;
      payload.tags = String(payload.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      if (payload.published_at === "") payload.published_at = null;
      if (payload.starts_at === "") payload.starts_at = null;
      if (payload.ends_at === "") payload.ends_at = null;
      const response = await fetch("/api/content", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save this item.");
      setEditingId(""); setMessage(editingId ? "Your changes are saved." : "Saved to the Teens2Inspire library."); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!editing || !window.confirm(`Remove “${editing.title}” from the library?`)) return;
    setBusy(true); setMessage("");
      try { const response=await fetch("/api/content",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editing.id})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not remove this item.");setEditingId("");setSelectedType(eventManager?"event":"podcast");setMessage("Content removed.");router.refresh(); }
    catch(e){setMessage(e instanceof Error?e.message:"Could not remove this item.");}
    finally{setBusy(false);}
  }
  const item=editing;
  return <div className="studio-compose">
    <div className="studio-compose-tools"><label className="studio-existing">Edit existing content<select value={editingId} onChange={(event)=>{const id=event.target.value;setEditingId(id);setSelectedType(items.find((content)=>content.id===id)?.type||(eventManager?"event":"podcast"));setMessage("");}}><option value="">Create something new</option>{items.filter((content)=>!eventManager||content.type==="event").map((content)=><option key={content.id} value={content.id}>{content.title} · {content.status}</option>)}</select></label>{item&&<button type="button" className="studio-remove" onClick={remove} disabled={busy}>Remove this item</button>}</div>
    <form className="studio-form" key={editingId||"new"} onSubmit={submit}>
        <div className="form-grid"><label>Title<input name="title" defaultValue={item?.title||""} required maxLength={180} /></label><label>Slug<input name="slug" defaultValue={item?.slug||""} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="your-content-title" /></label>
          <label>Content type<select name="type" value={selectedType} onChange={(event)=>setSelectedType(event.target.value)}>{eventManager?<option value="event">Event</option>:<><option value="podcast">Podcast</option><option value="video">Video</option><option value="resource">Resource</option><option value="printable">Printable</option><option value="article">Article</option><option value="event">Event</option><option value="original">Original</option></>}</select></label><label>Category<input name="category" defaultValue={item?.category||""} /></label>
        <label className="form-wide">Description<textarea name="description" rows={3} defaultValue={item?.description||""} /></label><label>Tags <span className="label-hint">Comma separated</span><input name="tags" defaultValue={item?.tags?.join(", ")||""} /></label><label>Publish date<input name="published_at" type="datetime-local" defaultValue={localDate(item?.published_at)} /></label>
        <label>Cover art URL<input name="cover_url" type="text" defaultValue={item?.cover_url||""} placeholder="https://… or uploaded artwork" /></label><label>Cover art upload<input name="cover_file" type="file" accept="image/*" /></label>{selectedType!=="video"&&selectedType!=="original"&&<label>External link<input name="external_url" type="url" defaultValue={item?.external_url||""} /></label>}{selectedType!=="event"&&<label>{selectedType==="video"||selectedType==="original"?"Video upload (protected for paid members)":selectedType==="podcast"?"Podcast audio upload":"PDF upload"}<input name="media_file" type="file" accept={selectedType==="video"||selectedType==="original"?"video/*":selectedType==="podcast"?"audio/*":"application/pdf"} /></label>}{selectedType==="video"||selectedType==="original"?<p className="studio-video-security-note form-wide">Upload the video file here. Its source is stored privately and served only to verified, signed-in paid members with an active Stripe plan.</p>:selectedType==="event"?<p className="studio-video-security-note form-wide">Add event artwork above. Use the external link field for registration.</p>:<label className="form-wide">Media URL<input name="media_url" type="text" defaultValue={item?.media_url||""} placeholder="https://… or uploaded media" /></label>}
        <label>Event location<input name="location" defaultValue={item?.location||""} /></label><label>Street address<input name="address" defaultValue={item?.address||""} /></label><label>Event start<input name="starts_at" type="datetime-local" defaultValue={localDate(item?.starts_at)} /></label><label>Event end<input name="ends_at" type="datetime-local" defaultValue={localDate(item?.ends_at)} /></label><label>Organizer<input name="organizer" defaultValue={item?.organizer||""} /></label><label>Capacity<input name="capacity" type="number" min="1" max="10000" defaultValue={item?.capacity||""} /></label><label className="form-wide">Ticket or registration information<textarea name="ticket_info" rows={2} defaultValue={item?.ticket_info||""} /></label>
        <label>Status<select name="status" defaultValue={item?.status==="archived"?"archived":item?.status||"draft"}><option value="draft">Save as draft</option><option value="published">Publish</option><option value="archived">Archive</option></select></label>
      </div>
      {message && <p className="form-success" role="status">{message}</p>}<div className="studio-form-actions"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Save content"}<span aria-hidden="true">↗</span></button>{item && <button type="button" className="button button-outline" onClick={()=>{setEditingId("");setSelectedType(eventManager?"event":"podcast");setMessage("");}} disabled={busy}>Cancel editing</button>}</div>
    </form>
  </div>;
}
