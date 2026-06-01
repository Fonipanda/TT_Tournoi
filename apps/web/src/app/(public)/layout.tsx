import type { ReactNode } from 'react';
import { PublicNav } from '@/components/PublicNav';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="border-t border-border bg-surface mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-foreground-muted flex flex-wrap justify-between items-center gap-2">
          <span>© Chelles Tennis de Table — TT Tournoi v2</span>
          <span className="font-mono">Conforme FFTT I.301-305</span>
        </div>
      </footer>
    </div>
  );
}
