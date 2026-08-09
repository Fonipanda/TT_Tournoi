/**
 * /tv — mode TV plein écran.
 *
 * Route de premier niveau (hors groupe `(public)`) : aucun en-tête ni
 * navigation ne doit s'afficher sur l'écran du hall.
 *
 * L'accès est réservé à l'administrateur : le mode TV ne se lance que depuis
 * Admin → Paramètres.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { getTvIntervalMs } from '@/lib/tv';
import { TvDisplay } from '@/components/tv/TvDisplay';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mode TV',
  robots: { index: false, follow: false },
};

export default async function TvPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?redirect=/tv');
  if (me.role !== 'admin') redirect('/?error=forbidden');

  const intervalMs = await getTvIntervalMs();

  return <TvDisplay intervalMs={intervalMs} />;
}
