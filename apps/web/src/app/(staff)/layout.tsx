import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/server';
import { ToastViewport } from '@/components/ui/toast';
import { StaffSidebar } from '@/components/StaffSidebar';

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?redirect=/admin');
  if (me.role !== 'admin' && me.role !== 'juge_arbitre') redirect('/?error=forbidden');

  const isAdmin = me.role === 'admin';

  return (
    <div className="min-h-screen md:flex">
      <StaffSidebar isAdmin={isAdmin} username={me.username ?? me.role} />
      <main className="flex-1 p-4 md:p-6 overflow-x-auto md:ml-0 pt-16 md:pt-6">
        {children}
      </main>
      <ToastViewport />
    </div>
  );
}
