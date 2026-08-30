-- Répartition en poules figée par tableau.
-- Idempotent : rejouable sans erreur.

-- La répartition FFTT comporte deux tirages au sort (ordre des joueurs à
-- égalité de points, puis placement des 2èmes/3èmes dans le tableau final).
-- Sans persistance, chaque lecture rejouerait le tirage et la composition des
-- poules changerait d'un affichage à l'autre. Ces colonnes figent le résultat
-- à la génération : la répartition devient reproductible et consultable, et
-- seule une regénération explicite par l'organisateur retire un nouveau tirage.
ALTER TABLE "PlayerBracketRegistration"
  ADD COLUMN IF NOT EXISTS "initialSeed"  INTEGER,
  ADD COLUMN IF NOT EXISTS "poolNumber"   INTEGER,
  ADD COLUMN IF NOT EXISTS "poolPosition" INTEGER,
  ADD COLUMN IF NOT EXISTS "poolRank"     INTEGER;

-- Pas de rétro-remplissage : pour les tableaux déjà générés, le rang initial
-- et la place dans le serpent ne sont plus reconstituables (le tirage au sort
-- d'origine n'a jamais été enregistré). `NULL` signale explicitement
-- « poules pas encore générées avec cette version », l'UI retombant alors sur
-- le calcul à la volée depuis les matches existants.

-- Lecture des poules d'un tableau (page publique de progression, exports).
CREATE INDEX IF NOT EXISTS "PlayerBracketRegistration_bracketId_poolNumber_idx"
  ON "PlayerBracketRegistration" ("bracketId", "poolNumber");
