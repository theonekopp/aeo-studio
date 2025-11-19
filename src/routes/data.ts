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
