'use client'

import { useEffect, useMemo, useState } from 'react'

type Run = { id: string; label: string | null; started_at: string }
type MatrixRow = { query: { id: string; text: string }, engine: { id: string; name: string }, total_score: number | null }

const base = process.env.NEXT_PUBLIC_API_BASE || '/api'

export default function RunsPage() {
  const [pwd, setPwd] = useState('')
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<MatrixRow[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => { setPwd(localStorage.getItem('aeo_pwd') || '') }, [])

  useEffect(() => {
    if (!pwd) return
    fetch(base + '/runs', { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      .then(r => r.json())
      .then(setRuns)
      .catch(() => setRuns([]))
  }, [pwd])

  useEffect(() => {
    if (!pwd || !selected) return
    fetch(base + `/runs/${selected}/summary`, { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      .then(r => r.json())
      .then(d => setMatrix(d.matrix || []))
      .catch(() => setMatrix([]))
  }, [pwd, selected])

  async function startRun() {
    if (!pwd) return alert('Set password on /login')
    setBusy(true)
    try {
      const r = await fetch(base + '/runs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa('user:' + pwd) },
        body: JSON.stringify({}),
      })
      const data = await r.json()
      setSelected(data.id)
      // refresh runs list
      const runList = await fetch(base + '/runs', { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      setRuns(await runList.json())
    } finally { setBusy(false) }
  }

  const queries = useMemo(() => Array.from(new Set(matrix.map(m => JSON.stringify(m.query)))).map(s => JSON.parse(s)), [matrix])
  const engines = useMemo(() => Array.from(new Set(matrix.map(m => JSON.stringify(m.engine)))).map(s => JSON.parse(s)), [matrix])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={startRun} disabled={busy} style={{ padding: '6px 10px' }}>{busy ? 'Running…' : 'Start New Run'}</button>
        <span style={{ opacity: 0.7 }}>or select an existing run:</span>
        <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}>
          <option value='' disabled>Pick a run</option>
          {runs.map(r => (
            <option key={r.id} value={r.id}>{r.label || r.started_at}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div>
          <h2>Run Summary</h2>
          <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Query \ Engine</th>
                  {engines.map((e) => (
                    <th key={e.id} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>{e.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queries.map((q) => (
                  <tr key={q.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>
                      <a href={`/queries/${q.id}`}>{q.text}</a>
                    </td>
                    {engines.map((e) => {
                      const cell = matrix.find(m => m.query.id === q.id && m.engine.id === e.id)
                      const sc = cell?.total_score
                      const bg = sc == null ? '#fff' : sc >= 6 ? '#daf5d7' : sc >= 3 ? '#fff7c2' : '#ffd7d7'
                      return (
                        <td key={e.id} style={{ padding: 8, borderBottom: '1px solid #f3f3f3', background: bg }}>
                          {sc == null ? '—' : sc}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
