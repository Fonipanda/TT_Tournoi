import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // critique pour le Dockerfile multi-stage
  reactStrictMode: true,
  poweredByHeader: false,

  // Permet à Next.js de tracer les fichiers de mono-repo dans le standalone build
  outputFileTracingRoot: path.join(__dirname, '../..'),

  // Packages mono-repo qui doivent être transpilés (TypeScript natif sans build)
  transpilePackages: ['@tt/auth', '@tt/db', '@tt/sms', '@tt/types', '@tt/ui'],

  experimental: {
    // Permet d'utiliser argon2/bullmq côté Server Components / Route Handlers
    serverComponentsExternalPackages: ['argon2', 'bullmq', 'ioredis', '@prisma/client'],
  },

  // Headers de sécurité (HSTS désactivé en dev, activé via Nginx/Coolify en prod)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
