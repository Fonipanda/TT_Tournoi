'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';
import { QrGenerator } from '@/components/admin/QrGenerator';

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

export default function AdminParametresPage() {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [regulation, setRegulation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingRegulation, setSavingRegulation] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => {
        setLogoUrl(j.data?.logo ?? null);
        setRegulation(j.data?.regulation ?? '');
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

  return (
    <div data-testid="admin-parametres" className="space-y-6">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Paramètres</h1>

      {/* Logo */}
      <div className="card max-w-2xl rounded-2xl">
        <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Logo du site</h2>
        <p className="text-sm text-foreground-muted mb-4">
          Remplace le texte « TT Tournoi » dans l'en-tête. Max 500 Ko, formats PNG/JPEG/SVG/WebP.
          Le logo s'adapte automatiquement (max 40px de hauteur).
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

      {/* Règlement (FFTT IX.111) */}
      <div className="card max-w-4xl rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-xl uppercase tracking-wide">Règlement du tournoi</h2>
          <span className="text-xs text-foreground-muted">FFTT — Article IX.111</span>
        </div>
        <p className="text-sm text-foreground-muted mb-3">
          Le règlement est affiché publiquement sur la page <code>/reglement</code>. Utilise les
          variables <code>{'{nom_variable}'}</code> pour insérer dynamiquement les informations du
          tournoi (responsable, juge-arbitre, dates, etc.).
        </p>

        <div className="flex gap-2 mb-3">
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

        <textarea
          value={regulation}
          onChange={(e) => setRegulation(e.target.value)}
          rows={20}
          placeholder="Saisis le règlement, ou clique sur « Charger le template FFTT IX.111 »…"
          className="w-full font-mono text-sm border border-border rounded-lg p-3 bg-bg resize-y min-h-[200px]"
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

      {/* TV Display Interval */}
      <TvIntervalSlider />

      {/* QR Code Generator */}
      <QrGenerator initialLogoUrl={logoUrl} />
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
    <div className="card max-w-2xl rounded-2xl">
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
