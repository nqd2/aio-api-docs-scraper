export type LlmProviderKind = "openai" | "anthropic" | "off";

export type LlmRuntimeConfig = {
  provider: LlmProviderKind;
  apiKey: string;
  model: string;
  baseUrl: string | undefined;
  jsonMode: boolean;
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function readLlmConfig(): LlmRuntimeConfig {
  const raw = (env("LLM_PROVIDER") || "off").toLowerCase();

  let provider: LlmProviderKind = "off";
  if (raw === "openai" || raw === "groq" || raw === "openrouter" || raw === "ollama" || raw === "custom") {
    provider = "openai";
  } else if (raw === "anthropic") {
    provider = "anthropic";
  } else if (raw !== "off" && raw !== "false" && raw !== "0") {
    provider = "openai";
  }

  const apiKey =
    env("LLM_API_KEY") ||
    env("OPENAI_API_KEY") ||
    (provider === "anthropic" ? env("ANTHROPIC_API_KEY") : undefined) ||
    "";

  const model =
    env("LLM_MODEL") ||
    (provider === "anthropic" ? "claude-3-5-sonnet-20241022" : "gpt-4o-mini");

  const baseUrl = env("LLM_BASE_URL");

  const jsonMode = env("LLM_JSON_MODE") !== "0" && env("LLM_JSON_MODE") !== "false";

  return { provider, apiKey, model, baseUrl, jsonMode };
}

export function assertLlmReady(cfg: LlmRuntimeConfig): void {
  if (cfg.provider === "off") {
    throw new Error(
      "LLM mode requires LLM_PROVIDER (e.g. openai, anthropic) and LLM_API_KEY (or OPENAI_API_KEY / ANTHROPIC_API_KEY).",
    );
  }
  if (!cfg.apiKey) {
    throw new Error("LLM_API_KEY (or provider-specific key env) is required for LLM mode.");
  }
}
