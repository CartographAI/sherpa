export const API_BASE_URL = "http://localhost:3031";

export const modelConfig = [
  {
    provider: "Anthropic",
    models: [
      { name: "Claude 3.5 Sonnet", id: "claude-3-5-sonnet-20241022" },
      { name: "Claude 3.5 Haiku", id: "claude-3-5-haiku-20241022" },
    ],
  },
  {
    provider: "Gemini",
    models: [
      { name: "Gemini 2.0 Flash", id: "gemini-2.0-flash" },
      { name: "Gemini 2.0 Pro Experimental", id: "gemini-2.0-pro-exp-02-05" },
    ],
  },
  {
    provider: "OpenAI",
    models: [
      { name: "o3-mini", id: "o3-mini-2025-01-31" },
      { name: "gpt-4o", id: "gpt-4o-2024-11-20" },
    ],
  },
];

export const defaultModel = "claude-3-5-sonnet-20241022";

export function getNameForModelId(id: string) {
  if (!id) return undefined;
  for (const provider of modelConfig) {
    for (const model of provider.models) {
      if (model.id === id) {
        return model.name;
      }
    }
  }
  return undefined;
}

export function getProviderForModelId(id: string) {
  if (!id) return undefined;
  for (const provider of modelConfig) {
    for (const model of provider.models) {
      if (model.id === id) {
        return provider.provider;
      }
    }
  }
  return undefined;
}
