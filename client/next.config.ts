import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: '../', // Set workspace root to parent directory
  // Ensure transpilation of workspace packages
  transpilePackages: ['@hirelens/shared-types', '@hirelens/config'],
};

export default nextConfig;