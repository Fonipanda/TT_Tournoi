import { prisma } from '@tt/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminSallesPage() {
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    include: { tables: { orderBy: { number: 'asc' } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div data-testid="admin-salles">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Salles & tables</h1>

      <p className="text-foreground-muted mb-6 text-sm">
        L'éditeur drag & drop de positions sera enrichi en{' '}
        <strong className="text-foreground">L10</strong> (RoomCanvas).
      </p>

      <div className="space-y-4">
        {rooms.map((r) => (
          <div key={r.id} className="card" data-testid={`room-${r.id}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-2xl uppercase tracking-wide">{r.name}</h2>
              <span className="text-sm text-foreground-muted">
                {r.tables.length} tables · {r.width}×{r.height}px
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
              {r.tables.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/salles/${r.id}#table-${t.id}`}
                  className={`p-2 text-center text-xs ${
                    t.status === 'occupied'
                      ? 'bg-danger-soft text-danger'
                      : t.status === 'maintenance'
                        ? 'bg-warning-soft text-warning'
                        : 'bg-success-soft text-success'
                  }`}
                  data-testid={`table-pill-${t.number}`}
                >
                  T{t.number}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p className="text-foreground-muted">Aucune salle.</p>}
      </div>
    </div>
  );
}
