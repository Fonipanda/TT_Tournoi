-- Confirmation d'adresse email (activation de compte).
-- Idempotent : rejouable sans erreur.

-- 1) Colonne de vérification sur les comptes
ALTER TABLE "UserAccount"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- 2) IMPORTANT — les comptes déjà existants (admin, juge-arbitre, joueurs
--    créés avant cette migration) sont considérés comme vérifiés, sinon la
--    connexion leur serait refusée immédiatement après le déploiement.
UPDATE "UserAccount"
   SET "emailVerifiedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
 WHERE "emailVerifiedAt" IS NULL;

-- 3) Table des jetons de confirmation
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id"        UUID         NOT NULL,
  "userId"    UUID         NOT NULL,
  "tokenHash" TEXT         NOT NULL,
  "email"     TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "requestIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key"
  ON "EmailVerificationToken" ("tokenHash");

CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_expiresAt_idx"
  ON "EmailVerificationToken" ("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx"
  ON "EmailVerificationToken" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailVerificationToken_userId_fkey'
  ) THEN
    ALTER TABLE "EmailVerificationToken"
      ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
