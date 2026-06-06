/**
 * Moteur FFTT — Articles I.301 à I.305 (Règlements sportifs FFTT 2025).
 *
 * Port TypeScript du moteur Python (backend/tournament/views.py:34-215).
 * Implémente :
 *  - I.301 : Ordre des parties dans une poule (tables FFTT_POOL_ORDERS)
 *  - I.303 : Classement des joueurs (V=2, D=1) avec départage
 *  - I.304.2 : Positions de seeding standard (bracket double élimination)
 *  - I.305 : Placement des qualifiés (1ers tête de série, 2èmes demi-tableau opposé)
 */

import { prisma, type Match, type Player } from '@tt/db';

// =============================================================================
// I.301 — Ordre des parties dans une poule
// =============================================================================

type Pair = readonly [number, number];

export const FFTT_POOL_ORDERS: Record<string, ReadonlyArray<Pair>> = {
  // (poolSize, qualifiers) → liste de paires (index 0-based dans la poule)
  '3,1': [[0, 2], [1, 2], [0, 1]],
  '3,2': [[0, 2], [0, 1], [1, 2]],
  '3,3': [[0, 2], [1, 2], [0, 1]],
  '4,1': [[0, 3], [1, 2], [0, 2], [1, 3], [0, 1], [2, 3]],
  '4,2': [[0, 2], [1, 3], [0, 1], [2, 3], [0, 3], [1, 2]],
  '4,3': [[0, 3], [1, 2], [0, 2], [1, 3], [0, 1], [2, 3]],
  '5,1': [
    [1, 4], [2, 3], [0, 4], [1, 2], [0, 3],
    [2, 4], [0, 2], [1, 3], [0, 1], [3, 4],
  ],
  '5,2': [
    [1, 4], [2, 3], [0, 3], [2, 4], [0, 2],
    [1, 3], [0, 1], [3, 4], [0, 4], [1, 2],
  ],
  '6,1': [
    [0, 5], [1, 4], [2, 3], [0, 4], [3, 5], [1, 2],
    [0, 3], [2, 4], [1, 5], [0, 2], [1, 3], [4, 5],
    [0, 1], [2, 5], [3, 4],
  ],
  '6,2': [
    [0, 5], [1, 4], [2, 3], [0, 3], [2, 4], [1, 5],
    [0, 2], [1, 3], [4, 5], [0, 1], [2, 5], [3, 4],
    [0, 4], [3, 5], [1, 2],
  ],
};

/** Combinaisons par défaut si la table FFTT n'a pas la clef (round-robin complet). */
function combinations(n: number): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) out.push([i, j]);
  }
  return out;
}

export function ffttPoolMatchOrder(poolSize: number, qualifiers: number): ReadonlyArray<Pair> {
  const q = Math.max(1, Math.min(qualifiers, poolSize - 1));
  const key = `${poolSize},${q}`;
  return FFTT_POOL_ORDERS[key] ?? combinations(poolSize);
}

// =============================================================================
// I.303 — Classement dans une poule
// =============================================================================

export interface PoolMatchInput {
  player1Id: string;
  player2Id: string;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  winnerId?: string | null;
  setsP1?: number;
  setsP2?: number;
  sets?: unknown; // JSON: {p1: number, p2: number}[]
}

/**
 * Calcule le classement final d'une poule selon I.303.
 * V = 2 pts, D = 1 pt, absent/forfait = 0 pt (pris en charge si winner=null).
 * Départage : confrontation directe (2 ex-aequo) → quotient sets → quotient points.
 */
export function ffttPoolRanking(
  poolMatches: PoolMatchInput[],
  playersInPool: string[],
): string[] {
  const pts: Record<string, number> = {};
  const setsW: Record<string, number> = {};
  const setsL: Record<string, number> = {};
  const ptsW: Record<string, number> = {}; // points de jeu gagnés (total)
  const ptsL: Record<string, number> = {}; // points de jeu perdus (total)
  const direct: Record<string, string> = {};

  for (const pid of playersInPool) {
    pts[pid] = 0;
    setsW[pid] = 0;
    setsL[pid] = 0;
    ptsW[pid] = 0;
    ptsL[pid] = 0;
  }

  for (const m of poolMatches) {
    if (m.status !== 'finished') continue;

    const p1 = m.player1Id;
    const p2 = m.player2Id;

    if (m.winnerId) {
      const w = m.winnerId;
      const lo = w === p1 ? p2 : p1;
      pts[w] = (pts[w] ?? 0) + 2;
      pts[lo] = (pts[lo] ?? 0) + 1;
      direct[`${p1}|${p2}`] = w;
      direct[`${p2}|${p1}`] = w;
    }

    // Sets gagnés/perdus
    setsW[p1] = (setsW[p1] ?? 0) + (m.setsP1 ?? 0);
    setsL[p1] = (setsL[p1] ?? 0) + (m.setsP2 ?? 0);
    setsW[p2] = (setsW[p2] ?? 0) + (m.setsP2 ?? 0);
    setsL[p2] = (setsL[p2] ?? 0) + (m.setsP1 ?? 0);

    // Points de jeu (somme de tous les points marqués dans les sets)
    const sets = (m.sets as { p1: number; p2: number }[]) ?? [];
    for (const s of sets) {
      ptsW[p1] = (ptsW[p1] ?? 0) + (s.p1 ?? 0);
      ptsL[p1] = (ptsL[p1] ?? 0) + (s.p2 ?? 0);
      ptsW[p2] = (ptsW[p2] ?? 0) + (s.p2 ?? 0);
      ptsL[p2] = (ptsL[p2] ?? 0) + (s.p1 ?? 0);
    }
  }

  // Tri initial par points matchs uniquement
  const ranking = [...playersInPool].sort((a, b) => (pts[b] ?? 0) - (pts[a] ?? 0));

  // Départage par groupes d'ex-aequo (même nombre de points)
  let i = 0;
  while (i < ranking.length) {
    let j = i + 1;
    while (j < ranking.length && (pts[ranking[j]!] ?? 0) === (pts[ranking[i]!] ?? 0)) {
      j++;
    }
    const groupSize = j - i;

    if (groupSize === 2) {
      // 2 ex-aequo → confrontation directe
      const p1 = ranking[i]!;
      const p2 = ranking[i + 1]!;
      const winner = direct[`${p1}|${p2}`];
      if (winner === p2) {
        ranking[i] = p2;
        ranking[i + 1] = p1;
      }
    } else if (groupSize >= 3) {
      // 3+ ex-aequo → quotient sets, puis quotient points de jeu
      const group = ranking.slice(i, j);
      group.sort((a, b) => {
        const sqA = (setsL[a] ?? 0) > 0 ? (setsW[a] ?? 0) / (setsL[a] ?? 1) : (setsW[a] ?? 0) * 100;
        const sqB = (setsL[b] ?? 0) > 0 ? (setsW[b] ?? 0) / (setsL[b] ?? 1) : (setsW[b] ?? 0) * 100;
        if (sqB !== sqA) return sqB - sqA;
        const pqA = (ptsL[a] ?? 0) > 0 ? (ptsW[a] ?? 0) / (ptsL[a] ?? 1) : (ptsW[a] ?? 0) * 100;
        const pqB = (ptsL[b] ?? 0) > 0 ? (ptsW[b] ?? 0) / (ptsL[b] ?? 1) : (ptsW[b] ?? 0) * 100;
        return pqB - pqA;
      });
      for (let k = 0; k < group.length; k++) {
        ranking[i + k] = group[k]!;
      }
    }

    i = j;
  }

  return ranking;
}

// =============================================================================
// I.304.2 — Positions de seeding standard
// =============================================================================

/**
 * Génère la liste des positions standard de seeding pour un bracket de taille N
 * (N puissance de 2). result[i] = numéro de seed (1-based) à la position i.
 */
export function ffttSeedingPositions(bracketSize: number): number[] {
  if (bracketSize <= 1) return [1];
  let seeds: number[] = [1, 2];
  while (seeds.length < bracketSize) {
    const newSeeds: number[] = [];
    for (const s of seeds) {
      newSeeds.push(s);
      newSeeds.push(seeds.length * 2 + 1 - s);
    }
    seeds = newSeeds;
  }
  return seeds.slice(0, bracketSize);
}

// =============================================================================
// I.305 — Placement des qualifiés dans le tableau d'élimination
// =============================================================================

export interface PoolStanding {
  poolName: string;
  ranking: string[]; // ids des joueurs ordonnés
}

/**
 * Mélange un sous-ensemble d'un tableau in-place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Place les qualifiés de poules + les bye_players dans un tableau d'élimination
 * selon le schéma déterministe :
 *   - Tier 1 (1ers + byeIds) → seeds 1..N+byeIds.length (pool i → seed i)
 *   - Tier 2 (2èmes) → seeds N+1..2N par paires de pools (1,2)→(2N-1, 2N),
 *     (3,4)→(2N-3, 2N-2), ... ; pool seul (N impair) → seed N+1
 *   - Tier 3 (3èmes) → seeds 2N+1..3N selon la même logique
 *   - Positions vides : seeds 3N+1..nextPower (jamais affichées comme "bye")
 *
 * La taille du tableau (`nextPower`) est la plus petite puissance de 2 ≥ Q.
 */
export function ffttPlaceQualifiers(
  poolStandings: PoolStanding[],
  qualifiersPerPool: number,
  byeIds: string[],
): (string | null)[] {
  // Tri NUMÉRIQUE des poules (sinon "Poule 10" précède "Poule 2")
  const poolOrder = (name: string): number => {
    const m = name.match(/(\d+)/);
    return m ? parseInt(m[1]!, 10) : 0;
  };
  const sortedStandings = [...poolStandings].sort(
    (a, b) => poolOrder(a.poolName) - poolOrder(b.poolName),
  );
  const N = sortedStandings.length;

  const firsts: (string | null)[] = sortedStandings.map((s) => s.ranking[0] ?? null);
  const seconds: (string | null)[] = qualifiersPerPool >= 2
    ? sortedStandings.map((s) => s.ranking[1] ?? null)
    : [];
  const thirds: (string | null)[] = qualifiersPerPool >= 3
    ? sortedStandings.map((s) => s.ranking[2] ?? null)
    : [];

  // Comptage des qualifiés réels (pour dimensionner le tableau)
  const validFirsts = firsts.filter((x) => x !== null).length;
  const validSeconds = seconds.filter((x) => x !== null).length;
  const validThirds = thirds.filter((x) => x !== null).length;
  const totalQ = byeIds.length + validFirsts + validSeconds + validThirds;
  if (totalQ < 2) {
    return [...byeIds, ...firsts, ...seconds, ...thirds].filter((x) => x !== null) as string[];
  }

  // Taille du tableau = plus petite puissance de 2 ≥ Q
  let nextPower = 1;
  while (nextPower < totalQ) nextPower *= 2;
  if (nextPower < 2) nextPower = 2;

  const seedAtPos = ffttSeedingPositions(nextPower);
  const posForSeed = new Map<number, number>();
  for (let i = 0; i < seedAtPos.length; i++) posForSeed.set(seedAtPos[i]!, i);

  const ordered: (string | null)[] = new Array(nextPower).fill(null);

  const placeAtSeed = (player: string | null | undefined, seed: number) => {
    if (!player || seed > nextPower) return;
    const pos = posForSeed.get(seed);
    if (pos !== undefined && pos < nextPower) ordered[pos] = player;
  };

  // ─── Tier 1 : byeIds + 1ers de poule → seeds 1..(byeIds.length + N)
  // Pool i → seed (byeIds.length + i). Les byeIds occupent les meilleurs seeds.
  for (let i = 0; i < byeIds.length; i++) {
    placeAtSeed(byeIds[i], i + 1);
  }
  for (let i = 0; i < N; i++) {
    placeAtSeed(firsts[i], byeIds.length + i + 1);
  }

  // ─── Tier 2 : 2èmes par paires inversées
  // Pour chaque paire de pools (2k-1, 2k) : seeds (2N+1-2k, 2N+2-2k)
  // Pool seul (N impair) : seed N+1 (= base+1 où base = N pour le tier 2)
  if (qualifiersPerPool >= 2 && validSeconds > 0) {
    placeTierByPoolPairs(seconds, byeIds.length + N, posForSeed, ordered, nextPower);
  }

  // ─── Tier 3 : 3èmes (mêmes règles, au tier suivant)
  if (qualifiersPerPool >= 3 && validThirds > 0) {
    placeTierByPoolPairs(thirds, byeIds.length + 2 * N, posForSeed, ordered, nextPower);
  }

  return ordered;
}

/**
 * Place les joueurs d'un tier (2èmes, 3èmes…) selon le schéma déterministe :
 *   - Pour chaque paire de pools (2k-1, 2k) : seeds (base+2N+1-2k, base+2N+2-2k)
 *   - Pool seul (N impair) : seed (base+1)
 *
 * @param players Liste des joueurs (un par poule, dans l'ordre des poules)
 * @param baseSeeds Nombre de seeds déjà utilisés par les tiers supérieurs
 *                  (ex: byeIds.length + N pour le tier des 2èmes)
 */
function placeTierByPoolPairs(
  players: (string | null)[],
  baseSeeds: number,
  posForSeed: Map<number, number>,
  ordered: (string | null)[],
  nextPower: number,
): void {
  const N = players.length;
  const maxSeed = baseSeeds + N;
  const numPairs = Math.floor(N / 2);

  const placeAt = (player: string | null | undefined, seed: number) => {
    if (!player || seed > nextPower) return;
    const pos = posForSeed.get(seed);
    if (pos !== undefined && pos < nextPower) ordered[pos] = player;
  };

  for (let k = 1; k <= numPairs; k++) {
    const poolAIdx = 2 * k - 2; // 0-indexed
    const poolBIdx = 2 * k - 1;
    const seedA = maxSeed + 1 - 2 * k;
    const seedB = maxSeed + 2 - 2 * k;
    placeAt(players[poolAIdx], seedA);
    placeAt(players[poolBIdx], seedB);
  }

  // Lone last pool si N impair
  if (N % 2 === 1) {
    const lastPlayer = players[N - 1];
    const lastSeed = baseSeeds + 1;
    placeAt(lastPlayer, lastSeed);
  }
}

// =============================================================================
// FFTT Points-Swap (barème simplifié, à affiner avec table officielle)
// =============================================================================

/**
 * Swap de points FFTT après un match.
 * Calcul approximatif basé sur la différence de points (winnerPoints - loserPoints).
 * Cf. table officielle FFTT pour valeurs précises.
 */
export function fftPointsSwap(winnerPoints: number, loserPoints: number): number {
  const diff = winnerPoints - loserPoints;
  // Vainqueur plus faible : gagne plus
  if (diff < -300) return 12;
  if (diff < -150) return 10;
  if (diff < -50) return 8;
  if (diff < 0) return 7;
  // Vainqueur plus fort : gagne moins
  if (diff < 50) return 6;
  if (diff < 150) return 4;
  if (diff < 300) return 2;
  return 1;
}

// =============================================================================
// Entrée publique : génération poules + élimination
// =============================================================================

// =============================================================================
// Séparation des clubs — contrainte post-snake-seeding
// =============================================================================

/**
 * Après le snake seeding, échange des joueurs entre poules pour éviter
 * que 2 joueurs du même club soient dans la même poule.
 * L'algorithme privilégie les swaps avec un joueur de même position (même "slot")
 * afin de minimiser l'impact sur l'équilibre de niveau.
 * Complexité : O(pools² × poolSize²) — négligeable pour des tournois < 100 joueurs.
 */
function separateClubs(pools: Player[][]): void {
  const MAX_PASSES = 10;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let swapped = false;

    for (let pi = 0; pi < pools.length; pi++) {
      const pool = pools[pi]!;
      // Détecte les clubs en doublon dans cette poule
      const clubCount = new Map<string, number>();
      for (const p of pool) {
        const club = p.club ?? '';
        if (club) clubCount.set(club, (clubCount.get(club) ?? 0) + 1);
      }

      for (const [club, count] of clubCount) {
        if (count <= 1) continue;
        // Il y a un conflit : trouver le 2ème joueur de ce club (le plus faible)
        // et le swapper avec un joueur d'une autre poule
        const conflictIdx = findLastIndexByClub(pool, club);
        if (conflictIdx === -1) continue;

        const conflictPlayer = pool[conflictIdx]!;
        let bestSwap: { targetPool: number; targetIdx: number; cost: number } | null = null;

        for (let pj = 0; pj < pools.length; pj++) {
          if (pj === pi) continue;
          const targetPool = pools[pj]!;

          // Vérifie que la poule cible n'a pas déjà un joueur de ce club
          if (targetPool.some((tp) => (tp.club ?? '') === club)) continue;

          for (let ti = 0; ti < targetPool.length; ti++) {
            const candidate = targetPool[ti]!;
            const candidateClub = candidate.club ?? '';

            // Vérifie que le candidat ne créerait pas un conflit dans la poule source
            const sourceHasCandidate = candidateClub
              ? pool.some((sp, idx) => idx !== conflictIdx && (sp.club ?? '') === candidateClub)
              : false;
            if (sourceHasCandidate) continue;

            // Coût hiérarchique :
            // 1) Préférer FORTEMENT le même slot (P1↔P1, P2↔P2, P3↔P3) pour préserver le seeding.
            // 2) Parmi les candidats même slot, minimiser l'écart de points.
            // 3) Tie-break : préférer les pools adjacentes pour minimiser les perturbations.
            const pointsDiff = Math.abs(conflictPlayer.points - candidate.points);
            const slotDiff = Math.abs(conflictIdx - ti);
            const poolDist = Math.abs(pi - pj);
            const cost = slotDiff * 1_000_000 + pointsDiff * 100 + poolDist;

            if (!bestSwap || cost < bestSwap.cost) {
              bestSwap = { targetPool: pj, targetIdx: ti, cost };
            }
          }
        }

        if (bestSwap) {
          // Effectue le swap
          const temp = pools[bestSwap.targetPool]![bestSwap.targetIdx]!;
          pools[bestSwap.targetPool]![bestSwap.targetIdx] = conflictPlayer;
          pool[conflictIdx] = temp;
          swapped = true;
        }
      }
    }

    if (!swapped) break; // Plus aucun conflit
  }
}

/** Trouve l'index du dernier joueur d'un club donné dans la poule (le plus faible). */
function findLastIndexByClub(pool: Player[], club: string): number {
  for (let i = pool.length - 1; i >= 0; i--) {
    if ((pool[i]!.club ?? '') === club) return i;
  }
  return -1;
}

export interface GeneratePoolsResult {
  bracketId: string;
  poolsCreated: number;
  matchesCreated: number;
}

export interface GenerateEliminationResult {
  bracketId: string;
  matchesCreated: number;
  rounds: number;
}

/**
 * Génère les poules pour un bracket : répartit les joueurs en poules de N joueurs
 * en équilibrant les niveaux (snake seeding), puis crée les matches dans l'ordre
 * I.301 et libellés.
 * @param bracketId - ID du bracket
 * @param requestedPoolSize - Taille de poule souhaitée (2, 3, 4 ou 5). Par défaut auto (4 ou 3).
 */
export async function generatePools(bracketId: string, requestedPoolSize?: number): Promise<GeneratePoolsResult> {
  const bracket = await prisma.bracket.findUnique({
    where: { id: bracketId },
    include: {
      registrations: {
        where: { isActive: true },
        include: { player: true },
      },
    },
  });
  if (!bracket) throw new Error('Bracket introuvable');

  const players: Player[] = bracket.registrations.map((r) => r.player);
  const byeLicences = (bracket.byePlayers || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const eligible = players.filter((p) => !byeLicences.includes(p.licenseNumber ?? ''));

  if (eligible.length < 2) {
    throw new Error('Au moins 2 joueurs nécessaires pour générer les poules');
  }

  // Tri par points décroissants pour le snake seeding ;
  // tiebreak : lastName alphabétique ascendant (convention FFTT/SPID).
  const sorted = [...eligible].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (a.lastName ?? '').localeCompare(b.lastName ?? '', 'fr', { sensitivity: 'base' });
  });

  // Détermine la taille de poule (2, 3 ou 4 — règle FFTT)
  const totalPlayers = sorted.length;
  const requested = requestedPoolSize && requestedPoolSize >= 2 && requestedPoolSize <= 4
    ? requestedPoolSize
    : null;
  const poolSize = requested
    ?? (totalPlayers % 4 === 0 ? 4 : totalPlayers % 3 === 0 ? 3 : 4);
  const numPools = Math.ceil(totalPlayers / poolSize);

  // Snake seeding : on alterne sens de remplissage à chaque "tour"
  const pools: Player[][] = Array.from({ length: numPools }, () => []);
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / numPools);
    const poolIdx = round % 2 === 0 ? i % numPools : numPools - 1 - (i % numPools);
    pools[poolIdx]!.push(sorted[i]!);
  }

  // ─── Contrainte « même club » : éviter 2 joueurs du même club dans la même poule ───
  separateClubs(pools);

  // Suppression des matches existants de poule pour ce bracket
  await prisma.match.deleteMany({ where: { bracketId, poolNumber: { not: null } } });

  let totalMatches = 0;
  for (let p = 0; p < pools.length; p++) {
    const poolPlayers = pools[p]!;
    if (poolPlayers.length < 2) continue;
    const order = ffttPoolMatchOrder(poolPlayers.length, bracket.poolQualifiers);
    for (let mi = 0; mi < order.length; mi++) {
      const [i, j] = order[mi]!;
      const a = poolPlayers[i];
      const b = poolPlayers[j];
      if (!a || !b) continue;
      await prisma.match.create({
        data: {
          bracketId,
          player1Id: a.id,
          player2Id: b.id,
          poolNumber: p + 1,
          poolMatchOrder: mi + 1,
          roundName: `Poule ${p + 1}`,
          roundNumber: 0,
        },
      });
      totalMatches++;
    }
  }

  return {
    bracketId,
    poolsCreated: pools.filter((pl) => pl.length >= 2).length,
    matchesCreated: totalMatches,
  };
}

/**
 * Génère le tableau d'élimination directe à partir des classements de poules.
 * Utilise ffttPlaceQualifiers (I.304-305) puis crée les matches du 1er tour.
 * Les rounds suivants sont créés au fur et à mesure (winners avancent).
 */
export async function generateElimination(bracketId: string): Promise<GenerateEliminationResult> {
  const bracket = await prisma.bracket.findUnique({ where: { id: bracketId } });
  if (!bracket) throw new Error('Bracket introuvable');

  // Récupère tous les matches de poule
  const poolMatches = await prisma.match.findMany({
    where: { bracketId, poolNumber: { not: null } },
  });

  // Charge les joueurs (points + nom) pour le tri par défaut
  // (utilisé en fallback quand aucun match n'est encore terminé : on classe
  //  par points FFTT pour ne pas dépendre de l'ordre d'insertion en base).
  const allPlayerIds = new Set<string>();
  for (const m of poolMatches) {
    if (m.player1Id) allPlayerIds.add(m.player1Id);
    if (m.player2Id) allPlayerIds.add(m.player2Id);
  }
  const playersData = allPlayerIds.size > 0
    ? await prisma.player.findMany({
        where: { id: { in: [...allPlayerIds] } },
        select: { id: true, points: true, lastName: true },
      })
    : [];
  const playerById = new Map(playersData.map((p) => [p.id, p]));

  // Groupe par poolNumber
  const byPool = new Map<number, Match[]>();
  for (const m of poolMatches) {
    if (m.poolNumber == null) continue;
    if (!byPool.has(m.poolNumber)) byPool.set(m.poolNumber, []);
    byPool.get(m.poolNumber)!.push(m);
  }

  // Calcule classement de chaque poule (en parcourant les poules par numéro
  // croissant pour que les standings soient en ordre naturel).
  const standings: PoolStanding[] = [];
  const poolNums = [...byPool.keys()].sort((a, b) => a - b);
  for (const poolNum of poolNums) {
    const matches = byPool.get(poolNum)!;
    const poolPlayerIds = new Set<string>();
    for (const m of matches) {
      if (m.player1Id) poolPlayerIds.add(m.player1Id);
      if (m.player2Id) poolPlayerIds.add(m.player2Id);
    }
    // Tri par points FFTT décroissants (sert d'ordre stable initial pour
    // ffttPoolRanking : si aucun match n'est terminé, le ranking final = cet
    // ordre par points). Tiebreak alphabétique sur lastName.
    const sortedIds = [...poolPlayerIds].sort((a, b) => {
      const pa = playerById.get(a)?.points ?? 0;
      const pb = playerById.get(b)?.points ?? 0;
      if (pb !== pa) return pb - pa;
      const la = playerById.get(a)?.lastName ?? '';
      const lb = playerById.get(b)?.lastName ?? '';
      return la.localeCompare(lb, 'fr', { sensitivity: 'base' });
    });

    const ranking = ffttPoolRanking(
      matches.map((m) => ({
        player1Id: m.player1Id ?? '',
        player2Id: m.player2Id ?? '',
        status: m.status,
        winnerId: m.winnerId,
        setsP1: m.setsP1,
        setsP2: m.setsP2,
      })),
      sortedIds,
    );
    standings.push({ poolName: `Poule ${poolNum}`, ranking });
  }

  // Récupère les bye players (par licence)
  const byeLicences = (bracket.byePlayers || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const byePlayers = byeLicences.length
    ? await prisma.player.findMany({ where: { licenseNumber: { in: byeLicences } } })
    : [];
  const byeIds = byePlayers.map((p) => p.id);

  const ordered = ffttPlaceQualifiers(standings, Math.max(bracket.poolQualifiers, 2), byeIds);

  // Le tableau positionnel a une taille = puissance de 2 (avec nulls pour les byes)
  const nextPower = ordered.length;
  if (nextPower < 2) {
    return { bracketId, matchesCreated: 0, rounds: 0 };
  }

  // Vérifie qu'il y a au moins 2 vrais joueurs
  const realPlayers = ordered.filter((x) => x !== null);
  if (realPlayers.length < 2) {
    return { bracketId, matchesCreated: 0, rounds: 0 };
  }

  // Suppression des matches d'élimination précédents (poolNumber=null)
  await prisma.matchEvent.deleteMany({
    where: { match: { bracketId, poolNumber: null } },
  });
  await prisma.match.deleteMany({ where: { bracketId, poolNumber: null } });

  // ─── Génération du tableau d'élimination FFTT/SPID-compatible ─────────────
  // Convention : le tableau est dimensionné à `nextPower` (plus petite
  // puissance de 2 ≥ nombre de qualifiés). Les positions vides (joueurs non
  // attribués) sont gérées en interne : aucun "match-fantôme" n'est créé en
  // base de données, le terme "bye" ne doit jamais apparaître.
  //
  // Exemple : Q = 20 → nextPower = 32, tableau de 32.
  //   - 1er tour ("1/16ème de finale") : seulement 4 vrais matchs (rangs 13-20)
  //   - 2e tour ("1/8ème de finale") : 8 matchs ; 12 qualifiés sont placés
  //     directement (positions vides du 1er tour) + 4 placeholders pour les
  //     vainqueurs des matchs du 1er tour
  //   - 1/4, 1/2, Finale : placeholders vides
  //
  // Le nom du tour est dérivé de la taille du tableau (nextPower).
  const totalRounds = Math.max(1, Math.log2(nextPower));
  const roundName = (roundIdx: number): string => {
    const remaining = totalRounds - roundIdx;
    if (remaining <= 1) return 'Finale';
    if (remaining === 2) return 'Demi-finale';
    if (remaining === 3) return 'Quart de finale';
    if (remaining === 4) return '8ème de finale';
    if (remaining === 5) return '16ème de finale';
    if (remaining === 6) return '32ème de finale';
    if (remaining === 7) return '64ème de finale';
    if (remaining === 8) return '128ème de finale';
    return `Tour ${roundIdx + 1}`;
  };

  let matchesCreated = 0;

  // ─── Construction des entrées du 1er tour (sans les créer en base)
  // Chaque entrée correspond à une paire (positions 2k, 2k+1) du tableau :
  //   - 2 joueurs : match réel à jouer
  //   - 1 joueur : ce joueur passe directement au tour suivant
  //   - 0 joueur : entrée vide (pas d'avancement)
  type R1Entry =
    | { kind: 'real'; a: string; b: string }
    | { kind: 'pass'; winner: string }
    | { kind: 'empty' };
  const round1: R1Entry[] = [];
  for (let i = 0; i < nextPower; i += 2) {
    const a = ordered[i] ?? null;
    const b = ordered[i + 1] ?? null;
    if (a && b) round1.push({ kind: 'real', a, b });
    else if (a || b) round1.push({ kind: 'pass', winner: (a ?? b)! });
    else round1.push({ kind: 'empty' });
  }

  // ─── Round 2 (1er tour du tableau principal post-byes) : nextPower/4 matchs
  // Chaque match k regroupe les vainqueurs des entrées round1[2k] et round1[2k+1].
  //   - kind 'pass' → joueur placé directement (slot rempli)
  //   - kind 'real' → slot null, auto-avance le remplira au /finish
  //   - kind 'empty' → slot null
  const round2Slots: { p1: string | null; p2: string | null }[] = [];
  for (let k = 0; k < nextPower / 4; k++) {
    const ra = round1[2 * k];
    const rb = round1[2 * k + 1];
    const p1 = ra?.kind === 'pass' ? ra.winner : null;
    const p2 = rb?.kind === 'pass' ? rb.winner : null;
    round2Slots.push({ p1, p2 });
  }

  // Crée les matchs du round 2 en base
  for (let k = 0; k < round2Slots.length; k++) {
    const { p1, p2 } = round2Slots[k]!;
    await prisma.match.create({
      data: {
        bracketId,
        player1Id: p1,
        player2Id: p2,
        roundName: roundName(1),
        roundNumber: 2,
        poolMatchOrder: k + 1,
      },
    });
    matchesCreated++;
  }

  // ─── Round 1 : seulement les vrais matchs (kind 'real')
  // poolMatchOrder = position 1-indexée dans le bracket (sparse) ;
  // permet à l'auto-avance de calculer correctement le slot du round 2.
  for (let r1Idx = 0; r1Idx < round1.length; r1Idx++) {
    const entry = round1[r1Idx]!;
    if (entry.kind !== 'real') continue;
    await prisma.match.create({
      data: {
        bracketId,
        player1Id: entry.a,
        player2Id: entry.b,
        roundName: roundName(0),
        roundNumber: 1,
        poolMatchOrder: r1Idx + 1, // position dans le bracket (sparse)
      },
    });
    matchesCreated++;
  }

  // ─── Rounds 3+ : placeholders vides, l'auto-avance propage les vainqueurs
  for (let roundIdx = 2; roundIdx < totalRounds; roundIdx++) {
    const roundSize = nextPower / Math.pow(2, roundIdx + 1);
    for (let k = 0; k < roundSize; k++) {
      await prisma.match.create({
        data: {
          bracketId,
          player1Id: null,
          player2Id: null,
          roundName: roundName(roundIdx),
          roundNumber: roundIdx + 1,
          poolMatchOrder: k + 1,
        },
      });
      matchesCreated++;
    }
  }

  return { bracketId, matchesCreated, rounds: totalRounds };
}
