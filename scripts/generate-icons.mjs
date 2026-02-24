/**
 * Generate app icons for "The Two of Us"
 * Design: Two overlapping hearts on dark background with soft pink/rose gradient
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// SVG icon: two interlinked hearts on rounded dark background
function createIconSvg(size) {
  // Scale everything relative to a 512 base
  const s = size / 512

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="heart1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
    <linearGradient id="heart2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fda4af"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
  </defs>
  <!-- Rounded background -->
  <rect width="512" height="512" rx="108" ry="108" fill="url(#bg)"/>
  <!-- Heart 1 (left, slightly behind) -->
  <g transform="translate(230, 260) scale(0.52)" opacity="0.85">
    <path d="M0-200 C-70-200 -200-160 -200-40 C-200 80 0 200 0 200 C0 200 200 80 200-40 C200-160 70-200 0-200Z" 
          fill="url(#heart2)" transform="rotate(-12)"/>
  </g>
  <!-- Heart 2 (right, in front) -->
  <g transform="translate(282, 250) scale(0.52)">
    <path d="M0-200 C-70-200 -200-160 -200-40 C-200 80 0 200 0 200 C0 200 200 80 200-40 C200-160 70-200 0-200Z" 
          fill="url(#heart1)" transform="rotate(8)"/>
  </g>
</svg>`
}

// Maskable icon: same but with more padding (safe area = 80% of icon)
function createMaskableSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="heart1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
    <linearGradient id="heart2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fda4af"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
  </defs>
  <!-- Full bleed background (no rounded corners for maskable) -->
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Hearts scaled down to fit safe area (center 80%) -->
  <g transform="translate(256, 256) scale(0.65) translate(-256, -256)">
    <g transform="translate(230, 260) scale(0.52)" opacity="0.85">
      <path d="M0-200 C-70-200 -200-160 -200-40 C-200 80 0 200 0 200 C0 200 200 80 200-40 C200-160 70-200 0-200Z" 
            fill="url(#heart2)" transform="rotate(-12)"/>
    </g>
    <g transform="translate(282, 250) scale(0.52)">
      <path d="M0-200 C-70-200 -200-160 -200-40 C-200 80 0 200 0 200 C0 200 200 80 200-40 C200-160 70-200 0-200Z" 
            fill="url(#heart1)" transform="rotate(8)"/>
    </g>
  </g>
</svg>`
}

async function main() {
  const iconSvg = Buffer.from(createIconSvg(512))
  const maskableSvg = Buffer.from(createMaskableSvg(512))

  // Generate standard icons
  const sizes = [32, 180, 192, 512]
  for (const size of sizes) {
    const buf = await sharp(iconSvg).resize(size, size).png().toBuffer()

    if (size === 32) {
      writeFileSync(join(ROOT, 'app', 'favicon.ico'), buf)
      console.log(`✓ app/favicon.ico (${size}×${size})`)
    }
    if (size === 180) {
      writeFileSync(join(ROOT, 'public', 'icons', 'apple-touch-icon.png'), buf)
      console.log(`✓ public/icons/apple-touch-icon.png (${size}×${size})`)
    }
    if (size === 192) {
      writeFileSync(join(ROOT, 'public', 'icons', 'icon-192.png'), buf)
      console.log(`✓ public/icons/icon-192.png (${size}×${size})`)
    }
    if (size === 512) {
      writeFileSync(join(ROOT, 'public', 'icons', 'icon-512.png'), buf)
      console.log(`✓ public/icons/icon-512.png (${size}×${size})`)
    }
  }

  // Generate maskable icon (512px)
  const maskBuf = await sharp(maskableSvg).resize(512, 512).png().toBuffer()
  writeFileSync(join(ROOT, 'public', 'icons', 'maskable-512.png'), maskBuf)
  console.log('✓ public/icons/maskable-512.png (512×512, maskable)')

  // Also save the SVG for reference / modern browsers
  writeFileSync(join(ROOT, 'app', 'icon.svg'), createIconSvg(512))
  console.log('✓ app/icon.svg')

  console.log('\nDone! All icons generated.')
}

main().catch(console.error)
