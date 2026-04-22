/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@xcrm/ui',
    '@xcrm/shared',
    '@xcrm/db',
    '@xcrm/jobs',
    '@xcrm/ai',
    '@xcrm/drive-adapter',
  ],
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'bcryptjs',
      'googleapis',
      'google-auth-library',
      '@anthropic-ai/sdk',
      'node-cron',
    ],
    instrumentationHook: true,
  },
};

export default nextConfig;
