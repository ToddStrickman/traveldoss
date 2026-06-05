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