/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const raw = process.env.API_BASE_INTERNAL
    if (!raw) return []
    // Ensure absolute URL (http/https) and no trailing slash
    const hasProto = /^https?:\/\//i.test(raw)
    const base = (hasProto ? raw : `http://${raw}`).replace(/\/$/, '')
    return [{ source: '/api/:path*', destination: `${base}/:path*` }]
  },
}

export default nextConfig
