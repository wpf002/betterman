/**
 * Rasterizes the PWA icon set from the BetterMan mark.
 *
 *   pnpm --filter @betterman/web icons
 *
 * The mark is committed as a single SVG with `fill: currentColor`
 * (public/brand/betterman-mark.svg), so every icon below is that one file
 * recoloured and padded — there is no second piece of artwork to keep in step.
 *
 * Two variants, because platforms crop differently:
 *   - "any"      — the mark on bone, with a modest margin. Used as-is.
 *   - "maskable" — the same mark inside the 80% safe zone Android crops to,
 *                  so a circular mask never clips the descender.
 * Apple gets its own square, since iOS ignores the manifest icons and does not
 * composite transparency.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const OUT_DIR = join(webRoot, 'public', 'icons');

/** Sampled BetterMan chrome — do not invent brand colors (spec §13). */
const BONE = '#F1F0EC';
const INK = '#1E1E1E';

/** Renders the mark at `markRatio` of the canvas, centred on `bg`. */
async function renderIcon({ size, markRatio, bg, fg, out }) {
  const svg = await readFile(join(webRoot, 'public', 'brand', 'betterman-mark.svg'), 'utf8');
  // The committed file uses currentColor; give it an explicit fill to rasterize.
  const coloured = svg.replace('fill="currentColor"', `fill="${fg}"`);

  const markSize = Math.round(size * markRatio);
  const mark = await sharp(Buffer.from(coloured))
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((size - markSize) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: mark, top: offset, left: offset }])
    .png()
    .toFile(join(OUT_DIR, out));

  console.log(`  ${out}  ${size}×${size}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('generating icons from public/brand/betterman-mark.svg');

  for (const size of [192, 512]) {
    // Standard icons: comfortable margin, no cropping expected.
    await renderIcon({ size, markRatio: 0.68, bg: BONE, fg: INK, out: `icon-${size}.png` });
    // Maskable: inside the 80% safe zone, so a circular crop keeps the mark whole.
    await renderIcon({
      size,
      markRatio: 0.52,
      bg: BONE,
      fg: INK,
      out: `icon-maskable-${size}.png`,
    });
  }

  // iOS home screen. Square, opaque, no transparency.
  await renderIcon({
    size: 180,
    markRatio: 0.62,
    bg: BONE,
    fg: INK,
    out: 'apple-touch-icon.png',
  });

  // Monochrome favicon for the browser tab.
  await renderIcon({ size: 32, markRatio: 0.86, bg: BONE, fg: INK, out: 'favicon-32.png' });

  // A tiny manifest of what was produced, so a stale set is obvious in review.
  await writeFile(
    join(OUT_DIR, 'README.md'),
    '# Generated icons\n\nProduced by `pnpm --filter @betterman/web icons` from\n`public/brand/betterman-mark.svg`. Do not edit by hand — regenerate instead.\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
