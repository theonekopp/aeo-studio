import { Router } from 'express'
import { prisma } from '../db/client'

export const dataRouter = Router()

dataRouter.get('/observations', async (req, res, next) => {
  try {
    const run_id = req.query.run_id as string | undefined
    const where = run_id ? { runId: run_id } : {}
    const items = await prisma.observation.findMany({ where, include: { score: true, engine: true, query: true } })
    res.json(items)
  } catch (e) { next(e) }
})

dataRouter.get('/counterfactuals', async (req, res, next) => {
  try {
    const observation_id = req.query.observation_id as string | undefined
    const where = observation_id ? { observationId: observation_id } : {}
    const items = await prisma.counterfactual.findMany({ where })
    res.json(items)
  } catch (e) { next(e) }
})

dataRouter.get('/brand-deltas', async (req, res, next) => {
  try {
    const observation_id = req.query.observation_id as string | undefined
    const where = observation_id ? { observationId: observation_id } : {}
    const items = await prisma.brandDelta.findMany({ where })
    res.json(items)
  } catch (e) { next(e) }
})

dataRouter.get('/expanded-questions', async (req, res, next) => {
  try {
    const observation_id = req.query.observation_id as string | undefined
    const where = observation_id ? { observationId: observation_id } : {}
    const items = await prisma.expandedQuestion.findMany({ where })
    res.json(items)
  } catch (e) { next(e) }
})

dataRouter.get('/expanded-answers', async (req, res, next) => {
  try {
    const expanded_question_id = req.query.expanded_question_id as string | undefined
    const where = expanded_question_id ? { expandedQuestionId: expanded_question_id } : {}
    const items = await prisma.expandedAnswer.findMany({ where })
    res.json(items)
  } catch (e) { next(e) }
})

dataRouter.get('/brand-opportunities', async (req, res, next) => {
  try {
    const observation_id = req.query.observation_id as string | undefined
    const where = observation_id ? { observationId: observation_id } : {}
    const items = await prisma.brandOpportunityAction.findMany({ where })
    res.json(items)
  } catch (e) { next(e) }
})
