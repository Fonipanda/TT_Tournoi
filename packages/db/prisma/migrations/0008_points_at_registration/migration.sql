-- Classement du joueur figé à l'inscription.
-- Idempotent : rejouable sans erreur.

-- Le barème FFTT de gain et de perte de points s'applique aux points « en
-- début d'épreuve ». `Player.points` est mis à jour à chaque match terminé :
-- le relire après coup donnerait un écart de classement faussé, et l'erreur
-- s'aggraverait à mesure que le tournoi avance.
ALTER TABLE "PlayerBracketRegistration"
  ADD COLUMN IF NOT EXISTS "pointsAtRegistration" DOUBLE PRECISION;

-- Rétro-remplissage des inscriptions existantes depuis la fiche joueur.
--
-- APPROXIMATION ASSUMÉE : pour un tournoi déjà entamé, `Player.points` a pu
-- dériver depuis l'inscription. La valeur reprise est donc le classement
-- courant, pas celui du jour de l'engagement. C'est néanmoins la seule donnée
-- disponible, et elle vaut mieux qu'un NULL qui priverait ces inscriptions de
-- tout calcul. Les inscriptions créées après cette migration portent, elles,
-- un snapshot exact.
UPDATE "PlayerBracketRegistration" r
SET "pointsAtRegistration" = p."points"
FROM "Player" p
WHERE p."id" = r."playerId"
  AND r."pointsAtRegistration" IS NULL;
