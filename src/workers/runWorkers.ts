import { prisma } from '../db/client'
import { evaluateBaseline, evaluateCounterfactuals } from '../services/evaluator'
import { logger } from '../logger'
import { chatText } from '../services/openrouter'

const BRAND_NAMES = (process.env.BRAND_NAMES || '').split(',').map(s => s.trim()).filter(Boolean)

export async function captureRun(runId: string) {
  const queries = await prisma.query.findMany()
  const engines = await prisma.engine.findMany()
  for (const q of queries) {
    for (const e of engines) {
      try {
        // LLM capture via OpenRouter
        const model = selectModelForEngine(e.name)
        const messages = buildAnswerPrompt(q.text, e.name)
        const answer = await chatText(model, messages, { temperature: 0.2, max_tokens: 600 })
        const raw_answer: any = { engine: e.name, model, content: answer }
        const parsed_answer: string | null = answer
        await prisma.observation.create({
          data: {
            runId,
            queryId: q.id,
            engineId: e.id,
            raw_answer,
            parsed_answer: parsed_answer ?? undefined,
          },
        })
      } catch (err) {
        logger.error({ err, q: q.text, engine: e.name }, 'capture failure')
      }
    }
  }
}

export async function scoreRun(runId: string) {
  const observations = await prisma.observation.findMany({ where: { runId } })
  for (const obs of observations) {
    try {
      const query = await prisma.query.findUnique({ where: { id: obs.queryId } })
      if (!query) continue
      const s = await evaluateBaseline(obs, query, BRAND_NAMES)
      await prisma.score.create({
        data: {
          observationId: obs.id,
          presence_score: s.presence_score,
          prominence_score: s.prominence_score,
          persuasion_score: s.persuasion_score,
          total_score: s.total_score,
          summary: s.summary,
          detected_brand_urls: s.detected_brand_urls,
          detected_competitors: s.detected_competitors,
        },
      })
    } catch (err) {
      logger.error({ err, obsId: obs.id }, 'scoring failure')
    }
  }
}

export async function counterfactualRun(runId: string) {
  const observations = await prisma.observation.findMany({ where: { runId } })
  for (const obs of observations) {
    try {
      const query = await prisma.query.findUnique({ where: { id: obs.queryId } })
      const items = await evaluateCounterfactuals(obs, query?.text || 'Unknown query')
      for (const it of items.slice(0, 3)) {
        await prisma.counterfactual.create({
          data: {
            observationId: obs.id,
            lever: it.lever,
            description: it.description,
            inclusion_after: it.inclusion_after,
            reason: it.reason,
            effort_score: it.effort_score,
            impact_score: it.impact_score,
            confidence: it.confidence,
          },
        })
      }
    } catch (err) {
      logger.error({ err, obsId: obs.id }, 'counterfactual failure')
    }
  }
}

function selectModelForEngine(engineName: string): string {
  const useMocks = process.env.USE_MOCKS === 'true'
  if (useMocks) return 'mock-model'
  if (engineName.toLowerCase() === 'chatgpt') {
    return process.env.CHATGPT_MODEL || 'openai/gpt-4o-mini'
  }
  if (engineName.toLowerCase() === 'perplexity') {
    return process.env.PERPLEXITY_MODEL || 'perplexity/sonar-small-online'
  }
  return process.env.DEFAULT_ANSWER_MODEL || 'openai/gpt-4o-mini'
}

function buildAnswerPrompt(query: string, engineName: string) {
  const system = `You are answering as a user-facing assistant on ${engineName}. Provide a clear, concise, factual answer to the user's query. If information is uncertain, state that briefly. Avoid preambles and disclaimers.`
  const user = query
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}
