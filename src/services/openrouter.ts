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
    return messages.map(m => m.content).join(' \n ').slice(0, opts?.max_tokens ?? 3000) || 'mock-answer'
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
      temperature: opts?.temperature ?? 0.5,
      max_tokens: opts?.max_tokens ?? 3000,
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
  opts?: { temperature?: number; max_tokens?: number; retries?: number; responseType?: 'object' | 'json' }
): Promise<T> {
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) {
    // Deterministic mock for local/dev
    const mock = { ok: true, mock: true, ts: Date.now() } as unknown as T
    return schema.parse(mock)
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const maxRetries = opts?.retries ?? 2
  let lastErr: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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
          // Only force json_object when callers expect an object. Arrays may be rejected otherwise.
          ...(opts?.responseType === 'object' ? { response_format: { type: 'json_object' } } : {}),
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`)
      }

      const data = await res.json() as any
      const content: string | undefined = data?.choices?.[0]?.message?.content
      if (!content) throw new Error('No content from OpenRouter')

      const parsed = safeParseJsonFromContent(content)
      return schema.parse(parsed)
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
        continue
      }
    }
  }
  logger.error({ error: String(lastErr) }, 'Failed to get/parse JSON after retries')
  throw lastErr
}

function safeParseJsonFromContent(content: string): unknown {
  // 1) Try direct JSON
  try { return JSON.parse(content) } catch {}
  // 2) Strip code fences if present
  const stripped = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
  try { return JSON.parse(stripped) } catch {}
  // 3) Attempt to extract first balanced JSON object
  const start = stripped.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in content')
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]
    if (inStr) {
      if (esc) { esc = false }
      else if (ch === '\\') { esc = true }
      else if (ch === '"') { inStr = false }
    } else {
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          const candidate = stripped.slice(start, i + 1)
          try { return JSON.parse(candidate) } catch (e) {
            logger.error({ candidate: candidate.slice(0, 300) }, 'JSON candidate parse failed')
            break
          }
        }
      }
    }
  }
  // 4) Give up, log and throw
  logger.error({ content: content.slice(0, 500) }, 'Failed to parse JSON content')
  throw new Error('Failed to parse JSON content')
}

export type { ChatMessage }
