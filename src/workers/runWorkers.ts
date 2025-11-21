import { prisma } from '../db/client'
import { evaluateBaseline, evaluateCounterfactuals, evaluateBrandDelta, evaluateSurfaceQuestions, evaluateBrandOpportunities } from '../services/evaluator'
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

export async function brandDeltaRun(runId: string) {
  const brandNames = (process.env.BRAND_NAMES || '').split(',').map(s => s.trim()).filter(Boolean)
  const brandName = brandNames[0] || 'Our Brand'
  const observations = await prisma.observation.findMany({ where: { runId }, include: { counterfactuals: true } })
  for (const obs of observations) {
    try {
      const query = await prisma.query.findUnique({ where: { id: obs.queryId } })
      if (!query) continue
      const cfItems = await prisma.counterfactual.findMany({ where: { observationId: obs.id } })
      if (cfItems.length === 0) continue
      const baselineAnswer = obs.parsed_answer ?? JSON.stringify(obs.raw_answer)
      const delta = await evaluateBrandDelta(brandName, query.text, baselineAnswer, cfItems as any)
      await prisma.brandDelta.create({
        data: {
          observationId: obs.id,
          brand_missing_signals: delta.brand_missing_signals as any,
          actionable_levers: delta.actionable_levers as any,
          priority_actions: delta.priority_actions as any,
        },
      })
    } catch (err) {
      logger.error({ err, obsId: obs.id }, 'brand_delta failure')
    }
  }
}

// New pipeline from 11202025 ticket
export async function surfaceExpandRun(runId: string) {
  const observations = await prisma.observation.findMany({ where: { runId } })
  for (const obs of observations) {
    try {
      const query = await prisma.query.findUnique({ where: { id: obs.queryId } })
      if (!query) continue
      const baselineAnswer = obs.parsed_answer ?? JSON.stringify(obs.raw_answer)
      const qs = await evaluateSurfaceQuestions(query.text, baselineAnswer)
      for (const q of qs) {
        await prisma.expandedQuestion.create({ data: { observationId: obs.id, question_text: q } })
      }
    } catch (err) {
      logger.error({ err, obsId: obs.id }, 'surface_expand failure')
    }
  }
}

export async function expandedAnswersRun(runId: string) {
  const observations = await prisma.observation.findMany({ where: { runId } })
  const engines = await prisma.engine.findMany()
  for (const obs of observations) {
    try {
      const eqs = await prisma.expandedQuestion.findMany({ where: { observationId: obs.id } })
      const thisEngine = engines.find(e => e.id === obs.engineId)
      if (!thisEngine) continue
      for (const q of eqs) {
        // Query same engine model used in capture
        const model = selectModelForEngine(thisEngine.name)
        const messages = buildAnswerPrompt(q.question_text, thisEngine.name)
        const answer = await chatText(model, messages, { temperature: 0.2, max_tokens: 600 })
        await prisma.expandedAnswer.create({
          data: {
            expandedQuestionId: q.id,
            engineId: thisEngine.id,
            raw_answer: { engine: thisEngine.name, model, content: answer },
            parsed_answer: answer,
          },
        })
      }
    } catch (err) {
      logger.error({ err, obsId: obs.id }, 'expanded_answers failure')
    }
  }
}

export async function brandOpportunityRun(runId: string) {
  const brandNames = (process.env.BRAND_NAMES || '').split(',').map(s => s.trim()).filter(Boolean)
  const brandName = brandNames[0] || 'Our Brand'
  const observations = await prisma.observation.findMany({ where: { runId } })
  for (const obs of observations) {
    try {
      const query = await prisma.query.findUnique({ where: { id: obs.queryId } })
      if (!query) continue
      const eqs = await prisma.expandedQuestion.findMany({ where: { observationId: obs.id } })
      if (eqs.length === 0) continue
      const answers = await prisma.expandedAnswer.findMany({ where: { expandedQuestionId: { in: eqs.map(x => x.id) } } })
      const baselineAnswer = obs.parsed_answer ?? JSON.stringify(obs.raw_answer)
      const expandedQuestions = eqs.map(x => x.question_text)
      const expandedAnswers = answers.map(a => a.parsed_answer || JSON.stringify(a.raw_answer))
      const out = await evaluateBrandOpportunities(brandName, query.text, baselineAnswer, expandedQuestions, expandedAnswers)
      await prisma.brandOpportunityAction.create({
        data: {
          observationId: obs.id,
          brand_missing_signals: out.brand_missing_signals as any,
          actionable_levers: out.actionable_levers as any,
          priority_actions: out.priority_actions as any,
        },
      })
    } catch (err) {
      logger.error({ err, obsId: obs.id }, 'brand_opportunity failure')
    }
  }
}

// Convenience: full pipeline runner (non-blocking for HTTP route)
export async function runFullPipeline(runId: string) {
  await captureRun(runId)
  await scoreRun(runId)
  await surfaceExpandRun(runId)
  await expandedAnswersRun(runId)
  await brandOpportunityRun(runId)
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
