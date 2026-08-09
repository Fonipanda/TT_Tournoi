'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';
import { QrGenerator } from '@/components/admin/QrGenerator';
import { MaintenanceToggle } from '@/components/admin/MaintenanceToggle';

const MAX_LOGO_SIZE = 500 * 1024; // 500 Ko

const REGULATION_TEMPLATE = `RÈGLEMENT DU TOURNOI

(Établi conformément à l'article IX.111 du Règlement Sportif FFTT)

═══════════════════════════════════════════════════════════════════
INFORMATIONS GÉNÉRALES
═══════════════════════════════════════════════════════════════════

• Catégorie du tournoi : {categorie}
• Date et lieu : {date_lieu}
• Numéro d'homologation FFTT : {homologation}
• Responsable de l'organisation : {responsable}
• Juge-arbitre désigné : {juge_arbitre}

═══════════════════════════════════════════════════════════════════
ARTICLE 1 — JUGE-ARBITRAGE
═══════════════════════════════════════════════════════════════════

Le juge-arbitre {juge_arbitre} est seul habilité à statuer sur tout litige
ou point non prévu au présent règlement. Ses décisions sont sans appel.

═══════════════════════════════════════════════════════════════════
ARTICLE 2 — MATÉRIEL ET AIRES DE JEU
═══════════════════════════════════════════════════════════════════

• {nb_tables}
• Balles utilisées : {balles}
  Balles fournies par l'organisation, plastique blanche homologuée FFTT.

═══════════════════════════════════════════════════════════════════
ARTICLE 3 — TABLEAUX ORGANISÉS
═══════════════════════════════════════════════════════════════════

Tableaux : {tableaux}

Joueurs autorisés : {joueurs_autorises}

Nombre maximum de joueurs par tableau : {max_joueurs}

═══════════════════════════════════════════════════════════════════
ARTICLE 4 — CONDITIONS DE PARTICIPATION
═══════════════════════════════════════════════════════════════════

Tout joueur doit présenter sa licence FFTT 2025-2026 valide ainsi qu'un
certificat médical conforme à la réglementation en vigueur.

Les joueurs étrangers doivent être affiliés à leur fédération nationale et
fournir une attestation de non-suspension.

Sur-classement : les benjamins et catégories supérieures sont autorisés
à s'inscrire dans les tableaux séniors selon les règlements FFTT.

═══════════════════════════════════════════════════════════════════
ARTICLE 5 — DROITS D'ENGAGEMENT
═══════════════════════════════════════════════════════════════════

Montant des engagements : {montant_engagement}

Date de clôture des engagements : {date_cloture}

Mode de paiement : carte bancaire en ligne, ou espèces / chèque
à l'ordre de l'organisateur sur place.

Les inscriptions sont fermes et définitives. Tout remboursement n'est
possible que sur présentation d'un certificat médical.

En cas d'annulation d'un tableau (moins de 12 inscrits), les droits
correspondants sont intégralement remboursés.

═══════════════════════════════════════════════════════════════════
ARTICLE 6 — DÉROULEMENT SPORTIF
═══════════════════════════════════════════════════════════════════

Le tournoi se déroule conformément aux règlements sportifs de la FFTT.

Format des matches : meilleur des 5 manches de 11 points.

Format des tableaux :
  • Phase de poules : poules de 3 ou 4 joueurs (2 qualifiés par poule)
  • Phase finale : élimination directe avec tirage par blocs FFTT
    (article I.305) — protection des têtes de série

Tenue sportive obligatoire (chaussures de salle propres, short / jupe,
maillot de club).

═══════════════════════════════════════════════════════════════════
ARTICLE 7 — HORAIRES
═══════════════════════════════════════════════════════════════════

Horaires de début de chaque tableau : {horaires_debut}

Horaires prévisionnels des finales : {horaires_finales}

Horaire de fin prévisionnelle : {horaire_fin}

Le tournoi se déroule sans interruption. Une buvette est disponible sur
place pendant toute la durée de la compétition.

═══════════════════════════════════════════════════════════════════
ARTICLE 8 — POINTAGE ET FORFAIT
═══════════════════════════════════════════════════════════════════

Le pointage est obligatoire avant le début de chaque tableau.
Tout joueur non pointé à l'horaire indiqué est considéré comme forfait
et peut être remplacé par un joueur de la liste d'attente sans
remboursement de son engagement.

Forfait en cours de match : un joueur absent est déclaré forfait après
5 minutes d'attente suivant le 2ᵉ appel par micro.

Les forfaits non excusés entraînent l'application de l'article IV.202
des Règlements administratifs FFTT (perte des points de classement
correspondants).

═══════════════════════════════════════════════════════════════════
ARTICLE 9 — TIRAGE AU SORT PUBLIC
═══════════════════════════════════════════════════════════════════

Date, heure et lieu : {tirage_au_sort}

Le tirage au sort est public et a lieu 15 minutes après la fin du
pointage. Les poules sont tirées au sort après le démarrage des tableaux.

═══════════════════════════════════════════════════════════════════
ARTICLE 10 — RÉCOMPENSES
═══════════════════════════════════════════════════════════════════

Les récompenses (médailles, lots, dotation financière) sont remises
à l'issue de chaque tableau au vainqueur, finaliste et demi-finalistes.

Mode d'attribution challenge / coupe : {challenge}

═══════════════════════════════════════════════════════════════════
ARTICLE 11 — RESPONSABILITÉS
═══════════════════════════════════════════════════════════════════

L'organisation décline toute responsabilité en cas d'accident, perte ou
vol survenu pendant la compétition. Les joueurs participent sous leur
propre responsabilité.

L'organisation se réserve le droit de modifier le présent règlement
en cas de force majeure.

═══════════════════════════════════════════════════════════════════
ARTICLE 12 — ACCEPTATION DU RÈGLEMENT
═══════════════════════════════════════════════════════════════════

L'inscription au tournoi vaut acceptation pleine et entière du présent
règlement. Tout cas non prévu sera tranché par le juge-arbitre.

═══════════════════════════════════════════════════════════════════

Variables utilisables dans ce template :
{categorie}, {date_lieu}, {responsable}, {juge_arbitre}, {nb_tables},
{balles}, {tableaux}, {joueurs_autorises}, {max_joueurs}, {horaires_debut},
{horaires_finales}, {horaire_fin}, {date_cloture}, {montant_engagement},
{tirage_au_sort}, {homologation}, {challenge}`;

// Liste des variables du règlement avec leurs labels
const REGULATION_VARS = [
  { key: 'categorie', label: 'Catégorie du tournoi', placeholder: 'Ex: Tournoi national homologué' },
  { key: 'date_lieu', label: 'Date et lieu', placeholder: 'Ex: 23 mai 2026 à Chelles' },
  { key: 'responsable', label: "Responsable de l'organisation", placeholder: 'Nom + contact' },
  { key: 'juge_arbitre', label: 'Juge-arbitre désigné', placeholder: 'Nom du JA' },
  { key: 'nb_tables', label: 'Nombre de tables et dimensions des aires', placeholder: 'Ex: 26 tables sur 13×20m par aire' },
  { key: 'balles', label: 'Marque des balles fournies', placeholder: 'Ex: Cornilleau ABS Evolution ***' },
  { key: 'tableaux', label: 'Tableaux organisés', placeholder: 'Ex: A (≤599), B (≤1099), C (≤899)' },
  { key: 'joueurs_autorises', label: 'Joueurs autorisés', placeholder: 'Ex: licenciés FFTT 2025-2026' },
  { key: 'max_joueurs', label: 'Nombre max de joueurs par tableau', placeholder: 'Ex: 64' },
  { key: 'horaires_debut', label: 'Horaires de début de chaque tableau', placeholder: 'Ex: A 9h, B 10h, C 14h' },
  { key: 'horaires_finales', label: 'Horaires prévisionnels des finales', placeholder: 'Ex: 18h30 à 20h' },
  { key: 'horaire_fin', label: 'Horaire de fin prévisionnelle', placeholder: 'Ex: 22h30' },
  { key: 'date_cloture', label: 'Date de clôture des engagements', placeholder: 'Ex: 20 mai 2026 à 23h59' },
  { key: 'montant_engagement', label: 'Montant des engagements', placeholder: 'Ex: 9€ (1 tab.) / 16€ (2 tab.)' },
  { key: 'tirage_au_sort', label: "Date, heure et lieu du tirage au sort public", placeholder: 'Ex: 22 mai 2026, 18h, salle Chelles' },
  { key: 'homologation', label: "Numéro d'homologation", placeholder: 'Ex: 2026-FFTT-XXXX' },
  { key: 'challenge', label: 'Mode attribution challenge / coupe', placeholder: 'Ex: vainqueur tableau A' },
] as const;

type RegulationVarsMap = Record<string, string>;

export default function AdminParametresPage() {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [regulation, setRegulation] = useState<string>('');
  const [regulationVars, setRegulationVars] = useState<RegulationVarsMap>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingRegulation, setSavingRegulation] = useState(false);
  const [savingVars, setSavingVars] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        setLogoUrl(j.data?.logo ?? null);
        setRegulation(j.data?.regulation ?? '');
        try {
          setRegulationVars(j.data?.regulation_vars ? JSON.parse(j.data.regulation_vars) : {});
        } catch {
          setRegulationVars({});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(`Image trop grande (${(file.size / 1024).toFixed(0)} Ko, max 500 Ko)`);
      return;
    }
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) {
      toast.error('Format accepté : PNG, JPEG, SVG, WebP');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await apiJson('/api/settings/logo', {
        method: 'PUT',
        body: JSON.stringify({ value: dataUrl }),
      });
      setLogoUrl(dataUrl);
      toast.success('Logo enregistré');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      await apiJson('/api/settings/logo', { method: 'DELETE' });
      setLogoUrl(null);
      toast.success('Logo supprimé · "TT Tournoi" sera affiché');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    }
  };

  const saveRegulation = async () => {
    setSavingRegulation(true);
    try {
      await apiJson('/api/settings/regulation', {
        method: 'PUT',
        body: JSON.stringify({ value: regulation }),
      });
      toast.success('Règlement enregistré');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSavingRegulation(false);
    }
  };

  const loadTemplate = () => {
    if (regulation.trim() && !confirm('Remplacer le règlement actuel par le template ?')) return;
    setRegulation(REGULATION_TEMPLATE);
  };

  const clearRegulation = async () => {
    if (!confirm('Supprimer le règlement enregistré ?')) return;
    try {
      await apiJson('/api/settings/regulation', { method: 'DELETE' });
      setRegulation('');
      toast.success('Règlement supprimé');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    }
  };

  const saveVars = async () => {
    setSavingVars(true);
    try {
      await apiJson('/api/settings/regulation_vars', {
        method: 'PUT',
        body: JSON.stringify({ value: JSON.stringify(regulationVars) }),
      });
      toast.success('Variables enregistrées');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    } finally {
      setSavingVars(false);
    }
  };

  return (
    <div data-testid="admin-parametres" className="space-y-6">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Paramètres</h1>

      {/* Layout 2 colonnes : (Logo + Règlement) à gauche · (TV + QR) à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Colonne gauche ─── */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="card rounded-2xl">
            <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Logo du site</h2>
            <p className="text-sm text-foreground-muted mb-4">
              Remplace le texte « TT Tournoi » dans l'en-tête. Max 500 Ko, formats PNG/JPEG/SVG/WebP.
            </p>

            {loading ? (
              <p className="text-foreground-muted">Chargement…</p>
            ) : logoUrl ? (
              <div className="space-y-3">
                <div className="card bg-bg-alt">
                  <p className="text-xs uppercase tracking-widest text-foreground-muted mb-2">
                    Aperçu
                  </p>
                  <div className="flex items-center justify-center bg-surface p-4 border border-border">
                    <img src={logoUrl} alt="Logo actuel" className="max-h-16 w-auto object-contain" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="btn-secondary text-sm cursor-pointer">
                    Remplacer
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={onFile}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="text-danger text-sm hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <label className="btn-primary text-sm cursor-pointer inline-block">
                {uploading ? 'Upload…' : 'Choisir un logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={onFile}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Règlement */}
          <div className="card rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-xl uppercase tracking-wide">Règlement du tournoi</h2>
              <span className="text-xs text-foreground-muted">FFTT — Art. IX.111</span>
            </div>
            <p className="text-sm text-foreground-muted mb-3">
              Affiché publiquement sur <code>/reglement</code>. Utilise les variables{' '}
              <code>{'{nom_variable}'}</code> ; remplis les champs ci-dessous pour les
              substituer automatiquement.
            </p>

            <div className="flex gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={loadTemplate}
                className="text-sm px-3 py-1.5 rounded border border-border bg-bg-alt hover:bg-bg-alt/80"
              >
                Charger le template FFTT IX.111
              </button>
              {regulation && (
                <button
                  type="button"
                  onClick={clearRegulation}
                  className="text-sm text-danger hover:underline"
                >
                  Supprimer
                </button>
              )}
            </div>

            {/* Champs des variables */}
            <details className="mb-3 border border-border rounded-lg overflow-hidden" open>
              <summary className="cursor-pointer bg-bg-alt/50 px-3 py-2 text-sm font-medium">
                Variables du règlement (17 champs)
              </summary>
              <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                {REGULATION_VARS.map((v) => (
                  <div key={v.key} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-foreground-muted">
                      <code className="bg-bg-alt/50 px-1 rounded text-[10px]">{`{${v.key}}`}</code>{' '}
                      {v.label}
                    </label>
                    <input
                      type="text"
                      value={regulationVars[v.key] ?? ''}
                      onChange={(e) =>
                        setRegulationVars((prev) => ({ ...prev, [v.key]: e.target.value }))
                      }
                      placeholder={v.placeholder}
                      className="w-full text-sm border border-border rounded px-2 py-1 bg-bg"
                    />
                  </div>
                ))}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={saveVars}
                    disabled={savingVars}
                    className="btn-primary text-xs px-3 py-1.5 rounded disabled:opacity-50"
                  >
                    {savingVars ? 'Enregistrement…' : 'Enregistrer les variables'}
                  </button>
                </div>
              </div>
            </details>

            <textarea
              value={regulation}
              onChange={(e) => setRegulation(e.target.value)}
              rows={14}
              placeholder="Saisis le règlement, ou clique sur « Charger le template »…"
              className="w-full font-mono text-xs border border-border rounded-lg p-3 bg-bg resize-y min-h-[200px]"
            />

            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={saveRegulation}
                disabled={savingRegulation}
                className="btn-primary text-sm px-4 py-2 rounded disabled:opacity-50"
              >
                {savingRegulation ? 'Enregistrement…' : 'Enregistrer le règlement'}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Colonne droite ─── */}
        <div className="space-y-6">
          <TvIntervalSlider />
          <QrGenerator initialLogoUrl={logoUrl} />
          <MaintenanceToggle />
        </div>
      </div>
    </div>
  );
}

function TvIntervalSlider() {
  const SETTINGS_KEY = 'tt_tv_interval_ms';
  const [value, setValue] = useState(5000);

  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) setValue(parseInt(saved, 10) || 5000);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setValue(v);
    localStorage.setItem(SETTINGS_KEY, String(v));
  };

  return (
    <div className="card rounded-2xl">
      <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Mode TV</h2>
      <p className="text-sm text-foreground-muted mb-4">
        Temps d'affichage de chaque salle en mode TV (alternance automatique).
      </p>
      <div className="flex items-center gap-4">
        <span className="text-sm text-foreground-muted w-12">3s</span>
        <input
          type="range"
          min={3000}
          max={30000}
          step={1000}
          value={value}
          onChange={handleChange}
          className="flex-1 accent-primary"
        />
        <span className="text-sm text-foreground-muted w-12">30s</span>
      </div>
      <p className="text-center text-sm font-medium mt-2">{value / 1000}s</p>
    </div>
  );
}
