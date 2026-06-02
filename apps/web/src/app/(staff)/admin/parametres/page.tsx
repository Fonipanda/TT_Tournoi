'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { apiJson, ApiError } from '@/lib/api-client';
import { QrGenerator } from '@/components/admin/QrGenerator';

const MAX_LOGO_SIZE = 500 * 1024; // 500 Ko

export default function AdminParametresPage() {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((j) => setLogoUrl(j.data?.logo ?? null))
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
      // Convertir en data URL base64
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

  const remove = async () => {
    try {
      await apiJson('/api/settings/logo', { method: 'DELETE' });
      setLogoUrl(null);
      toast.success('Logo supprimé · "TT Tournoi" sera affiché');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Erreur');
    }
  };

  return (
    <div data-testid="admin-parametres" className="space-y-6">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Paramètres</h1>

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
                onClick={remove}
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

      {/* QR Code Generator */}
      <QrGenerator initialLogoUrl={logoUrl} />
    </div>
  );
}
