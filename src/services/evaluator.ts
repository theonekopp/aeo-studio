import { z } from 'zod'
import type { Observation, Query } from '@prisma/client'
import { chatJson } from './openrouter'

const baselineSchema = z.object({
  presence_score: z.number().int().min(0).max(3),
  prominence_score: z.number().int().min(0).max(3),
  persuasion_score: z.number().int().min(0).max(3),
  summary: z.string(),
  detected_brand_urls: z.array(z.string()).default([]),
  detected_competitors: z.array(z.string()).default([]),
})

export type BaselineScore = z.infer<typeof baselineSchema>

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === 'true' || s === 'yes' || s === 'y' || s === '1'
  }
  return false
}

function toIntRange(v: unknown, min: number, max: number): number {
  let n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) n = min
  n = Math.round(n)
  if (n < min) n = min
  if (n > max) n = max
  return n
}

function toConfidence(v: unknown): number {
  let n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) n = 0.7
  if (n > 1 && n <= 100) n = n / 100
  if (n < 0) n = 0
  if (n > 1) n = 1
  return n
}

const cfItem = z.object({
  lever: z.string(),
  description: z.string(),
  inclusion_after: z.any().transform(toBool),
  reason: z.string(),
  effort_score: z.any().transform((v) => toIntRange(v, 1, 5)),
  impact_score: z.any().transform((v) => toIntRange(v, 1, 5)),
  confidence: z.any().transform(toConfidence),
})

export type Counterfactual = z.infer<typeof cfItem>

// Accept various shapes and normalize to { items: Counterfactual[] }
const cfAnySchema = z.union([
  z.object({ items: z.array(cfItem).min(1) }),
  z.object({ counterfactuals: z.array(cfItem).min(1) }),
  z.array(cfItem).min(1),
])

const cfNormalizedSchema = cfAnySchema.transform((val) => {
  if (Array.isArray(val)) return { items: val }
  if ('items' in val) return { items: (val as any).items as z.infer<typeof cfItem>[] }
  if ('counterfactuals' in val) return { items: (val as any).counterfactuals as z.infer<typeof cfItem>[] }
  return { items: [] as z.infer<typeof cfItem>[] }
})

function buildBaselinePrompt(query: string, brandNames: string[], answerText: string) {
  const system = `You are an evaluator that scores brand inclusion in answer-engine outputs.
Return ONLY valid JSON (no markdown, no commentary) with fields: presence_score, prominence_score, persuasion_score, summary, detected_brand_urls, detected_competitors.
Scores are integers 0-3 with well-defined rubric. Be deterministic. No trailing commas.`
  const user = `Query: ${query}\nBrands of interest: ${brandNames.join(', ')}\nAnswer text:\n${answerText}`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

function buildCounterfactualPrompt(query: string, answerText: string) {
  const system = `You are an evaluator that tests only SEO/AEO-movable levers.
Allowed levers: Content coverage, Entity clarity, Evidence/authority, Geo specificity, Comparison/decision support, UX/answerability structure.
Return ONLY valid JSON (no markdown) with the shape: { "items": [ { "lever": string, "description": string, "inclusion_after": boolean, "reason": string, "effort_score": 1-5, "impact_score": 1-5, "confidence": 0-1 }, ... ] } with exactly 3 items. No trailing commas.`
  const user = `Query: ${query}\nAnswer text:\n${answerText}`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

export async function evaluateBaseline(
  observation: Observation,
  query: Query,
  brandNames: string[],
  model = process.env.EVALUATOR_MODEL || 'openai/gpt-4o-mini'
) {
  const answerText = observation.parsed_answer ?? JSON.stringify(observation.raw_answer)
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) {
    // Deterministic mock: hash length to spread 0-3
    const h = (query.text.length + answerText.length) % 4
    const presence = h
    const prominence = (h + 1) % 4
    const persuasion = (h + 2) % 4
    const total_score = presence + prominence + persuasion
    return {
      presence_score: presence,
      prominence_score: prominence,
      persuasion_score: persuasion,
      total_score,
      summary: 'Mock evaluation summary',
      detected_brand_urls: [],
      detected_competitors: [],
    }
  }

  const messages = buildBaselinePrompt(query.text, brandNames, answerText)
  const result = await chatJson(model, messages, baselineSchema, { retries: 2 })
  const total_score = result.presence_score + result.prominence_score + result.persuasion_score
  return { ...result, total_score }
}

export async function evaluateCounterfactuals(
  observation: Observation,
  queryText: string,
  model = process.env.EVALUATOR_MODEL || 'openai/gpt-4o-mini'
) {
  const answerText = observation.parsed_answer ?? JSON.stringify(observation.raw_answer)
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) {
    return [1, 2, 3].map((i) => ({
      lever: ['Entity clarity', 'Content coverage', 'UX/answerability structure'][i % 3],
      description: `Mock suggestion ${i} for improving inclusion`,
      inclusion_after: i % 2 === 0,
      reason: 'Mock rationale based on observed answer',
      effort_score: ((i + 1) % 5) + 1 > 5 ? 5 : ((i + 1) % 5) + 1,
      impact_score: ((i + 2) % 5) + 1 > 5 ? 5 : ((i + 2) % 5) + 1,
      confidence: 0.6 + i * 0.1 > 1 ? 0.9 : 0.6 + i * 0.1,
    }))
  }
  const messages = buildCounterfactualPrompt(queryText, answerText)
  const res = await chatJson<{ items: z.infer<typeof cfItem>[] }>(
    model,
    messages,
    cfNormalizedSchema as unknown as z.ZodType<{ items: z.infer<typeof cfItem>[] }>,
    { retries: 2 }
  )
  const { items } = res
  // If model returned fewer than 3 items, just return what's available; worker already slices to 3
  return items
}

// Brand Delta Extraction
const brandDeltaSchema = z.object({
  brand_missing_signals: z.array(z.string()).default([]),
  actionable_levers: z.array(z.object({
    lever: z.string(),
    recommendation: z.string(),
    effort_score: z.any().transform((v) => toIntRange(v, 1, 5)),
    impact_score: z.any().transform((v) => toIntRange(v, 1, 5)),
    confidence: z.any().transform(toConfidence),
  })).default([]),
  priority_actions: z.array(z.string()).default([]),
})

function buildBrandDeltaPrompt(
  brandName: string,
  query: string,
  baselineAnswer: string,
  cfItems: Counterfactual[]
) {
  const allowed = [
    'Content coverage',
    'Entity clarity',
    'Evidence/authority',
    'Geo specificity',
    'Comparison/decision support',
    'UX/answerability structure',
  ]
  const system = `You are an AEO expert.
Given a baseline answer (brand possibly excluded) and a set of counterfactual levers that would lead to inclusion, produce ONLY valid JSON (no markdown) describing the brand-specific deltas required.
Recommend only SEO/AEO/content changes (no pricing/ops/availability changes). No trailing commas.`
  const user = `Brand: ${brandName}
Query: ${query}
Allowed levers: ${allowed.join(', ')}

Baseline answer text:
${baselineAnswer}

Counterfactual levers (predicted to drive inclusion):
${cfItems.map((c, i) => `${i + 1}. [${c.lever}] ${c.description} (impact ${c.impact_score}/5, effort ${c.effort_score}/5)`).join('\n')}

Return JSON with keys brand_missing_signals (string[]), actionable_levers (array of { lever, recommendation, effort_score, impact_score, confidence }), and priority_actions (string[]).`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

export async function evaluateBrandDelta(
  brandName: string,
  queryText: string,
  baselineAnswer: string,
  cfItems: Counterfactual[],
  model = process.env.EVALUATOR_MODEL || 'openai/gpt-4o-mini'
) {
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) {
    return {
      brand_missing_signals: [`Structured FAQ addressing insurance for ${brandName}`],
      actionable_levers: [
        { lever: 'Entity clarity', recommendation: `Clarify ${brandName} insurance acceptance in a Q&A block`, effort_score: 2, impact_score: 4, confidence: 0.7 },
        { lever: 'Comparison/decision support', recommendation: `Add provider comparison table including ${brandName}`, effort_score: 3, impact_score: 5, confidence: 0.6 },
      ],
      priority_actions: [
        `Publish decision-support comparison including ${brandName}`,
        `Add structured Q&A on insurance and locations for ${brandName}`,
      ],
    }
  }
  const messages = buildBrandDeltaPrompt(brandName, queryText, baselineAnswer, cfItems)
  return await chatJson(model, messages, brandDeltaSchema, { retries: 2 })
}
