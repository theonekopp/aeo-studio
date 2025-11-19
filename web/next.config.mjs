/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const target = process.env.API_BASE_INTERNAL
    if (!target) return []
    // Proxy browser calls to /api/* to the API service from the server.
    return [{ source: '/api/:path*', destination: `${target}/:path*` }]
  },
}

export default nextConfig
