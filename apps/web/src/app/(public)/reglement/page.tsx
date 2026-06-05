import { prisma } from '@tt/db';

export const dynamic = 'force-dynamic';

const DEFAULT_FALLBACK = `Conformité FFTT — Articles I.301 à I.305

Ce tournoi suit les règlements officiels de la Fédération Française de Tennis de Table.

- I.301 — Ordre des parties dans une poule selon le nombre de joueurs (3 à 6).
- I.303 — Classement de poule : V=2pts, D=1pt. Départage par confrontation directe puis quotient sets.
- I.304 — Tableau d'élimination directe avec positions de seeding standard.
- I.305 — Placement des qualifiés : 1ers comme têtes de série, 2èmes en demi-tableau opposé.

Le règlement complet (FFTT IX.111) sera publié par l'organisation avant la compétition.
Tenue sportive obligatoire. Chaussures de salle exclusivement.
Tout joueur absent à l'appel sera déclaré forfait après 3 minutes de carence (article I.302).
Les décisions du juge-arbitre sont sans appel. Toute réclamation doit être faite par écrit
dans les 30 minutes suivant l'incident.`;

async function loadRegulation(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'regulation' } });
    if (!setting?.value?.trim()) return DEFAULT_FALLBACK;

    const tournament = await prisma.tournament.findFirst({
      where: { isActive: true },
      include: {
        brackets: {
          select: { name: true, maxPlayers: true, day: true, startTime: true, entryFee: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    let text = setting.value;
    if (tournament) {
      const tableaux = tournament.brackets.map((b) => b.name).join(', ');
      const horaires_debut = tournament.brackets
        .map((b) => `${b.name}: ${b.day ?? ''} ${b.startTime ?? ''}`.trim())
        .filter(Boolean)
        .join(' ; ');
      const max_joueurs = Math.max(0, ...tournament.brackets.map((b) => b.maxPlayers));
      const fees = tournament.brackets.map((b) => `${b.name}: ${Number(b.entryFee).toFixed(2)}€`).join(' ; ');

      const replacements: Record<string, string> = {
        categorie: 'Tournoi homologué FFTT',
        date_lieu: `${tournament.date || ''} — ${tournament.location || ''}`.replace(/^ — | — $/g, ''),
        responsable: tournament.contact || '',
        juge_arbitre: '',
        nb_tables: '',
        balles: '',
        tableaux,
        joueurs_autorises: '',
        max_joueurs: String(max_joueurs),
        horaires_debut,
        horaires_finales: '',
        horaire_fin: tournament.hours || '',
        date_cloture: '',
        montant_engagement: fees,
        tirage_au_sort: '',
        homologation: '',
        challenge: '',
      };

      for (const [k, v] of Object.entries(replacements)) {
        text = text.replaceAll(`{${k}}`, v);
      }
    }
    return text;
  } catch {
    return DEFAULT_FALLBACK;
  }
}

export default async function ReglementPage() {
  const text = await loadRegulation();

  return (
    <article className="card prose max-w-3xl mx-auto" data-testid="reglement-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Règlement</h1>
      <pre className="whitespace-pre-wrap font-sans text-foreground bg-transparent border-0 p-0 m-0">
        {text}
      </pre>
    </article>
  );
}
