import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**',
      },
    ],
  },
  // 画面は以前 /search にあったので、古いリンクやブックマークはトップへ転送する（?streaming=true などのクエリもそのまま引き継がれる）
  async redirects() {
    return [{ source: '/search', destination: '/', permanent: true }];
  },
};

export default nextConfig;
