'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';

interface BracketStat {
  id: string;
  name: string;
  category: string;
  startTime: string | null;
  day: string | null;
  maxPlayers: number;
  inscrits: number;
  prize: string;
  dotationWinner: number;
}

interface PlayerLite {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
  bracketName: string;
}

interface Props {
  brackets: BracketStat[];
  players: PlayerLite[];
}

export function HomeStatsButtons({ brackets, players }: Props) {
  const [bracketsOpen, setBracketsOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPlayers = players.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.club ?? '').toLowerCase().includes(q) ||
      p.bracketName.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setBracketsOpen(true)}
        className="btn-secondary text-sm rounded-full"
        data-testid="show-brackets"
      >
        🎯 Détail par tableau
      </button>
      <button
        type="button"
        onClick={() => setPlayersOpen(true)}
        className="btn-secondary text-sm rounded-full"
        data-testid="show-players"
      >
        👥 Liste des inscrits ({players.length})
      </button>

      {/* Modal détail tableaux */}
      <Modal
        open={bracketsOpen}
        onClose={() => setBracketsOpen(false)}
        title="Détail par tableau"
        size="lg"
      >
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {brackets.map((b) => {
            const taux = b.maxPlayers > 0 ? Math.round((b.inscrits / b.maxPlayers) * 100) : 0;
            const full = b.inscrits >= b.maxPlayers;
            return (
              <div key={b.id} className="card rounded-xl">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-heading text-xl uppercase tracking-wide">{b.name}</h3>
                    <p className="text-sm text-foreground-muted">{b.category}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      full
                        ? 'bg-danger-soft text-danger'
                        : taux > 75
                          ? 'bg-warning-soft text-warning'
                          : 'bg-success-soft text-success'
                    }`}
                  >
                    {full ? 'Complet' : `${taux}% rempli`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-foreground-muted">Jour / heure</p>
                    <p className="font-medium">
                      {b.day ?? '—'} · {b.startTime ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Inscrits</p>
                    <p className="font-medium tabular">
                      {b.inscrits} / {b.maxPlayers}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Vainqueur</p>
                    <p className="font-medium tabular text-primary">
                      {Number(b.dotationWinner) > 0 ? `${b.dotationWinner} €` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Dotations</p>
                    <p className="font-medium text-xs">{b.prize || '—'}</p>
                  </div>
                </div>
                {/* Barre de progression */}
                <div className="mt-2 h-1.5 bg-bg-alt rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      full ? 'bg-danger' : taux > 75 ? 'bg-warning' : 'bg-success'
                    }`}
                    style={{ width: `${Math.min(taux, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Modal liste joueurs */}
      <Modal
        open={playersOpen}
        onClose={() => setPlayersOpen(false)}
        title={`Inscrits (${filteredPlayers.length})`}
        size="lg"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, club ou tableau…"
          className="input mb-3"
          data-testid="players-search"
          autoFocus
        />
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-foreground-muted sticky top-0 bg-surface">
              <tr className="border-b border-border">
                <th className="text-left py-2">Nom</th>
                <th className="text-left py-2">Club</th>
                <th className="text-left py-2">Tableau</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((p, i) => (
                <tr key={`${p.id}-${i}`} className="border-b border-border hover:bg-bg-alt">
                  <td className="py-1.5 font-medium uppercase">
                    {p.lastName} <span className="font-normal normal-case">{p.firstName}</span>
                  </td>
                  <td className="py-1.5 text-foreground-muted">{p.club ?? '—'}</td>
                  <td className="py-1.5">
                    <span className="text-xs bg-primary-soft text-primary px-2 py-0.5 rounded-full">
                      {p.bracketName}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPlayers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-foreground-muted">
                    Aucun résultat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
