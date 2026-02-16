/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // When deploying to GitHub Pages from repo: https://<user>.github.io/claude-training-systems/
  // Use basePath: '/claude-training-systems' and deploy contents of `out/` to gh-pages branch.
  // For local dev, basePath is empty so the app runs at /
  basePath: process.env.NODE_ENV === 'production' ? '/claude-training-systems' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/claude-training-systems/' : '',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NODE_ENV === 'production' ? '/claude-training-systems' : '',
  },
};

module.exports = nextConfig;
