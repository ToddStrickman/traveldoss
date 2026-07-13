/**
 * .vtt / .srt intake cleaning. The upload tab has advertised these formats
 * since launch, but nothing ever stripped cue machinery — WEBVTT headers,
 * cue indices, and "00:01:02.000 --> 00:01:05.000" lines went straight into
 * the parser, where the offline path happily turned timestamps into "place"
 * blocks. These helpers reduce a subtitle file to its spoken text.
 */

const TIMESTAMP =
  /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}/;

/** Cheap detection: extension first, then content shape. */
export function looksLikeTranscript(raw: string, filename = ""): boolean {
  if (/\.(vtt|srt)$/i.test(filename)) return true;
  const head = raw.slice(0, 2000);
  if (/^WEBVTT/m.test(head)) return true;
  return head.split(/\r?\n/).some((l) => TIMESTAMP.test(l));
}

/** Strip cue indices, timestamps, headers, and tags; keep the words. */
export function stripTranscriptCues(raw: string): string {
  const out: string[] = [];
  let lastLine = "";
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) {
      if (out[out.length - 1] !== "") out.push("");
      continue;
    }
    if (/^WEBVTT/.test(l)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(l)) continue;
    if (TIMESTAMP.test(l)) continue;
    if (/^\d+$/.test(l)) continue; // SRT cue index
    const text = l.replace(/<[^>]+>/g, "").trim(); // <v Name>, <i>, …
    if (!text) continue;
    // Rolling captions repeat the previous line — keep one.
    if (text === lastLine) continue;
    lastLine = text;
    out.push(text);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
