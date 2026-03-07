/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Anthropic API key now configured in Vercel env vars
}

module.exports = nextConfig
