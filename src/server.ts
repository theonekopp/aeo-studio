import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { runsRouter } from './routes/runs'
import { queriesRouter } from './routes/queries'
import { dataRouter } from './routes/data'
import { jobsRouter } from './routes/jobs'
import { basicAuth } from './middleware/basicAuth'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

app.get('/health', (_req, res) => res.json({ ok: true }))

// Minimal password auth for dashboard/API (beta)
app.use(basicAuth)

app.use('/runs', runsRouter)
app.use('/queries', queriesRouter)
app.use('/', dataRouter)
app.use('/jobs', jobsRouter)

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err)
  res.status(500).json({ error: 'internal_error', message: String(err?.message || err) })
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
  console.log(`API listening on :${port}`)
})

