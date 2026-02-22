import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {} // Moved to root for Next.js 16
};

export default withPWA(nextConfig);
