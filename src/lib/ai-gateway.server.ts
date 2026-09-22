import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let resolved = false;
  const ready = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });
  const publish = (value?: string) => {
    if (!runId && value?.trim()) runId = value.trim();
    if (!resolved) {
      resolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publish(runId);

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
      try {
        const response = await fetch(input, { ...init, headers });
        publish(response.headers.get(RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publish();
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : ready),
  };
}

/**
 * Lovable AI Gateway provider helper. Server-only — reads LOVABLE_API_KEY
 * from process.env and routes all calls through the gateway so we don't
 * couple the app to any single upstream provider.
 */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export class LovableAiResponseError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function streamLovableJsonResponse<T>({
  apiKey,
  input,
  instructions,
  schemaName,
  schema,
  reasoningEffort = "medium",
}: {
  apiKey: string;
  input: string;
  instructions: string;
  schemaName: string;
  schema: Record<string, unknown>;
  reasoningEffort?: "low" | "medium" | "high";
}): Promise<{ value: T; runId?: string }> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input,
      instructions,
      stream: true,
      store: false,
      reasoning: { effort: reasoningEffort, summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
  });
  const runId = response.headers.get(RUN_ID_HEADER) ?? undefined;
  if (!response.ok) {
    const message = (await response.text()).slice(0, 600) || `AI request failed (${response.status})`;
    throw new LovableAiResponseError(response.status, message);
  }
  if (!response.body) throw new LovableAiResponseError(502, "AI response stream was empty.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let completed = false;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let event: { type?: string; delta?: string; error?: { message?: string } };
      try {
        event = JSON.parse(line.slice(6)) as typeof event;
      } catch {
        continue;
      }
      if (event.type === "response.output_text.delta") output += event.delta ?? "";
      if (event.type === "response.completed") completed = true;
      if (event.type === "response.failed" || event.type === "error") {
        throw new LovableAiResponseError(502, event.error?.message ?? "AI response failed.");
      }
    }
  }
  if (!completed) throw new LovableAiResponseError(502, "AI response ended before completion.");
  if (!output.trim()) throw new LovableAiResponseError(502, "AI response completed without an answer.");
  try {
    return { value: JSON.parse(output) as T, runId };
  } catch {
    throw new LovableAiResponseError(502, "AI response was not valid JSON.");
  }
}