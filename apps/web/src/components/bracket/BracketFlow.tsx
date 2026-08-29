'use client';

/**
 * BracketFlow — tableau final sur un canevas React Flow.
 *
 * Même géométrie et même cellule FFTT que le rendu historique
 * (`BracketTree`) : seule la surface de rendu change. On y gagne un fond
 * pointillé, des connecteurs coudés plus lisibles, et surtout la sélection d'un
 * parcours au clic.
 *
 * Deux partis pris, tirés de l'usage :
 *
 *   - **Taille réelle à l'ouverture.** Pas de recadrage automatique : sur un
 *     tableau de 32 ou 64 places, l'ajustement à la hauteur de l'écran réduisait
 *     tellement les cartes que ni les noms ni les états ne se lisaient. Le
 *     canevas prend donc la hauteur exacte du tableau et la page défile, comme
 *     n'importe quel autre contenu.
 *   - **Aucune commande de zoom.** Elles n'apportaient rien face au défilement
 *     de la page. Le déplacement latéral se fait en attrapant le fond.
 *
 * Les liaisons ne sont PAS des edges React Flow : elles sont tracées à la main
 * dans un <svg> placé par `ViewportPortal`, donc exprimées dans le repère du
 * canevas. Les edges auraient exigé des `Handle` sur chaque carte et un routage
 * orthogonal maison — pour un tracé déjà entièrement calculé par
 * `layoutBracket`.
 */

import { createContext, useContext, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Panel,
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
/** Marge de déplacement autour du tableau. */
const MARGIN_X = 160;
const MARGIN_Y = 40;

/* Le gestionnaire de sélection passe par un contexte plutôt que par `data` :
   le placer dans `data` obligerait à recréer chaque nœud à chaque rendu. */
interface FocusApi {
  focusId: string | null;
  select: (playerId: string) => void;
}
const FocusContext = createContext<FocusApi>({ focusId: null, select: () => {} });

interface MatchNodeData extends Record<string, unknown> {
  match: BracketTreeMatch;
  highlightWinner: boolean;
  mine: boolean;
  dim: boolean;
}

function MatchNode({ data }: NodeProps) {
  const d = data as MatchNodeData;
  const { focusId, select } = useContext(FocusContext);
  return (
    <div style={{ width: COL_W }} data-testid={`bracket-match-${d.match.id}`}>
      <MatchCard
        match={d.match}
        highlightWinner={d.highlightWinner}
        live
        mine={d.mine}
        dim={d.dim}
        onSelectPlayer={select}
        focusPlayerId={focusId}
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
   * Parcours mis en relief à l'ouverture : TOUS les matches du joueur — joués,
   * en cours et à venir — les autres estompés. Le clic sur n'importe quel nom
   * change ensuite de parcours.
   */
  minePlayerId?: string | null;
  /** Force la hauteur du canevas. Par défaut, celle du tableau. */
  height?: number | string;
  minZoom?: number;
  maxZoom?: number;
}

export function BracketFlow({
  matches,
  highlightWinner = true,
  minePlayerId,
  height,
  minZoom = 0.4,
  maxZoom = 1.6,
}: BracketFlowProps) {
  const [focusId, setFocusId] = useState<string | null>(minePlayerId ?? null);

  const { nodes, wiresD, mineWiresD, labels, extent, totalH, focusName } = useMemo(() => {
    const layout = layoutBracket(matches);
    const mineIds = minePathIds(matches, focusId);
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

    const extent: [[number, number], [number, number]] = [
      [-MARGIN_X, -MARGIN_Y],
      [layout.totalW + MARGIN_X, layout.totalH + MARGIN_Y],
    ];

    // Nom du joueur suivi, pour l'étiquette qui permet de tout réafficher.
    let focusName: string | null = null;
    if (focusId) {
      for (const m of matches) {
        const p =
          m.player1?.id === focusId ? m.player1 : m.player2?.id === focusId ? m.player2 : null;
        if (p) {
          focusName = `${p.lastName} ${p.firstName}`;
          break;
        }
      }
    }

    return { nodes: ns, wiresD, mineWiresD, labels, extent, totalH: layout.totalH, focusName };
  }, [matches, focusId, highlightWinner]);

  const focusApi = useMemo<FocusApi>(
    () => ({
      focusId,
      // Recliquer sur le joueur suivi remet le tableau entier en avant.
      select: (playerId: string) => setFocusId((cur) => (cur === playerId ? null : playerId)),
    }),
    [focusId],
  );

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
      className={`${s.root} w-full`}
      style={{ height: height ?? totalH }}
    >
      <FocusContext.Provider value={focusApi}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          /* Taille réelle à l'ouverture, cadrée en haut à gauche. */
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={minZoom}
          maxZoom={maxZoom}
          translateExtent={extent}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          /* L'arbre est un bloc au milieu d'une page qui défile : la molette
             doit faire défiler la page, pas zoomer le canevas. */
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
          {focusName && (
            <Panel position="top-right">
              <button
                type="button"
                onClick={() => setFocusId(null)}
                className="min-h-0 text-xs px-3 py-1.5 bg-primary text-primary-fg shadow-sm"
              >
                Parcours de {focusName} — tout afficher
              </button>
            </Panel>
          )}
        </ReactFlow>
      </FocusContext.Provider>
    </div>
  );
}
