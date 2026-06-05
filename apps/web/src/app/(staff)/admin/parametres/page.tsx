'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';
import { QrGenerator } from '@/components/admin/QrGenerator';

const MAX_LOGO_SIZE = 500 * 1024; // 500 Ko

const REGULATION_TEMPLATE = `IX.111 — Règlement du tournoi

- Catégorie du tournoi : {categorie}
- Date et lieu : {date_lieu}
- Responsable de l'organisation : {responsable}
- Juge-arbitre désigné : {juge_arbitre}
- Nombre de tables et dimensions des aires de jeu : {nb_tables}
- Marque des balles fournies : {balles}
- Tableaux organisés : {tableaux}
- Joueurs autorisés : {joueurs_autorises}
- Nombre maximum de joueurs par tableau : {max_joueurs}
- Horaires de début de chaque tableau : {horaires_debut}
- Horaires prévisionnels des finales : {horaires_finales}
- Horaire de fin prévisionnelle : {horaire_fin}
- Date de clôture des engagements : {date_cloture}
- Montant des engagements : {montant_engagement}
- Date, heure et lieu du tirage au sort public : {tirage_au_sort}
- Numéro d'homologation : {homologation}
- Mode d'attribution challenge / coupe : {challenge}

Variables disponibles : {categorie}, {date_lieu}, {responsable}, {juge_arbitre},
{nb_tables}, {balles}, {tableaux}, {joueurs_autorises}, {max_joueurs},
{horaires_debut}, {horaires_finales}, {horaire_fin}, {date_cloture},
{montant_engagement}, {tirage_au_sort}, {homologation}, {challenge}.`;

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
