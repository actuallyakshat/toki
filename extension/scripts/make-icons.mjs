// Renders public/icon/*.png from an SVG: an ink rounded square with a marigold sundial mark.
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="30" fill="#1b1f3b"/>
  <path d="M24 84a40 40 0 0 1 80 0" fill="none" stroke="#f2a900" stroke-width="8" stroke-linecap="round"/>
  <path d="M64 84 86 46" stroke="#f2a900" stroke-width="8" stroke-linecap="round"/>
  <circle cx="64" cy="84" r="7" fill="#f2a900"/>
  <rect x="20" y="96" width="88" height="8" rx="4" fill="#f2a900"/>
</svg>`;

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/icon/${size}.png`, png);
}
