#!/usr/bin/env node
/**
 * Crée ou réinitialise le compte admin avec un mot de passe connu.
 *
 * Usage :
 *   node infra/scripts/create-admin.mjs [username] [password] [role]
 *
 * Défauts :
 *   username = admin
 *   password = Admin123!
 *   role     = admin
 *
 * En local (depuis racine du repo) :
 *   node infra/scripts/create-admin.mjs
 *
 * Sur le VPS (depuis le container) :
 *   docker exec -it $(docker ps --filter name=k8336rvbo -q) \
 *     node /app/infra/scripts/create-admin.mjs admin MonNouveauPass!
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Chemins potentiels selon contexte (local vs container)
const PRISMA_PATHS = [
  path.join(__dirname, '../../packages/db/src/generated'),
  '/app/packages/db/src/generated',
];

let PrismaClient;
for (const p of PRISMA_PATHS) {
  try {
    ({ PrismaClient } = require(p));
    if (PrismaClient) break;
  } catch {
    /* try next */
  }
}
if (!PrismaClient) {
  console.error('❌ PrismaClient introuvable. Lance "pnpm db:generate" d\'abord.');
  process.exit(1);
}

const ARGON2_PATHS = [
  path.join(__dirname, '../../node_modules/argon2'),
  path.join(__dirname, '../../packages/db/node_modules/argon2'),
  path.join(__dirname, '../../packages/auth/node_modules/argon2'),
  '/app/node_modules/argon2',
  'argon2',
];

let argon2;
for (const p of ARGON2_PATHS) {
  try {
    argon2 = require(p);
    if (argon2 && argon2.hash) break;
  } catch {
    /* try next */
  }
}
if (!argon2) {
  console.error('❌ argon2 introuvable.');
  process.exit(1);
}

const username = process.argv[2] ?? 'admin';
const password = process.argv[3] ?? 'Admin123!';
const role = process.argv[4] ?? 'admin';

if (!['admin', 'juge_arbitre', 'player'].includes(role)) {
  console.error('❌ Role invalide. Doit être : admin, juge_arbitre ou player');
  process.exit(1);
}

// Politique appliquée par l'application : 12 car. + majuscule + minuscule +
// chiffre + caractère spécial. Ce script n'échoue pas (il doit rester capable
// de rétablir un accès), mais il avertit.
const policyOk =
  password.length >= 12 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);
if (!policyOk) {
  console.warn(
    '⚠  Ce mot de passe ne respecte pas la politique de l\'application\n' +
      '   (12 caractères min., majuscule, minuscule, chiffre, caractère spécial).\n' +
      '   À réserver au développement.',
  );
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    // Compte créé par un administrateur : l'adresse est marquée comme
    // confirmée, sinon la connexion serait refusée (compte non activé).
    const now = new Date();
    const result = await prisma.userAccount.upsert({
      where: { username },
      update: {
        passwordHash: hash,
        role,
        isActive: true,
        passwordNeedsReset: false,
        emailVerifiedAt: now,
      },
      create: {
        username,
        email: `${username}@local.invalid`,
        passwordHash: hash,
        role,
        isActive: true,
        passwordNeedsReset: false,
        emailVerifiedAt: now,
      },
    });
    console.log(`✅ Compte ${result.role} créé/réinitialisé`);
    console.log(`   username: ${username}`);
    console.log(`   password: ${password}`);
    console.log(`   role:     ${role}`);
    console.log(`   ID:       ${result.id}`);
    console.log('');
    console.log('⚠️  Change ce mot de passe en production immédiatement.');
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
