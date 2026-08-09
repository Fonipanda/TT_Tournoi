-- Marqueur de vérification du classement auprès de la FFTT.
-- Idempotent : rejouable sans erreur.

-- Renseigné uniquement par POST /api/players/:id/sync-fftt, c'est-à-dire par
-- une réponse de la fédération. Une saisie manuelle de points ne le remplit
-- pas : le marqueur atteste de l'origine de la donnée, pas de sa présence.
ALTER TABLE "Player"
  ADD COLUMN IF NOT EXISTS "ffttSyncedAt" TIMESTAMP(3);

-- ATTENTION — aucun rétro-remplissage, contrairement à la migration 0006.
--
-- Les points des fiches existantes ne sont pas traçables : `POST /api/auth/register`
-- crée tout joueur avec 500 points en dur, et le numéro de licence y est saisi
-- librement par l'intéressé. Marquer ces fiches comme vérifiées reviendrait à
-- certifier un classement que personne n'a contrôlé — exactement ce que cette
-- colonne doit empêcher.
--
-- Conséquence assumée : après ce déploiement, tout joueur doit lancer une
-- synchronisation FFTT avant de s'inscrire à un tableau comportant une borne
-- de points. Les tableaux « Toutes Séries » restent ouverts, les inscriptions
-- déjà enregistrées ne sont pas remises en cause, et l'administrateur conserve
-- sa dérogation.
