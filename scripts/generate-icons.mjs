/**
 * Generate app icons for "The Two of Us"
 * Design: Two overlapping hearts leaning toward each other on dark background
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Standard heart path (viewBox 0 0 24 24, from Material Design)
// Centered at roughly (12, 12)
const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'

function createIconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="h1" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#fda4af"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
    <linearGradient id="h2" x1="0.5" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <!-- Rounded background -->
  <rect width="512" height="512" rx="108" ry="108" fill="url(#bg)"/>

  <!-- Heart left — slightly tilted right, behind -->
  <g transform="translate(218, 244) scale(12.5) translate(-12, -12) rotate(-15, 12, 12)" opacity="0.7">
    <path d="${HEART}" fill="url(#h1)"/>
  </g>

  <!-- Heart right — slightly tilted left, in front -->
  <g transform="translate(294, 244) scale(12.5) translate(-12, -12) rotate(15, 12, 12)">
    <path d="${HEART}" fill="url(#h2)"/>
  </g>
</svg>`
}

function createMaskableSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="h1" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#fda4af"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
    <linearGradient id="h2" x1="0.5" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fb7185"/>
      <stop offset="100%" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>

  <!-- Scaled down 65% to fit in maskable safe area -->
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
