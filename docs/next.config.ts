import { createMDX } from 'fumadocs-mdx/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: {
    panicThreshold: 'all_errors',
  },
  async redirects() {
    return [
      {
        source: '/docs/get-started/install',
        destination: '/docs/get-started/quickstart',
        permanent: true,
      },
      {
        source: '/docs/reference/cli',
        destination: '/docs/reference/configuration',
        permanent: true,
      },
      {
        source: '/docs/features/templates',
        destination: '/docs/advanced/folders-and-templates',
        permanent: true,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
