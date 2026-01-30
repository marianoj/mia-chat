#!/usr/bin/env node

/**
 * Simple script to generate PWA icons
 * Run: node scripts/generate-pwa-icons.mjs
 *
 * For production, replace these with your actual app icons.
 * You can use tools like:
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 */

import fs from 'fs';
import path from 'path';

const sizes = [192, 512];
const iconsDir = path.join(process.cwd(), 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate simple SVG-based placeholder icons
sizes.forEach(size => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000000" rx="${size * 0.1}"/>
  <text x="${size / 2}" y="${size * 0.48}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.15}" font-weight="bold" fill="white" text-anchor="middle">Agent</text>
  <text x="${size / 2}" y="${size * 0.65}" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.15}" font-weight="bold" fill="white" text-anchor="middle">Inbox</text>
</svg>`;

  const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created ${svgPath}`);
});

console.log(`
PWA icon placeholders created!

For production, you should replace these SVG files with proper PNG icons.
You can convert SVG to PNG using:
- Online tools like https://cloudconvert.com/svg-to-png
- ImageMagick: convert icon-192x192.svg icon-192x192.png
- Or use a PWA icon generator: https://www.pwabuilder.com/imageGenerator

After creating PNG files, update public/manifest.json if needed.
`);
