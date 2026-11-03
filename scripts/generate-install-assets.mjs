import { mkdirSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const INSTALL_URL = 'https://itsonthefridge.jdsstudio.ca/install';
const OUT_DIR = 'public/install-assets';
const VERSION = 3;
const SIZE = VERSION * 4 + 17;

const DARK = '#0b3048';
const TEAL = '#63c7bd';
const PINK = '#e83d8c';
const YELLOW = '#ffe22e';
const CREAM = '#fbf9f3';
const WHITE = '#ffffff';

mkdirSync(OUT_DIR, { recursive: true });

function makeQr(text) {
  const { modules } = QRCode.create(text, { version: VERSION, errorCorrectionLevel: 'L' });
  return Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_, col) => Boolean(modules.get(row, col))),
  );
}
function qrRects(modules, scale = 1, offsetX = 0, offsetY = 0) {
  const rects = [];
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(`<rect x="${offsetX + x * scale}" y="${offsetY + y * scale}" width="${scale}" height="${scale}"/>`);
    });
  });
  return rects.join('');
}

function qrSvg(modules) {
  const quiet = 4;
  const viewSize = SIZE + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="740" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="QR code for ${INSTALL_URL}">
  <title>${INSTALL_URL}</title>
  <rect width="${viewSize}" height="${viewSize}" rx="2" fill="${WHITE}"/>
  <g fill="${DARK}">${qrRects(modules, 1, quiet, quiet)}</g>
</svg>
`;
}

function badge(text, x, y, width) {
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="54" rx="27" fill="${WHITE}" stroke="${TEAL}" stroke-width="3"/>
    <text x="${x + width / 2}" y="${y + 36}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="${DARK}">${text}</text>
  </g>`;
}

function badgeGroup(width, y) {
  const rowGap = 24;
  const firstRowWidth = 212 + rowGap + 236;
  const firstRowX = (width - firstRowWidth) / 2;
  const secondRowWidth = 388;
  const secondRowX = (width - secondRowWidth) / 2;

  return `${badge('✓ iPhone', firstRowX, y, 212)}
  ${badge('✓ Android', firstRowX + 212 + rowGap, y, 236)}
  ${badge('✓ No App Store Required', secondRowX, y + 68, secondRowWidth)}`;
}

function featureDots(width, height) {
  return `<circle cx="${width - 120}" cy="112" r="48" fill="${YELLOW}"/>
  <circle cx="102" cy="${height - 116}" r="44" fill="${PINK}" opacity="0.95"/>
  <rect x="${width - 216}" y="${height - 202}" width="92" height="92" rx="18" fill="${TEAL}" transform="rotate(-8 ${width - 170} ${height - 156})"/>`;
}

function socialSvg({ width, height, qrSize, qrY, titleSize, titleY, ctaY, badgeY }) {
  const qrX = (width - qrSize) / 2;
  const moduleSize = qrSize / (SIZE + 8);
  const modulesOffset = qrX + moduleSize * 4;
  const qrOffsetY = qrY + moduleSize * 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="It's On The Fridge install QR code">
  <title>${INSTALL_URL}</title>
  <rect width="${width}" height="${height}" fill="${CREAM}"/>
  ${featureDots(width, height)}
  <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800" fill="${DARK}">
    <tspan x="${width / 2}">Turn Your Favorite Photos</tspan>
    <tspan x="${width / 2}" dy="${titleSize + 12}">Into Custom Fridge Magnets</tspan>
  </text>
  <rect x="${qrX - 24}" y="${qrY - 24}" width="${qrSize + 48}" height="${qrSize + 48}" rx="36" fill="${WHITE}" stroke="${DARK}" stroke-width="8"/>
  <g fill="${DARK}">${qrRects(modules, moduleSize, modulesOffset, qrOffsetY)}</g>
  <text x="${width / 2}" y="${ctaY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="800" fill="${DARK}">📱 Scan to Install &amp; Start Designing</text>
  ${badgeGroup(width, badgeY)}
</svg>
`;
}

const modules = makeQr(INSTALL_URL);

writeFileSync(`${OUT_DIR}/install-qr.svg`, qrSvg(modules));
writeFileSync(`${OUT_DIR}/instagram-post-1080x1080.svg`, socialSvg({ width: 1080, height: 1080, qrSize: 430, qrY: 300, titleSize: 56, titleY: 120, ctaY: 820, badgeY: 870 }));
writeFileSync(`${OUT_DIR}/instagram-portrait-1080x1350.svg`, socialSvg({ width: 1080, height: 1350, qrSize: 560, qrY: 335, titleSize: 62, titleY: 145, ctaY: 1010, badgeY: 1070 }));
writeFileSync(`${OUT_DIR}/facebook-post-1200x1200.svg`, socialSvg({ width: 1200, height: 1200, qrSize: 500, qrY: 325, titleSize: 64, titleY: 135, ctaY: 935, badgeY: 990 }));

console.log(`Generated install QR assets for ${INSTALL_URL}`);
