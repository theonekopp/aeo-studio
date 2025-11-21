'use client'

import { useEffect, useMemo, useState } from 'react'

type Query = {
  id: string
  text: string
  funnel_stage: 'TOFU' | 'MOFU' | 'BOFU'
  priority: number
  target_url?: string | null
  is_active: boolean
}

const base = process.env.NEXT_PUBLIC_API_BASE || '/api'

export default function ManageQueriesPage() {
  const [pwd, setPwd] = useState('')
  const [items, setItems] = useState<Query[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => { setPwd(localStorage.getItem('aeo_pwd') || '') }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(base + '/queries', { headers: { Authorization: 'Basic ' + btoa('user:' + pwd) } })
      if (!res.ok) throw new Error('Failed to load queries')
      const data = await res.json()
      setItems(data)
    } catch (e: any) { setError(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (pwd) load() }, [pwd])

  async function toggleActive(q: Query) {
    const next = !q.is_active
    setItems(prev => prev.map(x => x.id === q.id ? { ...x, is_active: next } : x))
    try {
      const res = await fetch(base + `/queries/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa('user:' + pwd) },
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error('Update failed')
    } catch (e) {
      // Revert on error
      setItems(prev => prev.map(x => x.id === q.id ? { ...x, is_active: q.is_active } : x))
      alert('Failed to update. Please try again.')
    }
  }

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return items
    return items.filter(q => q.text.toLowerCase().includes(f))
  }, [items, filter])

  return (
    <div>
      <h2>Manage Queries</h2>
      {!pwd && <p style={{ color: 'crimson' }}>Set the API password on /login first.</p>}
      <div style={{ margin: '8px 0' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter queries" style={{ padding: 6, minWidth: 260 }} />
        <button onClick={load} style={{ marginLeft: 8, padding: '6px 10px' }}>Refresh</button>
      </div>
      {loading ? <p>Loading…</p> : error ? <p style={{ color: 'crimson' }}>{error}</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={th}>Active</th>
                <th style={th}>Query</th>
                <th style={th}>Stage</th>
                <th style={th}>Priority</th>
                <th style={th}>Target URL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id}>
                  <td style={td}><input type="checkbox" checked={!!q.is_active} onChange={() => toggleActive(q)} /></td>
                  <td style={td}>{q.text}</td>
                  <td style={td}>{q.funnel_stage}</td>
                  <td style={td}>{q.priority}</td>
                  <td style={td}><a href={q.target_url || '#'} target="_blank" rel="noreferrer">{q.target_url || '—'}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p style={{ opacity: 0.7 }}>No queries.</p>}
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }
const td: React.CSSProperties = { padding: 8, borderBottom: '1px solid #f3f3f3' }

