import { prisma } from '@tt/db';
import Link from 'next/link';
import { BracketTree, type BracketTreeMatch } from '@/components/BracketTree';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export default async function ProgressionDetailPage({ params }: Params) {
  const { id } = await params;
  const bracket = await prisma.bracket.findUnique({
    where: { id },
    include: {
      tournament: true,
      matches: {
        include: { player1: true, player2: true, winner: true, table: true },
        orderBy: [{ poolNumber: 'asc' }, { roundNumber: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!bracket) {
    return (
      <div className="card text-center py-12">
        <p>Tableau introuvable.</p>
        <Link href="/progression" className="text-primary underline mt-4 inline-block">
          ← Retour
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

  return (
    <div data-testid="bracket-page">
      <Link href="/progression" className="text-sm text-primary mb-4 inline-block">
        ← Tous les tableaux
      </Link>
      <h1 className="font-heading text-3xl uppercase tracking-wide">
        {bracket.name}
        <span className="text-foreground-muted text-base ml-3 font-body normal-case">
          · {bracket.category}
        </span>
      </h1>

      {pools.size > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-2xl uppercase tracking-wide mb-4">Poules</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...pools.entries()].sort((a, b) => a[0] - b[0]).map(([num, matches]) => (
              <div key={num} className="card" data-testid={`pool-${num}`}>
                <h3 className="font-heading text-xl uppercase tracking-wide mb-3">
                  Poule {num}
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {matches.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="py-2 truncate">
                          {m.player1
                            ? `${m.player1.lastName} ${m.player1.firstName}`
                            : '—'}
                        </td>
                        <td className="py-2 px-2 font-mono tabular text-center">
                          {m.status === 'finished' ? `${m.setsP1}-${m.setsP2}` : '—'}
                        </td>
                        <td className="py-2 truncate">
                          {m.player2
                            ? `${m.player2.lastName} ${m.player2.firstName}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {elimMatches.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-2xl uppercase tracking-wide mb-4">
            Tableau d'élimination
          </h2>
          <BracketTree
            matches={elimMatches.map<BracketTreeMatch>((m) => ({
              id: m.id,
              roundNumber: m.roundNumber,
              roundName: m.roundName,
              player1: m.player1,
              player2: m.player2,
              winner: m.winner,
              status: m.status,
              setsP1: m.setsP1,
              setsP2: m.setsP2,
            }))}
          />
        </section>
      )}
    </div>
  );
}
