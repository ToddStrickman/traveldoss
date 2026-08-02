import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GalleryImage } from "../../types";
import { PHOTO_ACCEPT, preparePhotoSet } from "./photo-prepare";

/** ~10-year read URL. Private bucket + signed URL keeps files owner-scoped
 *  while giving the dossier a stable src to render. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;
/** Generous because everything oversized is downscaled before upload. */
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB per picked file

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "photo";
}

/**
 * Upload machinery shared by every "add photo" affordance: the in-carousel
 * "+" tile, the empty-state panel, and drag-and-drop onto the gallery.
 * Uploads to `dossier-photos/{uid}/…` and appends signed URLs to the
 * persisted image order (user photos always precede sourced fallbacks
 * because fallbacks are render-time pads, never part of `images`).
 */
export function useDayPhotoUpload({
  images,
  onChange,
  label,
}: {
  images: GalleryImage[] | undefined;
  onChange: (next: GalleryImage[]) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = useCallback(() => inputRef.current?.click(), []);

  const onFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr || !authData.user) throw new Error("Please sign in to add photos.");
        const uid = authData.user.id;
        const list = Array.from(files).filter((f) => {
          const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
          if (!f.type.startsWith("image/") && !isPdf) {
            toast.error(`${f.name} isn't an image or PDF`);
            return false;
          }
          if (f.size > MAX_BYTES) {
            toast.error(`${f.name} is over 30 MB`);
            return false;
          }
          return true;
        });
        const added: GalleryImage[] = [];
        const signedUpload = async (file: File) => {
          const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
          const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slugify(file.name.replace(/\.[^.]+$/, ""))}.${ext}`;
          const up = await supabase.storage.from("dossier-photos").upload(path, file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: file.type || undefined,
          });
          if (up.error) throw new Error(up.error.message);
          const signed = await supabase.storage
            .from("dossier-photos")
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          if (signed.error || !signed.data?.signedUrl) {
            throw new Error(signed.error?.message ?? "Could not sign URL");
          }
          return signed.data.signedUrl;
        };
        for (const picked of list) {
          // Per-file: one unreadable pick must never discard the ones that worked.
          try {
            // Normalise first: PDFs become page-1 images, huge camera photos are
            // downscaled to a crisp 2560px long edge, HEIC/odd types re-encoded.
            // Then derive compressed responsive copies for display while the
            // full-quality master stays available for zoom/lightbox.
            const { full, variants } = await preparePhotoSet(picked);
            if (full.note) toast.info(full.note);
            const fullUrl = await signedUpload(full.file);
            const sources: { src: string; width: number }[] = [];
            for (const v of variants) {
              // Best-effort: a failed variant just means the master is served.
              try {
                sources.push({ src: await signedUpload(v.file), width: v.width });
              } catch {
                /* ignore */
              }
            }
            added.push({
              // Smallest usable copy is the default src; srcset upgrades it.
              src: sources[0]?.src ?? fullUrl,
              sources: sources.length > 0 ? sources : undefined,
              fullSrc: fullUrl,
              alt: `${label} — uploaded photo`,
            });
          } catch (fileErr) {
            const m = fileErr instanceof Error ? fileErr.message : `Couldn't add ${picked.name}`;
            toast.error(m);
          }
        }
        if (added.length > 0) {
          onChange([...(images ?? []), ...added]);
          toast.success(added.length === 1 ? "Photo added" : `${added.length} photos added`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [images, onChange, label],
  );

  /** Render once near the affordances; `pick()` opens it. */
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={PHOTO_ACCEPT}
      multiple
      className="tds-photo-uploader-input"
      onChange={(e) => onFiles(e.target.files)}
    />
  );

  return { busy, pick, onFiles, input };
}

/** Owner-only per-day photo picker button (empty-state / standalone use). */
export function DayPhotoUploader({
  images,
  onChange,
  dayLabel,
}: {
  images: GalleryImage[] | undefined;
  onChange: (next: GalleryImage[]) => void;
  dayLabel: string;
}) {
  const { busy, pick, input } = useDayPhotoUpload({ images, onChange, label: dayLabel });
  return (
    <div className="tds-photo-uploader" data-print="hide">
      <button
        type="button"
        className="tds-photo-uploader-btn tap"
        onClick={pick}
        disabled={busy}
        aria-label={`Add photos to ${dayLabel}`}
      >
        {busy ? (
          <Loader2 size={14} aria-hidden className="tds-photo-uploader-spin" />
        ) : (
          <ImagePlus size={14} aria-hidden />
        )}
        <span>{busy ? "Uploading…" : "Add photo"}</span>
      </button>
      {input}
    </div>
  );
}
