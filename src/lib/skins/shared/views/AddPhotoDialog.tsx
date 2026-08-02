import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ImagePlus, Link2, Loader2, Upload } from "lucide-react";
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
  // dragenter/dragleave fire per child element; count depth so moving over
  // inner text doesn't flicker the highlight off.
  const dragDepth = useRef(0);
  const beginDrag = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDropping(true);
  }, []);
  const endDrag = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropping(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // The host carousel has its own drop handler; without this the same
      // drop uploads every file twice.
      e.stopPropagation();
      dragDepth.current = 0;
      setDropping(false);
      uploader.clearFailures();
      void uploader.onFiles(e.dataTransfer?.files ?? null);
    },
    [uploader],
  );

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

  // Close once an upload lands so the user sees their photo in the carousel —
  // unless something failed, in which case the reasons stay on screen.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !uploader.busy && uploader.failures.length === 0) onClose();
    wasBusy.current = uploader.busy;
  }, [uploader.busy, uploader.failures.length, onClose]);

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

  // Escapes to <body>: the carousel's Cover Flow stage (transform/will-change
  // ancestors) otherwise turns `position: fixed` into an offscreen panel, so
  // clicking "Add photo" looked like nothing happened.
  const dialog = (
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
        onDragEnter={beginDrag}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={endDrag}
        onDrop={handleDrop}
      >
        <p className="tds-addphoto-title">Add a photo</p>
        <p className="tds-addphoto-target">{targetLabel}</p>

        {/* One affordance, both gestures: tap/click opens the native picker
            (camera or library on phones), drag-and-drop lands files straight
            in. The <button> keeps it keyboard- and screen-reader-operable. */}
        <button
          type="button"
          className="tds-addphoto-dropzone tap"
          data-dropping={dropping || undefined}
          onClick={() => { uploader.clearFailures(); uploader.pick(); }}
          disabled={uploader.busy}
        >
          <span className="tds-addphoto-dropzone-icon" aria-hidden>
            {uploader.busy
              ? <Loader2 size={22} className="tds-photo-uploader-spin" />
              : dropping
                ? <Upload size={22} />
                : <ImagePlus size={22} />}
          </span>
          <span className="tds-addphoto-dropzone-main">
            {uploader.busy
              ? "Uploading…"
              : dropping
                ? "Drop to upload"
                : "Tap to choose photos"}
          </span>
          <span className="tds-addphoto-dropzone-sub">
            {dropping ? "Release anywhere in this panel" : "or drag files here — JPEG, PNG, HEIC, WebP or PDF"}
          </span>
        </button>

        {/* Crop/fit choice, applied before upload so the crop is identical on
            every device instead of being decided by object-fit per viewport. */}
        <div className="tds-addphoto-fit" role="radiogroup" aria-label="How photos fit the frame">
          <button
            type="button"
            role="radio"
            aria-checked={uploader.fit === "frame"}
            className="tds-addphoto-fitopt tap"
            onClick={() => uploader.chooseFit("frame")}
            disabled={uploader.busy}
          >
            <Crop size={13} aria-hidden />
            <span>Fill the frame</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={uploader.fit === "original"}
            className="tds-addphoto-fitopt tap"
            onClick={() => uploader.chooseFit("original")}
            disabled={uploader.busy}
          >
            <Maximize2 size={13} aria-hidden />
            <span>Keep whole photo</span>
          </button>
        </div>
        <p className="tds-addphoto-fithint">
          {uploader.fit === "frame"
            ? "Centre-cropped to the carousel window, so it looks the same on phone and desktop."
            : "Uploaded uncropped — tall or wide photos may show edges trimmed in the carousel."}
        </p>

        {uploader.progress && (
          <div className="tds-addphoto-progress" role="status" aria-live="polite">
            <div className="tds-addphoto-progress-head">
              <span className="tds-addphoto-progress-label">
                {uploader.progress.phase === "preparing"
                  ? "Preparing"
                  : uploader.progress.phase === "uploading"
                    ? "Uploading"
                    : "Finishing"}{" "}
                {uploader.progress.fileName}
                {uploader.progress.total > 1
                  ? ` (${uploader.progress.index} of ${uploader.progress.total})`
                  : ""}
              </span>
              <span className="tds-addphoto-progress-pct">{uploader.progress.pct}%</span>
            </div>
            <div
              className="tds-addphoto-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploader.progress.pct}
              aria-label="Upload progress"
            >
              <div className="tds-addphoto-progress-bar" style={{ width: `${uploader.progress.pct}%` }} />
            </div>
          </div>
        )}

        {uploader.failures.length > 0 && (
          <div className="tds-addphoto-errors" role="alert">
            <p className="tds-addphoto-errors-title">
              <AlertCircle size={14} aria-hidden />
              <span>
                {uploader.failures.length === 1
                  ? "One file couldn't be added"
                  : `${uploader.failures.length} files couldn't be added`}
              </span>
            </p>
            <ul className="tds-addphoto-errors-list">
              {uploader.failures.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <strong>{f.name}</strong> — {f.reason}
                </li>
              ))}
            </ul>
            <button type="button" className="tds-addphoto-errors-dismiss tap" onClick={uploader.clearFailures}>
              Dismiss
            </button>
          </div>
        )}

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

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
