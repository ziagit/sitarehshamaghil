// server/utils/aiGateway.ts
//
// Every model call (chat and comment replies, check-ins, summaries, intent
// checks, page posts) goes through createChatCompletion, which calls
// Claude with ANTHROPIC_API_KEY. If that fails (no key, API down, rate
// limit, or a request Claude declines even after its fallback model), the
// same request goes to the self-hosted free gateway (AI_GATEWAY_API_KEY)
// instead. It keeps the chat-completions shape the callers were written
// for (a messages list with role "system" notes, and
// choices[0].message.content back), so they don't need to know which
// model answered.
//
// Claude Opus 5.5 always thinks before answering, and thinking counts
// toward max_tokens: callers pass the length they want for the reply
// itself, and THINKING_HEADROOM is added on top so the reply isn't cut
// short. Short replies are still enforced by the prompts and limitLength.
// It doesn't take temperature (the API rejects it), so callers don't send it.
//
// The gateway is OpenAI-compatible. With model "auto" it picks a provider
// (Gemini first) and fails over on errors/rate limits; when Gemini is
// limited, replies come from groq's gpt-oss, which writes Iranian Persian
// rather than Kabuli Dari. AI_GATEWAY_MODEL can pin one (gemini, groq,
// cohere, ...). Avoid "zai" -- it's a reasoning model that burns
// max_tokens and returns empty content.

import Anthropic from '@anthropic-ai/sdk';

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

// ANTHROPIC_MODEL overrides it (e.g. claude-haiku-5-5 to cut costs).
const DEFAULT_MODEL = 'claude-opus-5-5';

const THINKING_HEADROOM = 2048;

const REQUEST_TIMEOUT_MS = 60000;

const DEFAULT_GATEWAY_URL = 'https://free-ai-gateway-gray.vercel.app/v1/chat/completions';
const DEFAULT_GATEWAY_MODEL = 'auto';

// gpt-oss spends ~100 tokens reasoning before it answers and returns empty
// content if it runs out, so short requests get at least this much.
const MIN_GATEWAY_TOKENS = 300;

let client: Anthropic | null = null;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIGatewayError('ANTHROPIC_API_KEY is not configured');
  }
  client ??= new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

// Leading system messages become the system prompt. Ones after the last
// user message (notes like the crisis note or a retry nudge) stay where
// they are, as mid-conversation system messages, so they keep outweighing
// the style rules. Claude only allows those right after a user turn, and a
// request can't end on Sitara's own turn, so after one of hers (check-ins)
// they are sent as a user turn instead.
function toClaudeRequest(messages: ChatCompletionMessageParam[]) {
  const firstTurn = messages.findIndex((message) => message.role !== 'system');
  const start = firstTurn === -1 ? messages.length : firstTurn;
  const system = messages.slice(0, start).map((message) => message.content);

  const rest = messages.slice(start);
  const lastTurn = rest.findLastIndex((message) => message.role !== 'system');
  const conversation = rest.slice(0, lastTurn + 1);
  const notes = rest.slice(lastTurn + 1).map((message) => message.content);

  const turns: Anthropic.Beta.BetaMessageParam[] = [];
  for (const message of conversation) {
    if (message.role === 'system') {
      system.push(message.content);
      continue;
    }
    // The conversation has to start with the user (older turns may have
    // been trimmed off the front).
    if (turns.length === 0 && message.role === 'assistant') continue;
    turns.push({ role: message.role, content: message.content });
  }

  const lastRole = turns[turns.length - 1]?.role;
  if (notes.length > 0 && lastRole === 'user') {
    for (const note of notes) turns.push({ role: 'system', content: note });
  } else if (notes.length > 0) {
    turns.push({ role: 'user', content: `[Note from the page, not from the person you're talking to]\n${notes.join('\n\n')}` });
  }

  return { system: system.join('\n\n'), messages: turns };
}

type CompletionOptions = {
  messages: ChatCompletionMessageParam[];
  max_tokens: number;
  // How hard Claude thinks first. Chat stays at low: replies are one or two
  // sentences, and more thinking only adds delay.
  effort?: 'low' | 'medium' | 'high';
};

async function createClaudeCompletion(options: CompletionOptions): Promise<ChatCompletionResponse> {
  const { system, messages } = toClaudeRequest(options.messages);

  try {
    const response = await getClient().beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: options.max_tokens + THINKING_HEADROOM,
      ...(system ? { system } : {}),
      messages,
      output_config: { effort: options.effort || 'low' },
      // A request Claude's safety checks decline is re-run on a fallback
      // model inside the same call, instead of leaving the person with no
      // reply (people here talk about self-harm and abuse).
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (response.stop_reason === 'refusal') {
      throw new AIGatewayError('Claude declined the request');
    }

    const content = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();
    return { choices: [{ message: { content } }] };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new AIGatewayError(err.message, err.status, err.status === 429 ? 'rate_limit_exceeded' : undefined);
    }
    throw err;
  }
}

async function createGatewayCompletion(options: CompletionOptions): Promise<ChatCompletionResponse> {
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
      model: process.env.AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL,
      messages: options.messages,
      max_tokens: Math.max(options.max_tokens, MIN_GATEWAY_TOKENS),
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

export async function createChatCompletion(options: CompletionOptions): Promise<ChatCompletionResponse> {
  try {
    return await createClaudeCompletion(options);
  } catch (claudeError: any) {
    console.error('Claude error, using the free gateway:', claudeError?.status || '', claudeError?.message);
    // If both fail, callers see the gateway's error (a 429 there still
    // counts as a rate limit for the fallback replies).
    return await createGatewayCompletion(options);
  }
}
