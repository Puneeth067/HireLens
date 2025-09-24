/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,          // optional but recommended
  experimental: {
    appDir: true,                 // enable App Router
  },
  // Transpile your shared packages
  transpilePackages: ['@hirelens/shared-types', '@hirelens/config'],
};

export default nextConfig;
