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

// Self-hosted OpenAI-compatible gateway (free-ai-gateway). Each provider
// writes Dari differently, so with "auto" Sitara's voice changed from one
// reply to the next. The model is pinned to "gemini" (the most natural
// Dari of the providers; groq and cohere drift into Iranian Persian) and
// "auto" is only used as a fallback when the pinned one fails or is rate
// limited. Override with AI_GATEWAY_MODEL. Avoid "zai" -- it's a reasoning
// model that burns max_tokens and returns empty content.
const DEFAULT_GATEWAY_URL = 'https://free-ai-gateway-gray.vercel.app/v1/chat/completions';
const DEFAULT_CHAT_MODEL = 'gemini';
const FALLBACK_CHAT_MODEL = 'auto';

async function requestCompletion(model: string, options: {
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
      model,
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

export async function createChatCompletion(options: {
  messages: ChatCompletionMessageParam[];
  temperature: number;
  max_tokens: number;
}): Promise<ChatCompletionResponse> {
  const model = process.env.AI_GATEWAY_MODEL || DEFAULT_CHAT_MODEL;

  try {
    return await requestCompletion(model, options);
  } catch (err) {
    if (model === FALLBACK_CHAT_MODEL) throw err;
    console.error(`AI gateway model "${model}" failed, falling back to "${FALLBACK_CHAT_MODEL}":`, (err as Error)?.message);
    return requestCompletion(FALLBACK_CHAT_MODEL, options);
  }
}
