/**
 * @tt/auth — Système d'authentification JWT + argon2id + RBAC.
 *
 * Trois sous-modules :
 *  - jwt       : signAccessToken / signRefreshToken / verifyAccessToken
 *                (utilise `jose` pour rester Edge-compatible côté Next.js
 *                middleware ; ne pas importer argon2 dans le middleware !)
 *  - password  : hashPassword / verifyPassword (argon2id, OWASP 2024)
 *  - rbac      : canAccess / requireRole helpers
 *
 * Usage côté Next.js Edge middleware :
 *   import { verifyAccessToken } from '@tt/auth/jwt'   // ✅ Edge-safe
 *
 * Usage côté Route Handlers (Node.js) :
 *   import { hashPassword, verifyPassword } from '@tt/auth/password'  // Node only
 */

export * from './jwt.js';
export * from './password.js';
export * from './rbac.js';
