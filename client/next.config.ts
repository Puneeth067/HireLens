import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: '../', // Set workspace root to parent directory
  // Add trailing slash configuration to ensure consistent routing
  trailingSlash: false,
  // Remove the experimental optimizeCss feature which might be causing issues
};

export default nextConfig;