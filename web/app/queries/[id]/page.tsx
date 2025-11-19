'use client'

import { useEffect, useMemo, useState } from 'react'

const base = process.env.NEXT_PUBLIC_API_BASE || '/api'

type Query = { id: string; text: string }
type Observation = { id: string; queryId: string; engineId: string; parsed_answer?: string | null; score?: any }
type Engine = { id: string; name: string }
type Counterfactual = { lever: string; description: string; inclusion_after: boolean; effort_score: number; impact_score: number; confidence: number }

export default function QueryDetail({ params }: { params: { id: string } }) {
  const [pwd, setPwd] = useState('')
  const [runId, setRunId] = useState<string>('')
  const [query, setQuery] = useState<Query | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [engines, setEngines] = useState<Record<string, Engine>>({})
  const [cfs, setCfs] = useState<Record<string, Counterfactual[]>>({})

  useEffect(() => { setPwd(localStorage.getItem('aeo_pwd') || '') }, [])

  useEffect(() => {
    if (!pwd) return
    fetch(base + `/queries/${params.id}`, { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      .then(r => r.json()).then(setQuery).catch(() => setQuery(null))
  }, [pwd, params.id])

  useEffect(() => {
    if (!pwd) return
    // use latest run
    fetch(base + '/runs', { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      .then(r => r.json()).then((runs) => setRunId(runs?.[0]?.id || ''))
  }, [pwd])

  useEffect(() => {
    if (!pwd || !runId) return
    fetch(base + `/observations?run_id=${encodeURIComponent(runId)}`, { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      .then(r => r.json())
      .then((items) => {
        const filtered = items.filter((o: any) => o.queryId === params.id)
        setObservations(filtered)
        const engs: Record<string, Engine> = {}
        items.forEach((o: any) => { if (o.engine) engs[o.engine.id] = o.engine })
        setEngines(engs)
        filtered.forEach(async (o: any) => {
          const res = await fetch(base + `/counterfactuals?observation_id=${o.id}`, { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
          const data = await res.json()
          setCfs(prev => ({ ...prev, [o.id]: data }))
        })
      })
  }, [pwd, runId, params.id])

  const rows = useMemo(() => observations.map((o) => ({
    engineId: o.engineId,
    engineName: engines[o.engineId]?.name || o.engineId,
    answer: o.parsed_answer || '(no parsed answer)',
    score: o.score?.total_score ?? null,
    cf: cfs[o.id] || [],
  })), [observations, engines, cfs])

  return (
    <div>
      <h2>Query Detail</h2>
      {query && <p><strong>Query:</strong> {query.text}</p>}
      {!runId && <p>No runs yet. Go back and start a run.</p>}
      {rows.map((r) => (
        <div key={r.engineId} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12 }}>
          <h3 style={{ marginTop: 0 }}>{r.engineName}</h3>
          <p><strong>Total score:</strong> {r.score == null ? '—' : r.score}</p>
          <p><strong>Answer:</strong> {r.answer}</p>
          <div>
            <p><strong>Counterfactuals:</strong></p>
            <ul>
              {r.cf.map((c, i) => (
                <li key={i}>
                  <em>{c.lever}</em>: {c.description} — inclusion_after: {String(c.inclusion_after)} — impact {c.impact_score}/5, effort {c.effort_score}/5, conf {c.confidence}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}
