'use client';

import { useState } from 'react';
import { MatchesTab } from './MatchesTab';
import { SpidTab } from './SpidTab';
import { BackupTab } from './BackupTab';

type TabKey = 'matches' | 'spid' | 'backup';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'matches', label: 'Matchs' },
  { key: 'spid', label: 'SPID' },
  { key: 'backup', label: 'Sauvegardes' },
];

export default function JugeArbitrePage() {
  const [tab, setTab] = useState<TabKey>('matches');

  return (
    <div data-testid="juge-arbitre-page">
      <h1 className="font-heading text-2xl uppercase tracking-wide mb-4">Juge-Arbitre</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'matches' && <MatchesTab />}
      {tab === 'spid' && <SpidTab />}
      {tab === 'backup' && <BackupTab />}
    </div>
  );
}
