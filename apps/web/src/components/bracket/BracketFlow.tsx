'use client';

/**
 * BracketFlow — tableau final sur un canevas React Flow.
 *
 * Même géométrie et même cellule FFTT que le rendu historique
 * (`BracketTree`) : seule la surface de rendu change. On y gagne un fond
 * pointillé, des connecteurs coudés plus lisibles, la mise en relief du
 * parcours d'un joueur, et le déplacement/zoom qu'impose un tableau de 64
 * places sur un écran de portable.
 *
 * Les liaisons ne sont PAS des edges React Flow : elles sont tracées à la main
 * dans un <svg> placé par `ViewportPortal`, donc exprimées dans le repère du
 * canevas. Les edges auraient exigé des `Handle` sur chaque carte et un
 * routage orthogonal maison — pour un tracé qui est déjà entièrement calculé
 * par `layoutBracket`.
 */

import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ViewportPortal,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  COL_W,
  columnX,
  computeRoundLabel,
  connectorPath,
  layoutBracket,
  minePathIds,
  type BracketTreeMatch,
} from '@/lib/bracket-layout';
import { MatchCard } from './MatchCard';
import s from './BracketFlow.module.css';

/** Trait des liaisons ordinaires — identique au rendu historique (slate-300). */
const WIRE = 'rgb(203 213 225)';
/** Trait du parcours suivi — accent de la charte (primary). */
const WIRE_MINE = '#0284C7';
/** Pointillés du fond, assez discrets pour ne pas concurrencer les liaisons. */
const DOTS = '#CBD5E1';
/** Marge autour du tableau au-delà de laquelle le déplacement est bloqué. */
const EXTENT_MARGIN = 320;

interface MatchNodeData extends Record<string, unknown> {
  match: BracketTreeMatch;
  highlightWinner: boolean;
  mine: boolean;
  dim: boolean;
}

function MatchNode({ data }: NodeProps) {
  const d = data as MatchNodeData;
  return (
    <div style={{ width: COL_W }} data-testid={`bracket-match-${d.match.id}`}>
      <MatchCard
        match={d.match}
        highlightWinner={d.highlightWinner}
        live
        mine={d.mine}
        dim={d.dim}
      />
    </div>
  );
}

/* Défini hors du composant : une nouvelle référence à chaque rendu ferait
   remonter React Flow tous ses nœuds. */
const nodeTypes = { match: MatchNode };

export interface BracketFlowProps {
  matches: BracketTreeMatch[];
  highlightWinner?: boolean;
  /**
   * Joueur dont on suit le parcours : TOUS ses matches sont mis en relief —
   * joués, en cours et à venir — et les autres sont atténués. Sur un tableau de
   * 64 places, on cherche sa propre ligne, pas n'importe quel match vivant.
   */
  minePlayerId?: string | null;
  /** Commandes zoom/recadrage de React Flow. */
  controls?: boolean;
  /** Hauteur du canevas. React Flow exige une hauteur explicite. */
  height?: number | string;
  minZoom?: number;
  maxZoom?: number;
  fitPadding?: number;
}

export function BracketFlow({
  matches,
  highlightWinner = true,
  minePlayerId,
  controls = true,
  height = '70vh',
  minZoom = 0.25,
  maxZoom = 2,
  fitPadding = 0.12,
}: BracketFlowProps) {
  const { nodes, wiresD, mineWiresD, labels, extent } = useMemo(() => {
    const layout = layoutBracket(matches);
    const mineIds = minePathIds(matches, minePlayerId);
    const following = mineIds.size > 0;

    const ns: Node[] = layout.nodes.map((n) => ({
      id: n.match.id,
      type: 'match',
      position: { x: n.x, y: n.y },
      data: {
        match: n.match,
        highlightWinner,
        mine: mineIds.has(n.match.id),
        dim: following && !mineIds.has(n.match.id),
      } satisfies MatchNodeData,
      width: n.w,
      height: n.h,
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
    }));

    // Les liaisons du parcours sont tracées à part, par-dessus : « jusqu'où je
    // suis allé » se lit aux traits autant qu'aux cartes.
    const isMineWire = (fromId: string, toId: string) => mineIds.has(fromId) && mineIds.has(toId);
    const wiresD = layout.connectors
      .filter((c) => !isMineWire(c.fromId, c.toId))
      .map(connectorPath)
      .join(' ');
    const mineWiresD = layout.connectors
      .filter((c) => isMineWire(c.fromId, c.toId))
      .map(connectorPath)
      .join(' ');

    const labels = layout.columns.map((_, r) => ({
      round: r,
      x: columnX(r),
      text: computeRoundLabel(r, layout.totalRounds),
    }));

    // Bornes de déplacement : on ne doit pas pouvoir emmener le tableau hors
    // de vue et se retrouver devant un canevas vide.
    const extent: [[number, number], [number, number]] = [
      [-EXTENT_MARGIN, -EXTENT_MARGIN],
      [layout.totalW + EXTENT_MARGIN, layout.totalH + EXTENT_MARGIN],
    ];

    return { nodes: ns, wiresD, mineWiresD, labels, extent };
  }, [matches, minePlayerId, highlightWinner]);

  if (matches.length === 0) {
    return (
      <div
        className="card text-center py-12 text-foreground-muted rounded-2xl"
        data-testid="bracket-empty"
      >
        Tableau final non encore généré.
      </div>
    );
  }

  return (
    <div
      data-testid="bracket-tree"
      className={`${s.root} w-full overflow-hidden rounded-2xl border border-border bg-surface`}
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: fitPadding }}
        minZoom={minZoom}
        maxZoom={maxZoom}
        translateExtent={extent}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        /* L'arbre est un bloc au milieu d'une page qui défile : la molette doit
           faire défiler la page, pas zoomer le canevas. Le zoom reste accessible
           au pincement, au Ctrl+molette et par les commandes. */
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <ViewportPortal>
          <svg
            className={s.wires}
            width={1}
            height={1}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            {wiresD && <path d={wiresD} fill="none" stroke={WIRE} strokeWidth={1.5} />}
            {mineWiresD && <path d={mineWiresD} fill="none" stroke={WIRE_MINE} strokeWidth={3} />}
          </svg>
          {labels.map((l) => (
            <div
              key={l.round}
              className="absolute text-[11px] uppercase tracking-wider font-semibold text-foreground-muted text-center pointer-events-none select-none"
              style={{ left: l.x, top: 0, width: COL_W }}
            >
              {l.text}
            </div>
          ))}
        </ViewportPortal>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={DOTS} />
        {controls && <Controls showInteractive={false} />}
      </ReactFlow>
    </div>
  );
}
