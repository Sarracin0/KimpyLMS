const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['utfs.io', 'img.clerk.com'],
  },
  experimental: {
    // Ensure Next selects this project as workspace root (avoid picking /Users/... package-lock)
    outputFileTracingRoot: path.join(__dirname),
  },
}

module.exports = nextConfig
