import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['duckdb', 'pg'],
}

export default nextConfig
