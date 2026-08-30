import { prisma } from '@tt/db';
import Link from 'next/link';
import { BracketView } from '@/components/bracket/BracketView';
import { ProgressionToggle } from '@/components/ProgressionToggle';
import { getCurrentUser } from '@/lib/auth/server';
import { type BracketTreeMatch } from '@/lib/bracket-layout';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export default async function ProgressionDetailPage({ params }: Params) {
  const { id } = await params;
  // Le visiteur connecté voit son propre parcours mis en relief ; un visiteur
  // anonyme obtient le tableau neutre.
  const me = await getCurrentUser();
  const bracket = await prisma.bracket.findUnique({
    where: { id },
    include: {
      tournament: true,
      // Les inscriptions annulées sont désactivées, pas effacées.
      _count: { select: { registrations: { where: { isActive: true } } } },
      matches: {
        include: { player1: true, player2: true, winner: true, table: true },
        orderBy: [{ poolNumber: 'asc' }, { roundNumber: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!bracket) {
    return (
      <div className="card text-center py-12 rounded-2xl">
        <p>Tableau introuvable.</p>
        <Link href="/progression" className="text-primary underline mt-4 inline-block">
          &larr; Retour
        </Link>
      </div>
    );
  }

  const poolMatches = bracket.matches.filter((m) => m.poolNumber !== null);
  const elimMatches = bracket.matches.filter((m) => m.poolNumber === null);
  const pools = new Map<number, typeof poolMatches>();
  for (const m of poolMatches) {
    if (m.poolNumber == null) continue;
    const arr = pools.get(m.poolNumber) ?? [];
    arr.push(m);
    pools.set(m.poolNumber, arr);
  }

  // Compute pool standings with V=1pt, D=0pt, total
  function computePoolStandings(matches: typeof poolMatches) {
    const stats = new Map<string, { player: typeof matches[0]['player1']; v: number; d: number; pts: number }>();
    for (const m of matches) {
      if (m.player1Id && m.player1) {
        if (!stats.has(m.player1Id)) stats.set(m.player1Id, { player: m.player1, v: 0, d: 0, pts: 0 });
      }
      if (m.player2Id && m.player2) {
        if (!stats.has(m.player2Id)) stats.set(m.player2Id, { player: m.player2, v: 0, d: 0, pts: 0 });
      }
      if (m.status === 'finished' && m.winnerId) {
        const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
        const ws = stats.get(m.winnerId);
        const ls = loserId ? stats.get(loserId) : undefined;
        if (ws) { ws.v++; ws.pts += 1; }
        if (ls) { ls.d++; }
      }
    }
    return [...stats.values()].sort((a, b) => b.pts - a.pts);
  }

  return (
    <div data-testid="bracket-page" className="max-w-7xl mx-auto">
      <Link
        href="/progression"
        className="btn-secondary text-sm inline-flex items-center gap-2 mb-4"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Tous les tableaux
      </Link>
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-1">
        {bracket.name}
      </h1>
      <p className="text-foreground-muted text-sm mb-1">
        {bracket.category} &middot;{' '}
        {bracket.matches.filter((m) => m.status === 'finished').length}/{bracket.matches.length} matches terminés
      </p>
      <p className="text-foreground-subtle text-sm mb-8">
        {pools.size} poule{pools.size > 1 ? 's' : ''} &middot; {bracket._count.registrations} joueur
        {bracket._count.registrations > 1 ? 's' : ''} &middot; début {bracket.startTime ?? '—'}
      </p>

      {/* Toggle Poules / Tableau final */}
      <ProgressionToggle
        poolsContent={
          pools.size > 0 ? (
            <section className="mb-10">
              <h2 className="font-heading text-xl uppercase tracking-wide mb-4">Poules</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...pools.entries()].sort((a, b) => a[0] - b[0]).map(([num, matches]) => {
                  const standings = computePoolStandings(matches);
                  return (
                    <div key={num} className="card rounded-2xl" data-testid={`pool-${num}`}>
                      <h3 className="font-heading text-lg uppercase tracking-wide mb-3 text-primary">
                        Poule {num}
                      </h3>
                      {/* Classement */}
                      <table className="w-full text-xs mb-3">
                        <thead>
                          <tr className="border-b border-border text-foreground-muted">
                            <th className="text-left py-1">#</th>
                            <th className="text-left py-1">Joueur</th>
                            <th className="text-center py-1">V</th>
                            <th className="text-center py-1">D</th>
                            <th className="text-center py-1">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((s, idx) => (
                            <tr key={s.player?.id ?? idx} className="border-b border-border/50">
                              <td className="py-1 font-medium">{idx + 1}</td>
                              <td className="py-1 truncate max-w-[120px]">
                                {s.player?.lastName} {s.player?.firstName?.[0]}.
                              </td>
                              <td className="py-1 text-center font-medium text-success">{s.v}</td>
                              <td className="py-1 text-center text-danger">{s.d}</td>
                              <td className="py-1 text-center font-bold tabular">{s.pts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Matches */}
                      <div className="space-y-1">
                        {matches.map((m) => (
                          <div
                            key={m.id}
                            className={`flex items-center text-xs p-1.5 rounded ${
                              m.status === 'finished' ? 'bg-bg-alt/50' : ''
                            }`}
                          >
                            <span className={`flex-1 truncate ${m.winnerId === m.player1Id ? 'font-bold' : ''}`}>
                              {m.player1?.lastName ?? '?'}
                            </span>
                            <span className="mx-2 font-mono tabular">
                              {m.status === 'finished' ? `${m.setsP1}-${m.setsP2}` : 'vs'}
                            </span>
                            <span className={`flex-1 truncate text-right ${m.winnerId === m.player2Id ? 'font-bold' : ''}`}>
                              {m.player2?.lastName ?? '?'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="text-foreground-muted text-center py-8">
              Aucune poule générée pour ce tableau.
            </p>
          )
        }
        bracketContent={
          elimMatches.length > 0 ? (
            <section>
              <h2 className="font-heading text-xl uppercase tracking-wide mb-4">
                Tableau final
              </h2>
              <BracketView
                minePlayerId={me?.playerId ?? null}
                matches={elimMatches.map<BracketTreeMatch>((m) => ({
                  id: m.id,
                  roundNumber: m.roundNumber,
                  roundName: m.roundName,
                  poolMatchOrder: m.poolMatchOrder,
                  player1: m.player1,
                  player2: m.player2,
                  winner: m.winner,
                  status: m.status,
                  setsP1: m.setsP1,
                  setsP2: m.setsP2,
                  sets: m.sets as any,
                }))}
              />
            </section>
          ) : (
            <p className="text-foreground-muted text-center py-8">
              Tableau final non encore généré.
            </p>
          )
        }
      />
    </div>
  );
}
