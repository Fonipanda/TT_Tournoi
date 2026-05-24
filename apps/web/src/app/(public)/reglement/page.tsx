export default function ReglementPage() {
  return (
    <article className="card prose max-w-3xl mx-auto" data-testid="reglement-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Règlement</h1>

      <h2 className="font-heading text-xl uppercase tracking-wide mt-6 mb-2">
        Conformité FFTT
      </h2>
      <p className="text-foreground-muted">
        Ce tournoi suit les règlements officiels de la Fédération Française de Tennis de Table —
        Articles I.301 à I.305.
      </p>
      <ul className="list-disc pl-6 space-y-1 text-foreground-muted">
        <li>I.301 — Ordre des parties dans une poule selon le nombre de joueurs (3 à 6).</li>
        <li>I.303 — Classement de poule : V=2pts, D=1pt. Départage par confrontation directe puis quotient sets.</li>
        <li>I.304 — Tableau d'élimination directe avec positions de seeding standard.</li>
        <li>I.305 — Placement des qualifiés : 1ers comme têtes de série, 2èmes en demi-tableau opposé.</li>
      </ul>

      <h2 className="font-heading text-xl uppercase tracking-wide mt-8 mb-2">
        Inscriptions
      </h2>
      <p className="text-foreground-muted">
        Les inscriptions se font via le portail en ligne ou directement à l'accueil le jour du
        tournoi (selon disponibilités). Maximum 2 tableaux par jour et par joueur.
      </p>

      <h2 className="font-heading text-xl uppercase tracking-wide mt-8 mb-2">
        Tenue
      </h2>
      <p className="text-foreground-muted">
        Tenue sportive obligatoire. Chaussures de salle exclusivement.
      </p>

      <h2 className="font-heading text-xl uppercase tracking-wide mt-8 mb-2">
        Forfaits
      </h2>
      <p className="text-foreground-muted">
        Tout joueur absent à l'appel sera déclaré forfait après 3 minutes de carence (article I.302).
      </p>

      <h2 className="font-heading text-xl uppercase tracking-wide mt-8 mb-2">
        Contestations
      </h2>
      <p className="text-foreground-muted">
        Les décisions du juge-arbitre sont sans appel. Toute réclamation doit être faite par écrit
        dans les 30 minutes suivant l'incident.
      </p>
    </article>
  );
}
