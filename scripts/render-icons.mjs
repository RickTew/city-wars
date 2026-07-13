/**
 * Rasterize public/icons/icon.svg → PNG sizes for PWA / iOS.
 * Usage: npm i --no-save @resvg/resvg-js && node scripts/render-icons.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svgPath = join(root, 'public/icons/icon.svg');

let Resvg;
try {
  ({ Resvg } = await import('@resvg/resvg-js'));
} catch {
  console.error('Install once: npm i --no-save @resvg/resvg-js');
  process.exit(1);
}

const svg = readFileSync(svgPath);

function render(size, out) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  writeFileSync(join(root, out), png);
  console.log('wrote', out, png.length);
}

render(32, 'public/icons/favicon-32.png');
render(180, 'public/icons/apple-touch-icon.png');
render(192, 'public/icons/icon-192.png');
render(512, 'public/icons/icon-512.png');
render(512, 'public/icons/icon-512-maskable.png');
console.log('done');
