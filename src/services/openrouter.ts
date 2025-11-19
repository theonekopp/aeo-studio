import { z } from 'zod'
import { logger } from '../logger'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chatText(
  model: string,
  messages: ChatMessage[],
  opts?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) {
    return messages.map(m => m.content).join(' \n ').slice(0, opts?.max_tokens ?? 800) || 'mock-answer'
  }
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://railway.app',
      'X-Title': 'AEO Counterfactual Impact Lab',
    },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0,
      max_tokens: opts?.max_tokens ?? 700,
      messages,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error({ status: res.status, text }, 'OpenRouter error')
    throw new Error(`OpenRouter error ${res.status}`)
  }
  const data = await res.json() as any
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('No content from OpenRouter')
  return content
}

export async function chatJson<T>(
  model: string,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts?: { temperature?: number; max_tokens?: number }
): Promise<T> {
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) {
    // Deterministic mock for local/dev
    const mock = { ok: true, mock: true, ts: Date.now() } as unknown as T
    return schema.parse(mock)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://railway.app',
      'X-Title': 'AEO Counterfactual Impact Lab',
    },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0,
      max_tokens: opts?.max_tokens ?? 800,
      messages,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error({ status: res.status, text }, 'OpenRouter error')
    throw new Error(`OpenRouter error ${res.status}`)
  }

  const data = await res.json() as any
  const content: string | undefined = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('No content from OpenRouter')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    logger.error({ content }, 'Failed to parse JSON content')
    throw e
  }
  return schema.parse(parsed)
}

export type { ChatMessage }
