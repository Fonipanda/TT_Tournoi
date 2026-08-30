import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@tt/db';
import { RoomCanvas } from '@/components/RoomCanvas';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ id: string }> }

export default async function AdminSalleDetailPage({ params }: Params) {
  const { id } = await params;
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      tables: {
        orderBy: { number: 'asc' },
        include: {
          currentMatch: { include: { player1: true, player2: true } },
        },
      },
    },
  });
  if (!room) notFound();

  return (
    <div data-testid="salle-edit">
      <Link
        href="/admin/salles"
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
        Toutes les salles
      </Link>
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">
        {room.name}
      </h1>
      <RoomCanvas
        room={{
          id: room.id,
          name: room.name,
          width: room.width,
          height: room.height,
          entranceMarkers: room.entranceMarkers,
          buvetteMarkers: room.buvetteMarkers,
          wcMarkers: room.wcMarkers,
          arrowMarkers: room.arrowMarkers,
        }}
        tables={room.tables.map((t) => ({
          id: t.id,
          number: t.number,
          x: t.x,
          y: t.y,
          rotation: t.rotation,
          status: t.status,
          currentMatch: t.currentMatch
            ? {
                player1: t.currentMatch.player1,
                player2: t.currentMatch.player2,
                setsP1: t.currentMatch.setsP1,
                setsP2: t.currentMatch.setsP2,
              }
            : null,
        }))}
        editable
      />
    </div>
  );
}
