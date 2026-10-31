// server/utils/aiGateway.ts

export type ChatCompletionMessageParam = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export class AIGatewayError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AIGatewayError';
    this.status = status;
    this.code = code;
  }
}

// Self-hosted OpenAI-compatible gateway (free-ai-gateway). With model
// "auto" it picks a provider (Gemini first) and fails over to the next
// one on errors/rate limits -- even a pinned provider ("gemini") fails
// over the same way, so pinning doesn't avoid the free-plan limit. When
// Gemini is limited, replies come from groq's gpt-oss, which writes
// Iranian Persian rather than Kabuli Dari. A specific provider can be
// pinned via AI_GATEWAY_MODEL (gemini, groq, cohere, ...). Avoid "zai" --
// it's a reasoning model that burns max_tokens and returns empty content.
const DEFAULT_GATEWAY_URL = 'https://free-ai-gateway-gray.vercel.app/v1/chat/completions';
const DEFAULT_CHAT_MODEL = 'auto';

export async function createChatCompletion(options: {
  messages: ChatCompletionMessageParam[];
  temperature: number;
  max_tokens: number;
}): Promise<ChatCompletionResponse> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new AIGatewayError('AI_GATEWAY_API_KEY is not configured');
  }

  const response = await fetch(process.env.AI_GATEWAY_URL || DEFAULT_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AI_GATEWAY_MODEL || DEFAULT_CHAT_MODEL,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AIGatewayError(
      body?.error?.message || `AI gateway request failed with status ${response.status}`,
      response.status,
      body?.error?.code,
    );
  }

  return body as ChatCompletionResponse;
}
