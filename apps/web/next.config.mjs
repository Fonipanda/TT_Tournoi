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

  // Packages avec binaires natifs que webpack ne doit PAS bundler.
  // bullmq/ioredis sont du JS pur → on les laisse être bundlés par Next
  // (sinon le standalone ne les copie pas → "Cannot find module" au runtime).
  serverExternalPackages: ['argon2', '@prisma/client'],

  // TODO: réactiver après nettoyage des types Prisma JsonValue dans toutes les routes
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Force webpack à ne pas bundler argon2 et @prisma/client (vrais natifs).
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = config.externals ?? [];
      config.externals = [
        ...(Array.isArray(externals) ? externals : [externals]),
        'argon2',
        '@prisma/client',
      ];
    }
    return config;
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
