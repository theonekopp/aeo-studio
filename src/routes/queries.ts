import { Router } from 'express'
import { prisma } from '../db/client'
import slugify from 'slugify'

export const queriesRouter = Router()

queriesRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.query.findMany({ orderBy: { priority: 'asc' } })
    res.json(items)
  } catch (e) { next(e) }
})

queriesRouter.post('/', async (req, res, next) => {
  try {
    const { text, funnel_stage, priority, target_url } = req.body || {}
    if (!text || !funnel_stage) return res.status(400).json({ error: 'text and funnel_stage required' })
    const slug = slugify(text, { lower: true, strict: true })
    const q = await prisma.query.create({
      data: { text, slug, funnel_stage, priority: priority ?? 2, target_url },
    })
    res.status(201).json(q)
  } catch (e) { next(e) }
})

queriesRouter.get('/:id', async (req, res, next) => {
  try {
    const q = await prisma.query.findUnique({ where: { id: req.params.id } })
    if (!q) return res.status(404).json({ error: 'not found' })
    res.json(q)
  } catch (e) { next(e) }
})

