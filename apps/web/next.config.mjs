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

  // Packages avec binaires natifs / lourds que webpack ne doit PAS bundler.
  // Renommé depuis experimental.serverComponentsExternalPackages en Next 15.
  serverExternalPackages: ['argon2', 'bullmq', 'ioredis', '@prisma/client'],

  // TODO: réactiver après nettoyage des types Prisma JsonValue dans toutes les routes
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Force webpack à NE PAS bundler les binaires natifs même quand importés
  // depuis des transpilePackages (cas argon2 dans @tt/auth, bullmq dans @tt/sms).
  // Sans ça, on a "No native build was found for platform=linux arch=x64 abi=115".
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = config.externals ?? [];
      config.externals = [
        ...(Array.isArray(externals) ? externals : [externals]),
        'argon2',
        'bullmq',
        'ioredis',
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
