-- Migration : changer imageUrl en TEXT pour supporter les data URL base64
ALTER TABLE "MenuItem" ALTER COLUMN "imageUrl" TYPE TEXT;
