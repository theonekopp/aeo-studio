import type { Request, Response, NextFunction } from 'express'

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const pwd = process.env.ADMIN_PASSWORD
  if (!pwd) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' })
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="AEO"')
    return res.status(401).end()
  }
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const parts = decoded.split(':')
  const pass = parts.slice(1).join(':')
  if (pass !== pwd) return res.status(403).json({ error: 'forbidden' })
  next()
}

