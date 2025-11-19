'use client'

import { useEffect, useState } from 'react'

export default function LoginPage() {
  const [pwd, setPwd] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    const existing = localStorage.getItem('aeo_pwd')
    if (existing) setPwd(existing)
  }, [])

  async function check() {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || '/api'
      const res = await fetch(base + '/health', {
        headers: { Authorization: 'Basic ' + btoa('user:' + pwd) },
      })
      if (res.ok) {
        localStorage.setItem('aeo_pwd', pwd)
        setOk(true)
      } else setOk(false)
    } catch (e) { setOk(false) }
  }

  return (
    <div>
      <h2>Login</h2>
      <p>Enter admin password to access the API.</p>
      <input
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="Password"
        style={{ padding: 8, minWidth: 260 }}
      />
      <button onClick={check} style={{ marginLeft: 8, padding: '8px 12px' }}>Save</button>
      {ok === true && <p style={{ color: 'green' }}>Saved! You can navigate back.</p>}
      {ok === false && <p style={{ color: 'crimson' }}>Invalid password or server error.</p>}
    </div>
  )
}
