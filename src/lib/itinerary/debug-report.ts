import type { ZodIssue } from "zod";

/**
 * Diagnostic record produced by the AI parser / generator whenever a
 * model response fails JSON or schema validation. Bundled into the
 * server response so the client can offer a one-click JSON download.
 */
export type DebugAttempt = {
  attempt: number;
  rawResponse: string;
  parsedJson?: unknown;
  jsonParseError?: string;
  zodIssues?: ZodIssue[];
  zodIssueSummary?: string;
  threwError?: string;
};

export type DebugOutcome =
  | "success-after-retry"
  | "local-fallback"
  | "raw-fallback"
  | "thrown";

export type DebugReport = {
  source: "parse-ai" | "generate";
  createdAt: string;
  model: string;
  outcome: DebugOutcome;
  attempts: DebugAttempt[];
  /** What the caller ultimately returned to the user. */
  finalParsed?: unknown;
  /** Last terminal error message, if outcome === "thrown". */
  finalError?: string;
};

/**
 * Storage ceiling for a persisted report. Reports used to be written straight
 * from `z.any()` with no bound: each retry carried the full raw model
 * response, so one bad multi-day parse persisted 100-150 KB, forever. These
 * limits keep the diagnostic value (the first attempts, the head of each raw
 * response, the summary fields) while bounding the row.
 */
export const DEBUG_REPORT_LIMITS = {
  maxAttempts: 5,
  maxRawResponseChars: 8_000,
  maxTotalChars: 200_000,
} as const;

/**
 * Returns a copy of `report` that fits `DEBUG_REPORT_LIMITS`. Order of cuts,
 * least valuable first: extra attempts, the tail of each raw response, then
 * (only if still over budget) parsed payloads, which are re-derivable from
 * the raw text. Never mutates its input.
 */
export function capDebugReport(
  report: DebugReport,
  limits: typeof DEBUG_REPORT_LIMITS = DEBUG_REPORT_LIMITS,
): DebugReport {
  const attempts = (report.attempts ?? []).slice(0, limits.maxAttempts).map((a) => {
    const raw = a.rawResponse ?? "";
    if (raw.length <= limits.maxRawResponseChars) return { ...a };
    const over = raw.length - limits.maxRawResponseChars;
    return {
      ...a,
      rawResponse: `${raw.slice(0, limits.maxRawResponseChars)}\n…[truncated ${over} chars]`,
    };
  });
  let out: DebugReport = { ...report, attempts };
  const size = (r: DebugReport) => JSON.stringify(r).length;
  if (size(out) <= limits.maxTotalChars) return out;

  out = {
    ...out,
    attempts: out.attempts.map((a) => {
      const copy = { ...a };
      delete copy.parsedJson;
      return copy;
    }),
  };
  if (size(out) <= limits.maxTotalChars) return out;

  const trimmed = { ...out };
  delete trimmed.finalParsed;
  return trimmed;
}

/**
 * Browser-side download trigger. Serializes the report and forces a
 * `traveldoss-debug-<timestamp>.json` save dialog.
 */
export function downloadDebugReport(report: DebugReport): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = report.createdAt.replace(/[:.]/g, "-");
  a.href = url;
  a.download = `traveldoss-debug-${report.source}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}