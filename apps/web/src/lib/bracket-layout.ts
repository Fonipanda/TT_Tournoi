/**
 * Géométrie du tableau d'élimination directe — TypeScript pur, sans React.
 *
 * Ce module est la source de vérité unique des positions : le rendu classique
 * (`BracketTree`, divs absolus) et le rendu React Flow (`BracketFlow`) le
 * consomment tous les deux. Les faire diverger reviendrait à afficher deux
 * tableaux différents pour un même tirage, ce qu'un juge-arbitre ne pardonne pas.
 *
 * Convention de données (voir `generateElimination` dans lib/fftt/engine.ts) :
 *   - `roundNumber` : 1 = premier tour, croissant vers la finale (0 = poule)
 *   - `poolMatchOrder` : position dans le tour, 1-based, de haut en bas
 *   - un « passage direct » est un match terminé avec un seul joueur : la
 *     seconde ligne reste vide, le mot « bye » n'apparaît jamais.
 */

export interface PlayerLite {
  id: string;
  firstName: string;
  lastName: string;
  club?: string | null;
}

export interface BracketTreeMatch {
  id: string;
  roundNumber: number;
  roundName?: string | null;
  poolMatchOrder?: number | null;
  player1?: PlayerLite | null;
  player2?: PlayerLite | null;
  winner?: PlayerLite | null;
  status: 'waiting' | 'in_progress' | 'finished' | 'blocked';
  setsP1: number;
  setsP2: number;
  sets?: { p1: number; p2: number }[] | null;
}

// ─── Constantes de mise en page (style Roland-Garros / FFTT) ─────────────────
// Ces valeurs sont partagées par les deux rendus : les modifier déplace les
// deux tableaux ensemble.
export const COL_W = 280;
export const COL_GAP = 56;
/** Toutes les cellules font 2 lignes, y compris les passages directs. */
export const MATCH_H = 64;
export const LABEL_H = 36;
export const BASE_GAP = 10;

export interface LayoutNode {
  match: BracketTreeMatch;
  /** Index de tour, 0-based (colonne). */
  round: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutConnector {
  fromId: string;
  toId: string;
  /** Ligne brisée orthogonale (locale au repère du tableau). */
  points: { x: number; y: number }[];
}

export interface BracketLayout {
  /** Matches groupés par tour, triés par `poolMatchOrder`. */
  columns: BracketTreeMatch[][];
  /** Centres Y par tour, alignés sur `columns`. */
  centers: number[][];
  nodes: LayoutNode[];
  connectors: LayoutConnector[];
  totalRounds: number;
  totalW: number;
  totalH: number;
}

/** Abscisse gauche d'une colonne de tour (0-based). */
export function columnX(round: number): number {
  return round * (COL_W + COL_GAP);
}

/**
 * Calcule la position de chaque match et les connecteurs coudés qui les relient.
 *
 * Le premier tour est empilé depuis le haut ; chaque match des tours suivants
 * est centré sur le milieu de ses deux alimentateurs. Un tour incomplet (dernier
 * alimentateur absent) retombe sur l'alimentateur unique plutôt que de dériver
 * vers le haut du tableau.
 */
export function layoutBracket(matches: BracketTreeMatch[]): BracketLayout {
  // 1. Groupement par tour, ordre déterministe par poolMatchOrder
  const byRound = new Map<number, BracketTreeMatch[]>();
  for (const m of matches) {
    const r = m.roundNumber || 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  }
  for (const arr of byRound.values()) {
    arr.sort((a, b) => (a.poolMatchOrder ?? 0) - (b.poolMatchOrder ?? 0));
  }

  const totalRounds = byRound.size > 0 ? Math.max(...byRound.keys()) : 0;
  const columns: BracketTreeMatch[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    columns.push(byRound.get(r) ?? []);
  }

  if (columns.length === 0) {
    return {
      columns,
      centers: [],
      nodes: [],
      connectors: [],
      totalRounds: 0,
      totalW: 0,
      totalH: 0,
    };
  }

  // 2. Centres Y — premier tour empilé
  const centers: number[][] = [];
  const r1Centers: number[] = [];
  let y = LABEL_H;
  for (let i = 0; i < columns[0]!.length; i++) {
    r1Centers.push(y + MATCH_H / 2);
    y += MATCH_H + (i < columns[0]!.length - 1 ? BASE_GAP : 0);
  }
  centers.push(r1Centers);

  // 3. Tours suivants — milieu des deux alimentateurs
  for (let r = 1; r < columns.length; r++) {
    const prev = centers[r - 1]!;
    const cur: number[] = [];
    const colSize = columns[r]!.length;
    for (let i = 0; i < colSize; i++) {
      const a = prev[i * 2] ?? prev[prev.length - 1] ?? 0;
      const b = i * 2 + 1 < prev.length ? prev[i * 2 + 1]! : a;
      cur.push((a + b) / 2);
    }
    centers.push(cur);
  }

  // 4. Boîtes
  const nodes: LayoutNode[] = [];
  for (let r = 0; r < columns.length; r++) {
    const col = columns[r]!;
    for (let i = 0; i < col.length; i++) {
      nodes.push({
        match: col[i]!,
        round: r,
        x: columnX(r),
        y: centers[r]![i]! - MATCH_H / 2,
        w: COL_W,
        h: MATCH_H,
      });
    }
  }

  // 5. Connecteurs : chaque alimentateur rejoint un coude à mi-distance, puis
  //    le coude descend (ou monte) vers l'entrée du match suivant.
  const connectors: LayoutConnector[] = [];
  for (let r = 0; r < columns.length - 1; r++) {
    const leftX = columnX(r) + COL_W;
    const rightX = columnX(r + 1);
    const midX = (leftX + rightX) / 2;
    const prevC = centers[r]!;
    const nextC = centers[r + 1]!;
    const prevCol = columns[r]!;
    const nextCol = columns[r + 1]!;

    for (let m = 0; m < nextCol.length; m++) {
      const target = nextCol[m]!;
      const yOut = nextC[m]!;
      const i1 = m * 2;
      const i2 = m * 2 + 1;
      const y1 = prevC[i1] ?? null;
      const y2 = i2 < prevC.length ? prevC[i2]! : null;
      if (y1 === null) continue;
      const yMid = y2 !== null ? (y1 + y2) / 2 : y1;

      // Alimentateur haut → coude → entrée du match
      connectors.push({
        fromId: prevCol[i1]?.id ?? '',
        toId: target.id,
        points: [
          { x: leftX, y: y1 },
          { x: midX, y: y1 },
          { x: midX, y: yMid },
          { x: midX, y: yOut },
          { x: rightX, y: yOut },
        ],
      });

      // Alimentateur bas → même coude → même entrée
      if (y2 !== null) {
        connectors.push({
          fromId: prevCol[i2]?.id ?? '',
          toId: target.id,
          points: [
            { x: leftX, y: y2 },
            { x: midX, y: y2 },
            { x: midX, y: yMid },
            { x: midX, y: yOut },
            { x: rightX, y: yOut },
          ],
        });
      }
    }
  }

  const lastRound = centers[centers.length - 1] ?? [];
  const lastY = lastRound.length > 0 ? lastRound[lastRound.length - 1]! : LABEL_H;
  const totalH = Math.max(
    lastY + MATCH_H / 2 + 16,
    (r1Centers[r1Centers.length - 1] ?? 0) + MATCH_H / 2 + 16,
  );
  const totalW = totalRounds * (COL_W + COL_GAP) - COL_GAP;

  return { columns, centers, nodes, connectors, totalRounds, totalW, totalH };
}

/** Chemin SVG d'un connecteur (`M x y L x y …`). */
export function connectorPath(c: LayoutConnector): string {
  return c.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
}

/**
 * Libellé d'un tour à partir de son index 0-based et du nombre total de tours.
 * Vocabulaire FFTT français : Finale, Demi-finale, Quart de finale, 8ème…
 */
export function computeRoundLabel(roundIdx: number, totalRounds: number): string {
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
}

/**
 * Un « passage direct » : match déjà acquis faute d'adversaire. La ligne de
 * l'adversaire absent reste vide — le mot « bye » n'est jamais affiché.
 */
export function isPassMatch(m: BracketTreeMatch): boolean {
  return m.status === 'finished' && !!m.winner && (!m.player1 || !m.player2);
}

/** Identifiants des matches où le joueur apparaît : son parcours complet. */
export function minePathIds(
  matches: BracketTreeMatch[],
  playerId: string | null | undefined,
): Set<string> {
  if (!playerId) return new Set();
  const ids = new Set<string>();
  for (const m of matches) {
    if (m.player1?.id === playerId || m.player2?.id === playerId) ids.add(m.id);
  }
  return ids;
}
