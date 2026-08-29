/**
 * Récapitulatif public des dotations d'un tableau.
 *
 * Le texte affiché n'est plus une saisie mais une projection des quatre
 * montants : un libellé rédigé à la main pouvait diverger des sommes
 * réellement enregistrées, et c'est ce libellé que le public lit.
 *
 * Module pur, sans dépendance Prisma ni Node : il est importé aussi bien par
 * les routes serveur, qui maintiennent `Bracket.prize`, que par les composants
 * client, qui recalculent le texte à l'affichage.
 */

export interface DotationAmounts {
  winner: number;
  finalist: number;
  semi: number;
  quarter: number;
}

/**
 * Met en forme un montant en euros.
 *
 * Les colonnes sont en `Decimal(8,2)` : un montant peut porter des centimes.
 * On n'affiche les décimales que lorsqu'elles existent — « 80,00€ » sur une
 * carte de tournoi alourdit la lecture sans rien apporter.
 *
 * Une valeur aberrante (absente, négative, non finie) est ramenée à zéro
 * plutôt qu'affichée telle quelle : le récap est une information publique.
 */
function amount(value: number): string {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  return Number.isInteger(v) ? `${v}€` : `${v.toFixed(2).replace('.', ',')}€`;
}

/**
 * Construit le récapitulatif, par exemple :
 * `1er 80€ / 2è 40€ / 3è-4è 20€ / 5è à 8è 10€`.
 *
 * Les quatre rangs sont toujours présents, y compris à `0€` : l'absence d'une
 * ligne laisserait croire que le rang n'est pas doté alors qu'il peut l'être
 * plus tard, et rendrait la comparaison entre tableaux malaisée.
 */
export function formatDotation(d: DotationAmounts): string {
  return [
    `1er ${amount(d.winner)}`,
    `2è ${amount(d.finalist)}`,
    `3è-4è ${amount(d.semi)}`,
    `5è à 8è ${amount(d.quarter)}`,
  ].join(' / ');
}
