const endpoint = "https://api.minimaxi.com/anthropic/v1/messages";
const model = process.env.MINIMAX_MODEL || "MiniMax-M3";

export async function askMiniMax({ system, messages, maxTokens = 420 }) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MiniMax server environment is not configured");

  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(45000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.base_resp?.status_msg || `HTTP ${response.status}`;
    throw new Error(`MiniMax request failed: ${message}`);
  }

  const answer = payload.content?.find((item) => item.type === "text")?.text?.trim();
  if (!answer) throw new Error("MiniMax returned no text content");
  return {
    answer,
    model: payload.model || model,
    usage: payload.usage || {},
    latencyMs: Date.now() - startedAt,
  };
}
