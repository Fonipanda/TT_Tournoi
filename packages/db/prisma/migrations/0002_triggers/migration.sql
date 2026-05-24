-- =============================================================================
-- Migration 0002 — Triggers métier
-- -----------------------------------------------------------------------------
-- Garantit qu'un seul SmsAdapterConfig peut avoir isActive=TRUE à un instant T.
-- Appliqué automatiquement par `prisma migrate deploy` après le init schema.
-- =============================================================================

CREATE OR REPLACE FUNCTION ensure_single_active_sms_adapter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."isActive" = TRUE THEN
    UPDATE "SmsAdapterConfig"
       SET "isActive" = FALSE
     WHERE "id" <> NEW."id"
       AND "isActive" = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_sms_adapter ON "SmsAdapterConfig";

CREATE TRIGGER trg_single_active_sms_adapter
BEFORE INSERT OR UPDATE ON "SmsAdapterConfig"
FOR EACH ROW
EXECUTE FUNCTION ensure_single_active_sms_adapter();

-- -----------------------------------------------------------------------------
-- Index partiel : matches actifs (live dashboard)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_match_active_status
  ON "Match" ("status")
  WHERE "status" IN ('waiting', 'in_progress');

-- -----------------------------------------------------------------------------
-- Index partiel : refresh tokens valides
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_refresh_token_valid
  ON "RefreshToken" ("userId", "expiresAt")
  WHERE "revokedAt" IS NULL;
