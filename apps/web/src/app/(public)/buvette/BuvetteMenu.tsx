'use client';

import { useState } from 'react';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
}

interface MenuSection {
  id: string;
  name: string;
  items: MenuItem[];
}

function ItemImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="w-14 h-14 object-cover rounded-md border border-border flex-shrink-0"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

export function BuvetteMenu({ sections }: { sections: MenuSection[] }) {
  return (
    <div data-testid="buvette-page">
      <h1 className="font-heading text-3xl uppercase tracking-wide mb-6">Buvette</h1>
      {sections.length === 0 ? (
        <p className="text-foreground-muted">Menu non encore configuré.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => (
            <section
              key={s.id}
              className="card rounded-2xl shadow-sm hover:shadow-md transition-shadow"
              data-testid={`menu-section-${s.id}`}
            >
              <h2 className="font-heading text-2xl uppercase tracking-wide mb-3 text-primary">
                {s.name}
              </h2>
              <ul className="divide-y divide-border">
                {s.items.map((it) => (
                  <li key={it.id} className="py-2 flex items-center gap-3">
                    {it.imageUrl && <ItemImage src={it.imageUrl} alt={it.name} />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{it.name}</p>
                      {it.description && (
                        <p className="text-sm text-foreground-muted truncate">
                          {it.description}
                        </p>
                      )}
                    </div>
                    <span className="font-mono tabular text-primary font-semibold whitespace-nowrap">
                      {Number(it.price).toFixed(2)} €
                    </span>
                  </li>
                ))}
                {s.items.length === 0 && (
                  <li className="py-2 text-foreground-subtle text-sm">Aucun article</li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
