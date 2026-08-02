/**
 * Turn whatever the user picked (JPEG/PNG/WebP/HEIC/AVIF/GIF or a PDF) into a
 * web-renderable image file that stays sharp but is sized sensibly for the
 * dossier. Big camera photos are downscaled to a 2560px long edge — enough
 * detail for the fullscreen viewer on a retina laptop, small enough to load
 * fast on a phone. PDFs are rasterised at page 1.
 */
const MAX_EDGE = 2560;
const QUALITY = 0.92;

export type PreparedFile = { file: File; note?: string };

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

async function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Could not process that image");
  return new File([blob], `${baseName(name)}.jpg`, { type: "image/jpeg" });
}

function fitted(w: number, h: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scale };
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decode */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("unsupported"));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke after the bitmap is painted below; a microtask is enough because
    // decode already completed.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function prepareRaster(file: File): Promise<PreparedFile> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decodeImage(file);
  } catch {
    throw new Error(
      `${file.name} can't be read by this browser. Convert it to JPEG or PNG and try again.`,
    );
  }
  const w = "width" in source ? source.width : 0;
  const h = "height" in source ? source.height : 0;
  const { w: tw, h: th, scale } = fitted(w, h);
  // Already small and already a web format → upload untouched (no re-encode,
  // no generational quality loss).
  if (scale === 1 && /^image\/(jpeg|png|webp|avif)$/.test(file.type)) return { file };
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, tw, th);
  return { file: await canvasToFile(canvas, file.name) };
}

async function preparePdf(file: File): Promise<PreparedFile> {
  // Legacy build + a bundled worker URL: widest browser support, no CDN.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, MAX_EDGE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not render that PDF");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const out = await canvasToFile(canvas, file.name);
  return {
    file: out,
    note: doc.numPages > 1 ? `${file.name}: added page 1 of ${doc.numPages}` : undefined,
  };
}

/** Accept-list for the file input: images plus PDF. */
export const PHOTO_ACCEPT = "image/*,.heic,.heif,application/pdf,.pdf";

export async function preparePhotoFile(file: File): Promise<PreparedFile> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return preparePdf(file);
  return prepareRaster(file);
}
