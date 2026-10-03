// Renders assets/images/*.png from SVG: the extension's marigold sundial mark on Toki indigo.
// Run with `npm run icons` after changing the mark.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const INK = '#1b1f3b';
const MARIGOLD = '#f2a900';

/** The sundial, drawn in a 128-unit box. */
const mark = (color) => `
  <path d="M24 84a40 40 0 0 1 80 0" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
  <path d="M64 84 86 46" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
  <circle cx="64" cy="84" r="7" fill="${color}"/>
  <rect x="20" y="96" width="88" height="8" rx="4" fill="${color}"/>`;

/** `scale` shrinks the mark around the centre, for Android's adaptive-icon safe zone. */
const svg = ({ background, color, scale = 1 }) => {
  const offset = (128 - 128 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    ${background ? `<rect width="128" height="128" fill="${background}"/>` : ''}
    <g transform="translate(${offset} ${offset - 6 * scale}) scale(${scale})">${mark(color)}</g>
  </svg>`;
};

const render = (file, size, opts) =>
  writeFileSync(`assets/images/${file}`, new Resvg(svg(opts), { fitTo: { mode: 'width', value: size } }).render().asPng());

render('icon.png', 1024, { background: INK, color: MARIGOLD, scale: 0.78 });
render('android-icon-foreground.png', 1024, { color: MARIGOLD, scale: 0.55 });
render('android-icon-background.png', 1024, { background: INK, color: 'transparent', scale: 0 });
render('android-icon-monochrome.png', 1024, { color: '#ffffff', scale: 0.55 });
render('splash-icon.png', 512, { color: MARIGOLD, scale: 0.9 });
render('favicon.png', 48, { background: INK, color: MARIGOLD, scale: 0.8 });
