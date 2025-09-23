/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Ensure transpilation of workspace packages
  transpilePackages: ['@hirelens/shared-types', '@hirelens/config'],

};

export default nextConfig;