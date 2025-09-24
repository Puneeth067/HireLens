import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hirelens/shared-types', '@hirelens/config'],
};

export default nextConfig;