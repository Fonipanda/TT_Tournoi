import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { canBypassMaintenance, getMaintenanceState } from '@/lib/maintenance';
import { PublicNav } from '@/components/PublicNav';
import { PlayerNav } from '@/components/PlayerNav';

export const dynamic = 'force-dynamic';

export default async function JoueurLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?redirect=/mon-espace');

  const { enabled } = await getMaintenanceState();
  if (enabled && !canBypassMaintenance(me.role)) redirect('/maintenance');

  return (
    <>
      <PublicNav user={{ username: me.username, role: me.role, playerId: me.playerId }} />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <PlayerNav />
        <main>{children}</main>
      </div>
    </>
  );
}
