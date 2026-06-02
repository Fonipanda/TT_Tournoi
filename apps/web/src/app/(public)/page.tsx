import Link from 'next/link';
import { prisma } from '@tt/db';
import { HomeStatsButtons } from '@/components/HomeStatsButtons';
import { serialize } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

async function getActiveTournament() {
  return prisma.tournament.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
    include: {
      brackets: {
        where: { isActive: true },
        orderBy: { startTime: 'asc' },
        include: {
          _count: { select: { registrations: true } },
          registrations: {
            where: { isActive: true },
            include: { player: { select: { id: true, firstName: true, lastName: true, club: true } } },
          },
        },
      },
    },
  });
}

export default async function HomePage() {
  const tournament = await getActiveTournament();

  if (!tournament) {
    return (
      <div className="card rounded-2xl text-center py-16" data-testid="home-empty">
        <div className="text-6xl mb-4">🏓</div>
        <h1 className="font-heading text-3xl uppercase tracking-wide mb-4">
          Aucun tournoi actif
        </h1>
        <p className="text-foreground-muted">
          Reviens plus tard ou consulte la page{' '}
          <Link href="/reglement" className="text-primary underline">
            Règlement
          </Link>
          .
        </p>
      </div>
    );
  }

  // Stats
  const totalInscrits = tournament.brackets.reduce((sum, b) => sum + b._count.registrations, 0);
  const totalPlaces = tournament.brackets.reduce((sum, b) => sum + b.maxPlayers, 0);
  const tauxRemplissage = totalPlaces > 0 ? Math.round((totalInscrits / totalPlaces) * 100) : 0;
  const placesDisponibles = totalPlaces - totalInscrits;

  // Brackets pour modal
  const bracketStats = tournament.brackets.map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category,
    startTime: b.startTime,
    checkinEnd: b.checkinEnd,
    day: b.day,
    maxPlayers: b.maxPlayers,
    inscrits: b._count.registrations,
    prize: b.prize,
    byePlayers: b.byePlayers,
  }));

  // Liste des inscrits (pour le popup recherche)
  const allPlayers = tournament.brackets.flatMap((b) =>
    b.registrations.map((r) => ({
      id: r.player.id,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      club: r.player.club,
      bracketName: b.name,
    })),
  );

  // URL Google Maps embed (fallback si location vide)
  const mapsQuery = encodeURIComponent(tournament.location || 'Chelles, France');
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsLinkUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="space-y-6" data-testid="home-bento">
      {/* Hero avec animation tennis de table */}
      <section className="relative card rounded-3xl bg-gradient-to-br from-primary via-primary-700 to-accent text-primary-fg p-8 lg:p-12 overflow-hidden shadow-xl">
        {/* Balles de TT animées en background */}
        <div className="absolute -top-8 -right-8 text-9xl opacity-10 select-none animate-spin-slow">
          🏓
        </div>
        <div className="absolute -bottom-4 -left-4 text-7xl opacity-10 select-none">🏓</div>

        <div className="relative z-10">
          <p className="text-primary-100 text-sm uppercase tracking-widest mb-2">
            {tournament.date || 'Tournoi'}
          </p>
          <h1
            className="font-heading text-4xl lg:text-6xl uppercase tracking-wide leading-none mb-4 whitespace-pre-line"
            data-testid="tournament-name"
          >
            {tournament.name}
          </h1>
          {tournament.hours && (
            <p className="text-primary-100 text-lg mb-6">🕐 {tournament.hours}</p>
          )}
          {tournament.description && (
            <p className="text-primary-100/90 max-w-2xl">{tournament.description}</p>
          )}
          <div className="mt-8 flex gap-3 flex-wrap items-center">
            <Link
              href="/inscription"
              className="bg-surface text-primary font-medium px-6 py-3 rounded-full hover:bg-bg-alt transition-all hover:scale-105 shadow-lg"
              data-testid="btn-register"
            >
              S'inscrire →
            </Link>
            <Link
              href="/live"
              className="bg-danger text-white font-medium px-6 py-3 rounded-full hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg"
              data-testid="btn-live"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span>Voir le Live</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Cartes stats : adresse / contact / inscriptions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Carte adresse avec carte Google */}
        <div className="card rounded-2xl overflow-hidden p-0 shadow-sm hover:shadow-md transition-shadow">
          <div className="aspect-video bg-bg-alt relative">
            <iframe
              src={mapsEmbedUrl}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title="Localisation du tournoi"
            />
          </div>
          <div className="p-4">
            <p className="text-xs uppercase tracking-widest text-foreground-muted mb-1">
              📍 Adresse
            </p>
            <p className="font-medium text-sm">{tournament.location || 'Non renseignée'}</p>
            <a
              href={mapsLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary text-xs hover:underline mt-2 inline-block"
            >
              Itinéraire →
            </a>
          </div>
        </div>

        {/* Carte contact */}
        <div className="card rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <p className="text-xs uppercase tracking-widest text-foreground-muted mb-2">
            ☎️ Contact
          </p>
          <p className="font-medium text-lg break-words">
            {tournament.contact || 'Non renseigné'}
          </p>
          {tournament.contact?.includes('@') && (
            <a
              href={`mailto:${tournament.contact}`}
              className="text-primary text-sm hover:underline mt-2"
            >
              Envoyer un email →
            </a>
          )}
          {tournament.assoConnectUrl && (
            <a
              href={tournament.assoConnectUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm rounded-full mt-auto self-start"
            >
              Inscription en ligne ↗
            </a>
          )}
        </div>

        {/* Carte état des inscriptions */}
        <div className="card rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-primary-soft to-accent-soft border-primary">
          <p className="text-xs uppercase tracking-widest text-foreground-muted mb-2">
            📊 Inscriptions
          </p>
          <p className="font-heading text-5xl text-primary tabular leading-none">
            {totalInscrits}
            <span className="text-2xl text-foreground-muted">/{totalPlaces}</span>
          </p>
          <p className="text-sm text-foreground-muted mt-1">
            {placesDisponibles > 0 ? (
              <>
                <span className="font-semibold text-primary">{placesDisponibles}</span> place
                {placesDisponibles > 1 ? 's' : ''} restante{placesDisponibles > 1 ? 's' : ''}
              </>
            ) : (
              <span className="text-danger font-semibold">Complet</span>
            )}
          </p>
          <div className="mt-3 h-2 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${
                tauxRemplissage >= 100
                  ? 'bg-danger'
                  : tauxRemplissage > 75
                    ? 'bg-warning'
                    : 'bg-primary'
              }`}
              style={{ width: `${Math.min(tauxRemplissage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-foreground-muted mt-1 text-right tabular">
            {tauxRemplissage}%
          </p>
        </div>
      </section>

      {/* Boutons popups */}
      <section className="flex flex-wrap gap-3 justify-center">
        <HomeStatsButtons brackets={serialize(bracketStats)} players={serialize(allPlayers)} />
      </section>

      {/* Programme */}
      {Array.isArray(tournament.schedule) && tournament.schedule.length > 0 && (
        <section className="card rounded-2xl shadow-sm">
          <h2 className="font-heading text-2xl uppercase tracking-wide mb-4">📅 Programme</h2>
          <ul className="divide-y divide-border" data-testid="schedule">
            {(tournament.schedule as Array<{ title: string; start: string; end: string }>).map(
              (s, i) => (
                <li key={i} className="py-3 flex items-center justify-between">
                  <span className="font-medium">{s.title}</span>
                  <span className="font-mono text-sm text-foreground-muted tabular">
                    {s.start} – {s.end}
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
