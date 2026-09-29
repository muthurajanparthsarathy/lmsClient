/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
    domains: ['images.unsplash.com'], // Add your image domains here
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS domains (be careful in production)
      },
    ],
  },
 
  reactStrictMode: false,
  eslint: {
    // ✅ Skip ESLint errors during build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ Skip TypeScript type errors during build
    ignoreBuildErrors: true,
  },
  // Cross-origin isolation enables SharedArrayBuffer, which the interactive
  // Python runner (Pyodide in a Web Worker) uses to let input() type directly in
  // the terminal. COEP is set to "credentialless" (the lenient mode) so existing
  // cross-origin assets (Cloudinary images, etc.) keep loading. If this ever
  // interferes with an embed, removing these two headers degrades the interactive
  // runner gracefully to a window.prompt() dialog — nothing else is affected.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },
  async rewrites() {
    // Same-origin proxy to the self-hosted Piston API (Docker, port 2000).
    // Piston sends no CORS headers, so the browser must not call it directly —
    // requests go to /piston-api/* on this server and are forwarded server-side.
    return [
      {
        source: '/piston-api/:path*',
        destination: `${process.env.PISTON_INTERNAL_URL || 'http://localhost:2000'}/api/v2/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
