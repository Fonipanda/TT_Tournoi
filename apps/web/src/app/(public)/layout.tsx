import type { ReactNode } from 'react';
import { PublicNav } from '@/components/PublicNav';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicNav />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      <footer className="border-t border-border bg-surface mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-sm text-foreground-muted flex justify-between items-center">
          <span>© Chelles Tennis de Table — TT Tournoi v2</span>
          <span className="font-mono text-xs">Conforme FFTT I.301-305</span>
        </div>
      </footer>
    </>
  );
}
