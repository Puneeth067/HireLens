import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: '../', // Set workspace root to parent directory
  // Ensure transpilation of workspace packages
  transpilePackages: ['@hirelens/shared-types', '@hirelens/config'],
  // Add trailing slash configuration to ensure consistent routing
  trailingSlash: false,
  // Ensure proper handling of dynamic routes
  experimental: {
    // Optimize dynamic routes
    optimizeCss: true,
  },
};

export default nextConfig;