/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // Add trailing slash configuration to ensure consistent routing
  trailingSlash: false,
  // Optimize webpack caching
  webpack: (config, { isServer }) => {
    // Disable webpack caching in development to avoid snapshot issues
    if (process.env.NODE_ENV === 'development') {
      config.cache = false;
    }
    
    return config;
  },
  // Disable ESLint during build to avoid peer dependency conflicts in Vercel
  eslint: {
    ignoreDuringBuilds: true,
  }
}

module.exports = nextConfig