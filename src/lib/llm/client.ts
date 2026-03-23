import type { LlmRuntimeConfig } from "./config";

export async function completeLlm(
  cfg: LlmRuntimeConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (cfg.provider === "anthropic") {
    return anthropicComplete(cfg, systemPrompt, userPrompt);
  }
  return openAiCompatibleComplete(cfg, systemPrompt, userPrompt);
}

async function openAiCompatibleComplete(
  cfg: LlmRuntimeConfig,
  system: string,
  user: string,
): Promise<string> {
  const base = (cfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  };
  if (cfg.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("LLM response missing choices[0].message.content");
  }
  return text;
}

async function anthropicComplete(
  cfg: LlmRuntimeConfig,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const block = data.content?.find((c) => c.type === "text");
  if (!block?.text) {
    throw new Error("Anthropic response missing text block");
  }
  return block.text;
}
