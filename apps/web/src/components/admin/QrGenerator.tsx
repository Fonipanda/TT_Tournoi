'use client';

import { useState, useRef, useEffect } from 'react';
import { TextField, TextAreaField } from '@/components/ui/fields';
import { toast } from '@/components/ui/toast';

interface Props {
  initialLogoUrl?: string | null;
}

export function QrGenerator({ initialLogoUrl }: Props) {
  const [url, setUrl] = useState('https://tournoi-chellestt.fr');
  const [text, setText] = useState('Scanne pour t\'inscrire au tournoi');
  const [size, setSize] = useState(400);
  const [generated, setGenerated] = useState<string | null>(null);
  const [centerImage, setCenterImage] = useState<string | null>(initialLogoUrl ?? null);
  const [version, setVersion] = useState(0); // pour forcer le recalcul + cache-bust
  const printRef = useRef<HTMLDivElement>(null);

  // Re-générer la valeur (avec cache-bust)
  const generate = () => {
    setVersion((v) => v + 1);
    // Concaténer URL + texte dans le QR data
    const data = text ? `${url}\n\n${text}` : url;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
      data,
    )}&size=${size}x${size}&ecc=H&margin=10&v=${Date.now()}`;
    setGenerated(qrUrl);
    toast.success('QR Code généré');
  };

  const onLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast.error('Image trop grande (max 200 Ko)');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setCenterImage(dataUrl);
  };

  const printQr = () => {
    if (!generated) return;
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) {
      toast.error('Impossible d\'ouvrir la fenêtre d\'impression');
      return;
    }
    w.document.write(`
      <html>
      <head>
        <title>QR Code TT Tournoi</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 40px; }
          h1 { font-size: 28px; text-transform: uppercase; letter-spacing: 0.05em; color: #0284C7; margin-bottom: 10px; }
          .qr-wrap { position: relative; display: inline-block; margin: 20px 0; }
          .qr-wrap img.qr { display: block; width: ${size}px; height: ${size}px; }
          .qr-wrap img.logo {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: ${Math.round(size * 0.18)}px; height: ${Math.round(size * 0.18)}px;
            background: white; padding: 6px; border-radius: 6px;
          }
          .url { font-family: monospace; font-size: 14px; color: #475569; margin-top: 12px; word-break: break-all; }
          .text { font-size: 16px; margin-top: 16px; max-width: 500px; margin-left: auto; margin-right: auto; }
        </style>
      </head>
      <body>
        <h1>${text || 'TT Tournoi'}</h1>
        <div class="qr-wrap">
          <img class="qr" src="${generated}" alt="QR Code" />
          ${centerImage ? `<img class="logo" src="${centerImage}" alt="Logo" />` : ''}
        </div>
        <p class="url">${url}</p>
        ${text ? `<p class="text">${text}</p>` : ''}
        <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
      </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="card max-w-2xl rounded-2xl">
      <h2 className="font-heading text-xl uppercase tracking-wide mb-3">Générateur QR Code</h2>
      <p className="text-sm text-foreground-muted mb-4">
        Crée un QR code intégrant une URL et un texte libre, avec une image au centre.
      </p>

      <div className="space-y-3">
        <TextField
          label="URL"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tournoi-chellestt.fr/inscription"
          required
        />
        <TextAreaField
          label="Texte (optionnel, intégré au QR)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scanne pour t'inscrire"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1">Image au centre (optionnelle)</label>
            <label className="btn-secondary text-sm cursor-pointer inline-block">
              📁 Choisir une image
              <input
                type="file"
                accept="image/*"
                onChange={onLogoFile}
                className="hidden"
              />
            </label>
            {centerImage && (
              <button
                type="button"
                onClick={() => setCenterImage(null)}
                className="text-danger text-xs hover:underline ml-3"
              >
                Retirer
              </button>
            )}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Taille (px)</label>
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              min={200}
              max={1000}
              step={50}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={generate}
            className="btn-primary text-sm rounded-full"
            data-testid="generate-qr"
          >
            🔄 Générer un nouveau QR Code
          </button>
          {generated && (
            <button
              type="button"
              onClick={printQr}
              className="btn-secondary text-sm rounded-full"
              data-testid="print-qr"
            >
              🖨 Imprimer
            </button>
          )}
        </div>
      </div>

      {generated && (
        <div ref={printRef} className="mt-6 text-center" data-testid="qr-preview">
          <div
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <img
              key={version}
              src={generated}
              alt="QR Code"
              className="block"
              style={{ width: size, height: size }}
            />
            {centerImage && (
              <img
                src={centerImage}
                alt="Logo"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-md object-contain"
                style={{
                  width: Math.round(size * 0.18),
                  height: Math.round(size * 0.18),
                }}
              />
            )}
          </div>
          <p className="text-xs font-mono text-foreground-muted mt-3 break-all">{url}</p>
          {text && <p className="text-sm mt-2 max-w-md mx-auto">{text}</p>}
        </div>
      )}
    </div>
  );
}
