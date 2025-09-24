/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  transpilePackages: ['@hirelens/shared-types', '@hirelens/config'],
};

export default nextConfig;