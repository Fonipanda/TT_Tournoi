'use client';

import { useState, type ReactNode } from 'react';

/**
 * Toggle slider style iOS pour basculer entre 2 vues
 * (ex: Poules / Tableau final).
 */
export function ProgressionToggle({
  poolsContent,
  bracketContent,
}: {
  poolsContent: ReactNode;
  bracketContent: ReactNode;
}) {
  const [showBracket, setShowBracket] = useState(false);

  return (
    <div>
      {/* Toggle slider */}
      <div className="flex items-center justify-center mb-8">
        <button
          type="button"
          onClick={() => setShowBracket((v) => !v)}
          aria-label={showBracket ? 'Voir les poules' : 'Voir le tableau final'}
          className="relative inline-flex items-center gap-3 select-none cursor-pointer"
        >
          <span
            className={`text-sm font-heading uppercase tracking-wider transition-colors ${
              !showBracket ? 'text-primary font-bold' : 'text-foreground-muted'
            }`}
          >
            Poules
          </span>

          {/* Slider track */}
          <div
            className="relative w-20 h-10 rounded-full transition-all duration-300 shadow-inner"
            style={{
              background: showBracket
                ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                : 'linear-gradient(135deg, #10b981, #06b6d4)',
            }}
          >
            {/* Slider thumb (cercle blanc) */}
            <div
              className="absolute top-1 left-1 w-8 h-8 rounded-full bg-white shadow-md transition-transform duration-300 ease-out"
              style={{
                transform: showBracket ? 'translateX(40px)' : 'translateX(0)',
              }}
            />
          </div>

          <span
            className={`text-sm font-heading uppercase tracking-wider transition-colors ${
              showBracket ? 'text-primary font-bold' : 'text-foreground-muted'
            }`}
          >
            Tableau final
          </span>
        </button>
      </div>

      {/* Content (un seul affiché à la fois) */}
      <div>
        {!showBracket && poolsContent}
        {showBracket && bracketContent}
      </div>
    </div>
  );
}
