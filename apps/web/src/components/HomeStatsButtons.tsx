'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';

interface BracketStat {
  id: string;
  name: string;
  category: string;
  startTime: string | null;
  checkinEnd: string | null;
  day: string | null;
  maxPlayers: number;
  inscrits: number;
  prize: string;
  byePlayers: string;
}

interface PlayerLite {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
  bracketName: string;
}

interface PlayerGrouped {
  id: string;
  firstName: string;
  lastName: string;
  club: string | null;
  brackets: string[];
}

interface Props {
  brackets: BracketStat[];
  players: PlayerLite[];
}

export function HomeStatsButtons({ brackets, players }: Props) {
  const [bracketsOpen, setBracketsOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Grouper les inscrits : 1 ligne par joueur, tous ses tableaux ensemble
  const playersGrouped: PlayerGrouped[] = (() => {
    const map = new Map<string, PlayerGrouped>();
    for (const p of players) {
      const existing = map.get(p.id);
      if (existing) {
        if (!existing.brackets.includes(p.bracketName)) {
          existing.brackets.push(p.bracketName);
        }
      } else {
        map.set(p.id, {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          club: p.club,
          brackets: [p.bracketName],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.lastName.localeCompare(b.lastName));
  })();

  const filteredPlayers = playersGrouped.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.club ?? '').toLowerCase().includes(q) ||
      p.brackets.some((b) => b.toLowerCase().includes(q))
    );
  });

  // Boutons intégrés dans la carte « Inscriptions » (fond dégradé clair) :
  // surface semi-opaque + bordure pour rester lisibles sur le dégradé.
  const buttonClass =
    'w-full bg-surface/80 hover:bg-surface border border-border text-foreground ' +
    'text-sm font-medium px-4 py-2.5 rounded-full transition-all hover:shadow-sm ' +
    'text-center whitespace-nowrap';

  return (
    <>
      <button
        type="button"
        onClick={() => setBracketsOpen(true)}
        className={buttonClass}
        data-testid="show-brackets"
      >
        🎯 Détail par tableau
      </button>
      <button
        type="button"
        onClick={() => setPlayersOpen(true)}
        className={buttonClass}
        data-testid="show-players"
      >
        {/* Nombre de personnes, pas d'inscriptions : un joueur présent sur
            2 tableaux ne compte que pour 1. */}
        👥 Liste des inscrits ({playersGrouped.length})
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
                    <p className="text-foreground-muted">Heure de pointage</p>
                    <p className="font-medium">
                      {b.day ?? '—'} · {b.checkinEnd ?? b.startTime ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Inscrits</p>
                    <p className="font-medium tabular">
                      {b.inscrits} / {b.maxPlayers}
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground-muted">Tête(s) de série</p>
                    <p className="font-medium tabular text-primary">
                      {b.byePlayers ? b.byePlayers.split(',').filter(Boolean).length : 0}
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
                <th className="text-left py-2">Tableaux</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-bg-alt">
                  <td className="py-1.5 font-medium uppercase">
                    {p.lastName} <span className="font-normal normal-case">{p.firstName}</span>
                  </td>
                  <td className="py-1.5 text-foreground-muted">{p.club ?? '—'}</td>
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p.brackets.map((b) => (
                        <span
                          key={b}
                          className="text-xs bg-primary-soft text-primary px-2 py-0.5 rounded-full"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
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
