import { Router } from 'express'
import { captureRun, scoreRun, counterfactualRun } from '../workers/runWorkers'

export const jobsRouter = Router()

jobsRouter.post('/capture-run', async (req, res, next) => {
  try {
    const { run_id } = req.body || {}
    if (!run_id) return res.status(400).json({ error: 'run_id required' })
    await captureRun(run_id)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

jobsRouter.post('/score-run', async (req, res, next) => {
  try {
    const { run_id } = req.body || {}
    if (!run_id) return res.status(400).json({ error: 'run_id required' })
    await scoreRun(run_id)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

jobsRouter.post('/counterfactual-run', async (req, res, next) => {
  try {
    const { run_id } = req.body || {}
    if (!run_id) return res.status(400).json({ error: 'run_id required' })
    await counterfactualRun(run_id)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

