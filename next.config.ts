import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: false, // Let user control when to activate new SW via update banner
  buildExcludes: [/middleware-manifest\.json$/],
  customWorkerSrc: 'worker',
});

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
  env: {
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
      `dev-${Date.now()}`,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default withPWA(nextConfig);
