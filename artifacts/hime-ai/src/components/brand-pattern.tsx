import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The HiMe AI brand motif: an eight-point star (two overlapping squares — the
 * classical khatim construction, drawn here as its exact 16-point outline) with
 * a small four-point spark at the center. One path, one color, scales from a
 * 16px favicon tile to a full-page background.
 */
export const BRAND_STAR_PATH =
  'M12 1.54L15.07 4.6L19.4 4.6L19.4 8.94L22.46 12L19.4 15.07L19.4 19.4L15.07 19.4L12 22.46L8.93 19.4L4.6 19.4L4.6 15.07L1.54 12L4.6 8.94L4.6 4.6L8.94 4.6Z';

/** The spark nested in the star's center (concave four-point star). */
export const BRAND_SPARK_PATH =
  'M12 8.3Q12.45 11.55 15.7 12Q12.45 12.45 12 15.7Q11.55 12.45 8.3 12Q11.55 11.55 12 8.3Z';

/** Solid mark. `currentColor` for the star; the spark is a cutout so the
 *  surface behind it shows through on any background. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" data-testid="brand-mark" className={className}>
      <path fillRule="evenodd" d={`${BRAND_STAR_PATH} ${BRAND_SPARK_PATH}`} />
    </svg>
  );
}

/**
 * A tiled star-lattice background layer. Absolutely positioned — the parent
 * needs `relative` (or equivalent) and, when the pattern must sit behind
 * content, `isolate` plus a negative z-index on this element's className.
 * Color comes from `currentColor` (via a `text-*` class) and intensity from a
 * Tailwind `opacity-*` class, so every deployment tunes it independently.
 */
export function BrandPattern({ className }: { className?: string }) {
  // Pattern ids must be unique per instance and safe inside url(#…) — React's
  // useId carries decorations that differ per version (':' in 18, '«»' in 19),
  // so keep only the alphanumeric core.
  const id = `hime-star-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-testid="brand-pattern"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    >
      <defs>
        <pattern id={id} width="96" height="96" patternUnits="userSpaceOnUse">
          {/* Star outline, centered in the tile. */}
          <path
            d={BRAND_STAR_PATH}
            transform="translate(19.2 19.2) scale(2.4)"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* Sparks centered on the tile corners — four quarter-marks meet at
              every grid intersection to form one full spark. */}
          <path d={BRAND_SPARK_PATH} transform="translate(-19.2 -19.2) scale(1.6)" fill="currentColor" opacity="0.5" />
          <path d={BRAND_SPARK_PATH} transform="translate(76.8 -19.2) scale(1.6)" fill="currentColor" opacity="0.5" />
          <path d={BRAND_SPARK_PATH} transform="translate(-19.2 76.8) scale(1.6)" fill="currentColor" opacity="0.5" />
          <path d={BRAND_SPARK_PATH} transform="translate(76.8 76.8) scale(1.6)" fill="currentColor" opacity="0.5" />
          {/* Dots at the edge midpoints stitch the tiles into a lattice. */}
          <circle cx="48" cy="0" r="1.5" fill="currentColor" opacity="0.35" />
          <circle cx="0" cy="48" r="1.5" fill="currentColor" opacity="0.35" />
          <circle cx="48" cy="96" r="1.5" fill="currentColor" opacity="0.35" />
          <circle cx="96" cy="48" r="1.5" fill="currentColor" opacity="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
