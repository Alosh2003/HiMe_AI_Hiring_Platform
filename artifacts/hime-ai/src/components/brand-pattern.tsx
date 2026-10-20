import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Hire me brand motif: a bold arrow pointing up-right, redrawn from the
 * brand tiles — a triangular head seating into the top-right corner and a
 * thick 45° shaft landing on the bottom-left. Still one path, one color, so
 * it scales from the 16px favicon tile to a full-page background.
 */
export const BRAND_ARROW_PATH =
  'M22 2L12 2L14.53 4.53L3.53 15.53L8.47 20.47L19.47 9.47L22 12Z';

/** The shaft joins the head along the hypotenuse x−y=10 (12,2 → 22,12). */

/** Solid mark. `currentColor` throughout — inherits from any text-* class. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" data-testid="brand-mark" className={className}>
      <path d={BRAND_ARROW_PATH} />
    </svg>
  );
}

/**
 * A tiled dot-and-arrow background layer, echoing the faint dot grid on the
 * brand's dark tiles with a small arrow mark per tile. Absolutely
 * positioned — the parent needs `relative` (or equivalent) and, when the
 * pattern must sit behind content, `isolate` plus a negative z-index on this
 * element's className. Color comes from `currentColor` (via a `text-*`
 * class) and intensity from a Tailwind `opacity-*` class, so every
 * deployment tunes it independently.
 */
export function BrandPattern({ className }: { className?: string }) {
  // Pattern ids must be unique per instance and safe inside url(#…) — React's
  // useId carries decorations that differ per version (':' in 18, '«»' in 19),
  // so keep only the alphanumeric core.
  const id = `hime-arrow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-testid="brand-pattern"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    >
      <defs>
        <pattern id={id} width="96" height="96" patternUnits="userSpaceOnUse">
          {/* Dots centered on the tile corners — four quarter-dots meet at
              every grid intersection to form one full dot, like the faint
              dot grid on the brand's dark tiles. */}
          <circle cx="0" cy="0" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="96" cy="0" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="0" cy="96" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="96" cy="96" r="2" fill="currentColor" opacity="0.4" />
          <circle cx="48" cy="0" r="1.4" fill="currentColor" opacity="0.25" />
          <circle cx="0" cy="48" r="1.4" fill="currentColor" opacity="0.25" />
          <circle cx="96" cy="48" r="1.4" fill="currentColor" opacity="0.25" />
          <circle cx="48" cy="96" r="1.4" fill="currentColor" opacity="0.25" />
          {/* The arrow mark centered in the tile. */}
          <path
            d={BRAND_ARROW_PATH}
            transform="translate(36.5 35.5)"
            fill="currentColor"
            opacity="0.55"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
