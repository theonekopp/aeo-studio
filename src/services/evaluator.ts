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

const cfItem = z.object({
  lever: z.string(),
  description: z.string(),
  inclusion_after: z.boolean(),
  reason: z.string(),
  effort_score: z.number().int().min(1).max(5),
  impact_score: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
})

export type Counterfactual = z.infer<typeof cfItem>

const cfSchema = z.object({ items: z.array(cfItem).min(3) })

function buildBaselinePrompt(query: string, brandNames: string[], answerText: string) {
  const system = `You are an evaluator that scores brand inclusion in answer-engine outputs.
Return strict JSON with fields: presence_score, prominence_score, persuasion_score, summary, detected_brand_urls, detected_competitors.
Scores are integers 0-3 with well-defined rubric. Be deterministic.`
  const user = `Query: ${query}\nBrands of interest: ${brandNames.join(', ')}\nAnswer text:\n${answerText}`
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

function buildCounterfactualPrompt(query: string, answerText: string) {
  const system = `You are an evaluator that tests only SEO/AEO-movable levers.
Allowed levers: Content coverage, Entity clarity, Evidence/authority, Geo specificity, Comparison/decision support, UX/answerability structure.
Return JSON with { items: Counterfactual[] } with 3 items, each including lever, description, inclusion_after, reason, effort_score (1-5), impact_score (1-5), confidence (0-1).`
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
  model = 'openrouter/anthropic/claude-3.5-sonnet'
) {
  const answerText = observation.parsed_answer ?? JSON.stringify(observation.raw_answer)
  const messages = buildBaselinePrompt(query.text, brandNames, answerText)
  const result = await chatJson(model, messages, baselineSchema)
  const total_score =
    result.presence_score + result.prominence_score + result.persuasion_score
  return { ...result, total_score }
}

export async function evaluateCounterfactuals(
  observation: Observation,
  queryText: string,
  model = 'openrouter/anthropic/claude-3.5-sonnet'
) {
  const answerText = observation.parsed_answer ?? JSON.stringify(observation.raw_answer)
  const messages = buildCounterfactualPrompt(queryText, answerText)
  const { items } = await chatJson(model, messages, cfSchema)
  return items
}
