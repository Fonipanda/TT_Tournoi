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
}

/**
 * Calcule le classement final d'une poule selon I.303.
 * V = 2 pts, D = 1 pt, absent/forfait = 0 pt (pris en charge si winner=null).
 * Départage : confrontation directe → quotient sets (2 ex-aequo).
 */
export function ffttPoolRanking(
  poolMatches: PoolMatchInput[],
  playersInPool: string[],
): string[] {
  const pts: Record<string, number> = {};
  const setsW: Record<string, number> = {};
  const setsL: Record<string, number> = {};
  const direct: Record<string, string> = {};

  for (const pid of playersInPool) {
    pts[pid] = 0;
    setsW[pid] = 0;
    setsL[pid] = 0;
  }

  for (const m of poolMatches) {
    const p1 = m.player1Id;
    const p2 = m.player2Id;
    if (m.status === 'finished' && m.winnerId) {
      const w = m.winnerId;
      const lo = w === p1 ? p2 : p1;
      pts[w] = (pts[w] ?? 0) + 2;
      pts[lo] = (pts[lo] ?? 0) + 1;
      direct[`${p1}|${p2}`] = w;
      direct[`${p2}|${p1}`] = w;
    }
    setsW[p1] = (setsW[p1] ?? 0) + (m.setsP1 ?? 0);
    setsL[p1] = (setsL[p1] ?? 0) + (m.setsP2 ?? 0);
    setsW[p2] = (setsW[p2] ?? 0) + (m.setsP2 ?? 0);
    setsL[p2] = (setsL[p2] ?? 0) + (m.setsP1 ?? 0);
  }

  function sortKey(pid: string): [number, number] {
    const sw = setsW[pid] ?? 0;
    const sl = setsL[pid] ?? 0;
    const quotient = sl > 0 ? sw / sl : sw > 0 ? sw * 100 : 0;
    return [pts[pid] ?? 0, quotient];
  }

  function compareKeys(a: [number, number], b: [number, number]): number {
    if (b[0] !== a[0]) return b[0] - a[0];
    return b[1] - a[1];
  }

  const ranking = [...playersInPool].sort((a, b) => compareKeys(sortKey(a), sortKey(b)));

  // Départage par confrontation directe pour les paires d'ex-aequo
  let i = 0;
  while (i < ranking.length - 1) {
    let j = i + 1;
    while (j < ranking.length && compareKeys(sortKey(ranking[j]!), sortKey(ranking[i]!)) === 0) {
      j++;
    }
    if (j - i === 2) {
      const p1 = ranking[i]!;
      const p2 = ranking[i + 1]!;
      const winner = direct[`${p1}|${p2}`];
      if (winner === p2) {
        ranking[i] = p2;
        ranking[i + 1] = p1;
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
 * Place les qualifiés de poules + les bye_players dans un tableau d'élimination.
 * Retourne la liste ordonnée des player IDs aux positions du bracket
 * (positions vides supprimées).
 */
export function ffttPlaceQualifiers(
  poolStandings: PoolStanding[],
  qualifiersPerPool: number,
  byeIds: string[],
): string[] {
  const sortedStandings = [...poolStandings].sort((a, b) => a.poolName.localeCompare(b.poolName));

  const firsts: string[] = [];
  const seconds: string[] = [];
  const thirds: string[] = [];

  for (const ps of sortedStandings) {
    if (ps.ranking[0]) firsts.push(ps.ranking[0]);
    if (ps.ranking[1] && qualifiersPerPool >= 2) seconds.push(ps.ranking[1]);
    if (ps.ranking[2] && qualifiersPerPool >= 3) thirds.push(ps.ranking[2]);
  }

  const allQualified = [...byeIds, ...firsts, ...seconds, ...thirds];
  const n = allQualified.length;
  if (n < 2) return allQualified;

  let nextPower = 1;
  while (nextPower < n) nextPower *= 2;

  const seedAtPos = ffttSeedingPositions(nextPower);
  const posForSeed = new Map<number, number>();
  for (let i = 0; i < seedAtPos.length; i++) {
    posForSeed.set(seedAtPos[i]!, i);
  }

  const ordered: (string | null)[] = new Array(nextPower).fill(null);

  // Mélange par groupes de seeds (1-2 fixes, 3-4 random, 5-8 random, etc.)
  const allSeeds = Array.from({ length: byeIds.length + firsts.length }, (_, i) => i + 1);
  const seedGroups: Pair[] = [
    [0, 2], [2, 4], [4, 8], [8, 16], [16, 32], [32, 64],
  ];
  const shuffledSeeds: number[] = [];
  for (const [start, end] of seedGroups) {
    const group = allSeeds.filter((s) => s > start && s <= end);
    if (start === 0) {
      shuffledSeeds.push(...group);
    } else {
      shuffledSeeds.push(...shuffle(group));
    }
  }
  const placedSeeds = shuffledSeeds.slice(0, byeIds.length + firsts.length);

  const firstPlayers = [...byeIds, ...firsts];
  for (let idx = 0; idx < placedSeeds.length; idx++) {
    const seedNum = placedSeeds[idx]!;
    if (idx < firstPlayers.length && seedNum <= nextPower) {
      const pos = posForSeed.get(seedNum) ?? idx;
      if (pos < nextPower) ordered[pos] = firstPlayers[idx]!;
    }
  }

  // Placement des 2èmes en demi-tableau opposé de leur 1er respectif
  if (qualifiersPerPool >= 2) {
    const half = nextPower / 2;
    for (let secIdx = 0; secIdx < seconds.length; secIdx++) {
      const secPid = seconds[secIdx]!;
      const firstPid = firsts[secIdx];
      if (firstPid) {
        const firstPos = ordered.indexOf(firstPid);
        if (firstPos !== -1) {
          const targetHalf = firstPos < half ? 1 : 0;
          const start = targetHalf * half;
          const end = start + half;
          let placed = false;
          for (let p = start; p < end; p++) {
            if (ordered[p] === null) {
              ordered[p] = secPid;
              placed = true;
              break;
            }
          }
          if (!placed) {
            for (let p = 0; p < nextPower; p++) {
              if (ordered[p] === null) {
                ordered[p] = secPid;
                break;
              }
            }
          }
        }
      } else {
        for (let p = 0; p < nextPower; p++) {
          if (ordered[p] === null) {
            ordered[p] = secPid;
            break;
          }
        }
      }
    }
  }

  // Placement des 3èmes (s'il y en a) dans les positions restantes
  for (const pid of thirds) {
    for (let p = 0; p < nextPower; p++) {
      if (ordered[p] === null) {
        ordered[p] = pid;
        break;
      }
    }
  }

  return ordered.filter((x): x is string => x !== null);
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
 * Génère les poules pour un bracket : répartit les joueurs en poules de 3-4 joueurs
 * en équilibrant les niveaux (snake seeding), puis crée les matches dans l'ordre
 * I.301 et libellés.
 */
export async function generatePools(bracketId: string): Promise<GeneratePoolsResult> {
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

  if (eligible.length < 3) {
    throw new Error('Au moins 3 joueurs nécessaires pour générer les poules');
  }

  // Tri par points décroissants pour le snake seeding
  const sorted = [...eligible].sort((a, b) => b.points - a.points);

  // Détermine la taille de poule (priorité 4, sinon 3, max 6)
  const totalPlayers = sorted.length;
  const poolSize = totalPlayers % 4 === 0 ? 4 : totalPlayers % 3 === 0 ? 3 : 4;
  const numPools = Math.ceil(totalPlayers / poolSize);

  // Snake seeding : on alterne sens de remplissage à chaque "tour"
  const pools: Player[][] = Array.from({ length: numPools }, () => []);
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / numPools);
    const poolIdx = round % 2 === 0 ? i % numPools : numPools - 1 - (i % numPools);
    pools[poolIdx]!.push(sorted[i]!);
  }

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

  // Groupe par poolNumber
  const byPool = new Map<number, Match[]>();
  for (const m of poolMatches) {
    if (m.poolNumber == null) continue;
    if (!byPool.has(m.poolNumber)) byPool.set(m.poolNumber, []);
    byPool.get(m.poolNumber)!.push(m);
  }

  // Calcule classement de chaque poule
  const standings: PoolStanding[] = [];
  for (const [poolNum, matches] of byPool) {
    const playerIds = new Set<string>();
    for (const m of matches) {
      if (m.player1Id) playerIds.add(m.player1Id);
      if (m.player2Id) playerIds.add(m.player2Id);
    }
    const ranking = ffttPoolRanking(
      matches.map((m) => ({
        player1Id: m.player1Id ?? '',
        player2Id: m.player2Id ?? '',
        status: m.status,
        winnerId: m.winnerId,
        setsP1: m.setsP1,
        setsP2: m.setsP2,
      })),
      [...playerIds],
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

  const ordered = ffttPlaceQualifiers(standings, bracket.poolQualifiers, byeIds);

  if (ordered.length < 2) {
    return { bracketId, matchesCreated: 0, rounds: 0 };
  }

  // Suppression des matches d'élimination précédents (poolNumber=null)
  await prisma.match.deleteMany({ where: { bracketId, poolNumber: null } });

  // Crée les matches du 1er tour : (1 vs N), (2 vs N-1) etc.
  const n = ordered.length;
  let nextPower = 1;
  while (nextPower < n) nextPower *= 2;

  const rounds = Math.ceil(Math.log2(nextPower));
  const roundName = (i: number, total: number): string => {
    const remaining = total - i;
    if (remaining === 1) return 'Finale';
    if (remaining === 2) return 'Demi-finale';
    if (remaining === 3) return 'Quart de finale';
    if (remaining === 4) return '8ème de finale';
    if (remaining === 5) return '16ème de finale';
    return `Tour ${i + 1}`;
  };

  let matchesCreated = 0;
  for (let i = 0; i < nextPower; i += 2) {
    const a = ordered[i] ?? null;
    const b = ordered[i + 1] ?? null;
    // Si l'un est manquant (taille non puissance de 2), match avec winner direct
    await prisma.match.create({
      data: {
        bracketId,
        player1Id: a,
        player2Id: b,
        roundName: roundName(0, rounds),
        roundNumber: 1,
      },
    });
    matchesCreated++;
  }

  return { bracketId, matchesCreated, rounds };
}
