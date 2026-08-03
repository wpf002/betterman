/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Linting runs once at the repo root (`pnpm lint`), so `next build` does not
  // need to re-run it with its own config.
  eslint: { ignoreDuringBuilds: true },
  // Workspace packages ship TypeScript source, not a build step.
  transpilePackages: ['@betterman/ui'],
  images: {
    // Email and Substack artwork is mirrored locally (spec §8), so no remote
    // patterns are allowed by default.
    remotePatterns: [],
  },
};

export default nextConfig;
