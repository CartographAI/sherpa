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
      { name: "Gemini 1.5 Flash 002", id: "gemini-1.5-flash-002" },
      { name: "Gemini 1.5 Pro 002", id: "gemini-1.5-pro-002" },
      { name: "Gemini 2.0 Flash Thinking Experimental 01-21", id: "gemini-2.0-flash-thinking-exp" },
      { name: "Gemini 2.0 Flash Experimental", id: "gemini-2.0-flash-exp" },
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
