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
      <Link href="/admin/salles" className="text-sm text-primary mb-4 inline-block">
        ← Toutes les salles
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
