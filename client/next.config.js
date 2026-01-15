/** @type {import('next').NextConfig} */
const nextConfig = {
  // Using API route at /app/api/agent/query/route.ts for proper timeout handling
  // No rewrites needed - the API route handles the backend proxy
};

module.exports = nextConfig;
