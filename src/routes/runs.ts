import { Router } from 'express'
import { prisma } from '../db/client'
import { captureRun, scoreRun, counterfactualRun, brandDeltaRun } from '../workers/runWorkers'

export const runsRouter = Router()

runsRouter.get('/', async (_req, res, next) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { started_at: 'desc' },
      take: 50,
    })
    res.json(runs)
  } catch (e) { next(e) }
})

runsRouter.post('/start', async (req, res, next) => {
  try {
    const label = req.body?.label ?? new Date().toISOString()
    const run = await prisma.run.create({ data: { label } })
    // For beta: run sequentially (no background queue)
    await captureRun(run.id)
    await scoreRun(run.id)
    await counterfactualRun(run.id)
    await brandDeltaRun(run.id)
    res.json({ id: run.id })
  } catch (e) { next(e) }
})

runsRouter.get('/:id', async (req, res, next) => {
  try {
    const run = await prisma.run.findUnique({ where: { id: req.params.id } })
    if (!run) return res.status(404).json({ error: 'not found' })
    res.json(run)
  } catch (e) { next(e) }
})

runsRouter.get('/:id/summary', async (req, res, next) => {
  try {
    const runId = req.params.id
    const observations = await prisma.observation.findMany({
      where: { runId },
      include: { score: true, query: true, engine: true },
    })
    const matrix = observations.map(o => ({
      query: { id: o.queryId, text: o.query.text },
      engine: { id: o.engineId, name: o.engine.name },
      total_score: o.score?.total_score ?? null,
    }))
    res.json({ runId, matrix })
  } catch (e) { next(e) }
})
