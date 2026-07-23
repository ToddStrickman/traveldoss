import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GalleryImage } from "../../types";
import type { useDayPhotoUpload } from "./DayPhotoUploader";

/**
 * The "add a photo" screen behind every Add Photo affordance: upload from
 * the device (camera/library on mobile via the native picker), paste or
 * type an image address, paste an image directly from the clipboard, or
 * drop a file. One dialog, both inputs — so the affordances can stay tiny.
 */
export function AddPhotoDialog({
  open,
  onClose,
  uploader,
  images,
  onImagesChange,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  uploader: ReturnType<typeof useDayPhotoUpload>;
  images: GalleryImage[] | undefined;
  onImagesChange: (next: GalleryImage[]) => void;
  targetLabel: string;
}) {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [dropping, setDropping] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    // Paste an image (the actual bitmap, e.g. a screenshot) anywhere while
    // the dialog is open and it uploads like a picked file.
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        void uploader.onFiles(files);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("paste", onPaste);
    };
  }, [open, onClose, uploader]);

  // Close once an upload lands so the user sees their photo in the carousel.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !uploader.busy) onClose();
    wasBusy.current = uploader.busy;
  }, [uploader.busy, onClose]);

  const addFromUrl = useCallback(async () => {
    const candidate = url.trim();
    if (!candidate) return;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    } catch {
      toast.error("That doesn't look like a web address", {
        description: "Paste a full image link, starting with https://",
      });
      return;
    }
    setChecking(true);
    // Confirm the URL actually renders as an image before committing it to
    // the dossier — a dead link would become a permanent broken slide.
    const ok = await new Promise<boolean>((resolve) => {
      const probe = new Image();
      const timer = window.setTimeout(() => resolve(false), 8000);
      probe.onload = () => { window.clearTimeout(timer); resolve(true); };
      probe.onerror = () => { window.clearTimeout(timer); resolve(false); };
      probe.src = parsed.toString();
    });
    setChecking(false);
    if (!ok) {
      toast.error("Couldn't load that image", {
        description: "Check the link opens an image directly, then try again.",
      });
      return;
    }
    onImagesChange([...(images ?? []), { src: parsed.toString(), alt: `${targetLabel} — added photo` }]);
    toast.success("Photo added");
    setUrl("");
    onClose();
  }, [url, images, onImagesChange, targetLabel, onClose]);

  if (!open) return null;

  return (
    <div
      className="tds-addphoto-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`Add a photo to ${targetLabel}`}
      data-print="hide"
      onClick={(e) => {
        // Never bubble into the host (activity rows open a sheet on click).
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="tds-addphoto-panel"
        data-dropping={dropping || undefined}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDropping(true); }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          void uploader.onFiles(e.dataTransfer?.files ?? null);
        }}
      >
        <p className="tds-addphoto-title">Add a photo</p>
        <p className="tds-addphoto-target">{targetLabel}</p>

        <button
          type="button"
          className="tds-addphoto-upload tap"
          onClick={uploader.pick}
          disabled={uploader.busy}
        >
          {uploader.busy
            ? <Loader2 size={16} aria-hidden className="tds-photo-uploader-spin" />
            : <ImagePlus size={16} aria-hidden />}
          <span>{uploader.busy ? "Uploading…" : "Upload from device"}</span>
        </button>

        <div className="tds-addphoto-divider" aria-hidden><span>or paste a link</span></div>

        <form
          className="tds-addphoto-urlrow"
          onSubmit={(e) => { e.preventDefault(); void addFromUrl(); }}
        >
          <Link2 size={14} aria-hidden className="tds-addphoto-urlicon" />
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… image address"
            aria-label="Image address"
            className="tds-addphoto-urlinput"
          />
          <button
            type="submit"
            className="tds-addphoto-urladd tap"
            disabled={!url.trim() || checking}
          >
            {checking ? "Checking…" : "Add"}
          </button>
        </form>

        <p className="tds-addphoto-hint">
          You can also paste an image straight from your clipboard, or drop a file here.
        </p>

        <button type="button" className="tds-addphoto-cancel tap" onClick={onClose}>
          Cancel
        </button>
        {/* The host renders uploader.input (it must exist exactly once). */}
      </div>
    </div>
  );
}
