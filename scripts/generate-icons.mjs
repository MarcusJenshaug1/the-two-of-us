/**
 * Generate app icons for "The Two of Us" / Us2.
 * Design: Two overlapping hearts leaning toward each other.
 *
 * Palette: dusty rose on warm cream off-white.
 *   bg gradient    : #fbf6f1 → #f5ece2  (warm cream)
 *   heart-1 (back) : #ecafb6 → #c46778  (light dusty rose)
 *   heart-2 (front): #d8838f → #a8526a  (deep dusty rose)
 *
 * PWA / apple icons are full-bleed with a solid background — no transparent
 * corners — so iOS Safari does not fill them with black and Android launchers
 * do not double-mask an already rounded shape. The browser favicon
 * (app/icon.svg) keeps the rounded silhouette since it is rendered as-is.
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Standard heart path (viewBox 0 0 24 24, Material Design heart).
const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'

const PALETTE = {
  bgFrom: '#fbf6f1',
  bgTo:   '#f5ece2',
  h1From: '#ecafb6',
  h1To:   '#c46778',
  h2From: '#d8838f',
  h2To:   '#a8526a',
}

function gradients() {
  return `
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PALETTE.bgFrom}"/>
      <stop offset="100%" stop-color="${PALETTE.bgTo}"/>
    </linearGradient>
    <linearGradient id="h1" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${PALETTE.h1From}"/>
      <stop offset="100%" stop-color="${PALETTE.h1To}"/>
    </linearGradient>
    <linearGradient id="h2" x1="0.5" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PALETTE.h2From}"/>
      <stop offset="100%" stop-color="${PALETTE.h2To}"/>
    </linearGradient>`
}

// Browser favicon (app/icon.svg) — keeps the rounded silhouette.
function createFaviconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${gradients()}
  </defs>
  <rect width="512" height="512" rx="108" ry="108" fill="url(#bg)"/>
  <g transform="translate(218, 244) scale(12.5) translate(-12, -12) rotate(-15, 12, 12)" opacity="0.7">
    <path d="${HEART}" fill="url(#h1)"/>
  </g>
  <g transform="translate(294, 244) scale(12.5) translate(-12, -12) rotate(15, 12, 12)">
    <path d="${HEART}" fill="url(#h2)"/>
  </g>
</svg>`
}

// Full-bleed PWA / apple icon — solid background, no rounded corners.
// Android launchers and iOS apply their own masks; an already-rounded source
// produces double-masking and visible black/transparent corners.
function createIconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${gradients()}
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(218, 244) scale(12.5) translate(-12, -12) rotate(-15, 12, 12)" opacity="0.7">
    <path d="${HEART}" fill="url(#h1)"/>
  </g>
  <g transform="translate(294, 244) scale(12.5) translate(-12, -12) rotate(15, 12, 12)">
    <path d="${HEART}" fill="url(#h2)"/>
  </g>
</svg>`
}

// Maskable icon: solid cream background (no transparency, no rounding —
// the launcher applies the mask). Hearts shrunk to fit the safe area.
function createMaskableSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${gradients()}
  </defs>
  <rect width="512" height="512" fill="${PALETTE.bgFrom}"/>
  <g transform="translate(256, 256) scale(0.65) translate(-256, -256)">
    <g transform="translate(218, 244) scale(12.5) translate(-12, -12) rotate(-15, 12, 12)" opacity="0.7">
      <path d="${HEART}" fill="url(#h1)"/>
    </g>
    <g transform="translate(294, 244) scale(12.5) translate(-12, -12) rotate(15, 12, 12)">
      <path d="${HEART}" fill="url(#h2)"/>
    </g>
  </g>
</svg>`
}

// Open Graph / Twitter share image (1200×630).
// Centered mark on warm cream background + wordmark.
function createOgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${gradients()}
    <linearGradient id="ogbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbf6f1"/>
      <stop offset="100%" stop-color="#f5ece2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ogbg)"/>
  <!-- Subtle dusty-rose halo behind hearts -->
  <ellipse cx="600" cy="285" rx="320" ry="180" fill="#fbe6ea" opacity="0.6"/>
  <!-- Hearts (same proportions as app icon, scaled for OG canvas) -->
  <g transform="translate(540, 285) scale(8) translate(-12, -12) rotate(-15, 12, 12)" opacity="0.7">
    <path d="${HEART}" fill="url(#h1)"/>
  </g>
  <g transform="translate(660, 285) scale(8) translate(-12, -12) rotate(15, 12, 12)">
    <path d="${HEART}" fill="url(#h2)"/>
  </g>
  <!-- Wordmark -->
  <text x="600" y="490" text-anchor="middle"
        font-family="Inter, system-ui, sans-serif"
        font-size="64" font-weight="700" fill="#2b1f1d"
        letter-spacing="-1.5">The Two of Us</text>
  <text x="600" y="540" text-anchor="middle"
        font-family="Inter, system-ui, sans-serif"
        font-size="22" font-weight="500" fill="#80675f"
        letter-spacing="0.5">A private space for couples · us2.no</text>
</svg>`
}

async function main() {
  const iconSvg     = Buffer.from(createIconSvg(512))
  const faviconSvg  = Buffer.from(createFaviconSvg(512))
  const maskableSvg = Buffer.from(createMaskableSvg(512))
  const ogSvg       = Buffer.from(createOgSvg())

  // 32×32 favicon — keep rounded silhouette to match browser tab.
  const faviconBuf = await sharp(faviconSvg).resize(32, 32).png().toBuffer()
  writeFileSync(join(ROOT, 'app', 'favicon.ico'), faviconBuf)
  console.log('✓ app/favicon.ico (32×32)')

  // Apple icon — Next.js auto-detects app/apple-icon.png.
  const appleBuf = await sharp(iconSvg).resize(180, 180).png().toBuffer()
  writeFileSync(join(ROOT, 'app', 'apple-icon.png'), appleBuf)
  console.log('✓ app/apple-icon.png (180×180, full-bleed)')

  // PWA icons — full-bleed, served from public/icons/.
  for (const size of [192, 512]) {
    const buf = await sharp(iconSvg).resize(size, size).png().toBuffer()
    writeFileSync(join(ROOT, 'public', 'icons', `icon-${size}.png`), buf)
    console.log(`✓ public/icons/icon-${size}.png (${size}×${size}, full-bleed)`)
  }

  const maskBuf = await sharp(maskableSvg).resize(512, 512).png().toBuffer()
  writeFileSync(join(ROOT, 'public', 'icons', 'icon-maskable-512.png'), maskBuf)
  console.log('✓ public/icons/icon-maskable-512.png (512×512, maskable)')

  const ogBuf = await sharp(ogSvg).resize(1200, 630).png().toBuffer()
  writeFileSync(join(ROOT, 'public', 'og-image.png'), ogBuf)
  console.log('✓ public/og-image.png (1200×630, social share)')

  writeFileSync(join(ROOT, 'app', 'icon.svg'), createFaviconSvg(512))
  console.log('✓ app/icon.svg')

  console.log('\nDone! All icons regenerated.')
}

main().catch(err => { console.error(err); process.exit(1) })
