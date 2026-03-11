import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['duckdb', 'pg', 'pino', 'pino-pretty'],
}

export default nextConfig
