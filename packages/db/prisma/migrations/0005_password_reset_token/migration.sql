-- Jeton de réinitialisation de mot de passe (flux "mot de passe oublié")
-- Idempotent : rejouable sans erreur.
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id"        UUID         NOT NULL,
  "userId"    UUID         NOT NULL,
  "tokenHash" TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "requestIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key"
  ON "PasswordResetToken" ("tokenHash");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_expiresAt_idx"
  ON "PasswordResetToken" ("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
  ON "PasswordResetToken" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey'
  ) THEN
    ALTER TABLE "PasswordResetToken"
      ADD CONSTRAINT "PasswordResetToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "UserAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
