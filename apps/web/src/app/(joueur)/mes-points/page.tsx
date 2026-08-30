import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { MesPointsContent } from './MesPointsContent';

export const dynamic = 'force-dynamic';

export default async function MesPointsPage() {
  const me = await getCurrentUser();
  if (!me?.playerId) redirect('/login');

  // Le détail est chargé côté client depuis `/api/players/:id/points` : le
  // calcul parcourt tous les matchs terminés du joueur et n'a pas à retarder
  // le premier rendu de la page.
  return <MesPointsContent playerId={me.playerId} />;
}
