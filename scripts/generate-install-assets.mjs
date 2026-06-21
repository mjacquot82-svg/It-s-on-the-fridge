import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const INSTALL_URL = 'https://itsonthefridge.appthat.ca/install';
const OUT_DIR = 'public/install-assets';
const VERSION = 3;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 55;
const EC_CODEWORDS = 15;
const ALIGNMENT_CENTERS = [6, 22];

const DARK = '#0b3048';
const TEAL = '#63c7bd';
const PINK = '#e83d8c';
const YELLOW = '#ffe22e';
const CREAM = '#fbf9f3';
const WHITE = '#ffffff';

mkdirSync(OUT_DIR, { recursive: true });
const LOGO_DATA_URI = `data:image/png;base64,${readFileSync('public/logo.png').toString('base64')}`;

function gfTables() {
  const exp = new Array(512);
  const log = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  return { exp, log };
}

const GF = gfTables();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}

function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= gfMul(poly[j], GF.exp[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data, degree) {
  const gen = generatorPoly(degree);
  const result = [...data, ...new Array(degree).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const coef = result[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j += 1) {
      result[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return result.slice(result.length - degree);
}

function bitsToCodewords(bits) {
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(Number.parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  return out;
}

function makeDataCodewords(text) {
  const bytes = new TextEncoder().encode(text);
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((byte) => push(byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  push(0, terminator);
  while (bits.length % 8) bits.push(0);

  const data = bitsToCodewords(bits);
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (data.length < DATA_CODEWORDS) {
    data.push(pads[padIndex % 2]);
    padIndex += 1;
  }
  return data;
}

function blankMatrix() {
  return {
    modules: Array.from({ length: SIZE }, () => new Array(SIZE).fill(false)),
    reserved: Array.from({ length: SIZE }, () => new Array(SIZE).fill(false)),
  };
}

function setModule(qr, row, col, value, reserve = true) {
  if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return;
  qr.modules[row][col] = Boolean(value);
  if (reserve) qr.reserved[row][col] = true;
}

function addFinder(qr, row, col) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark = inFinder && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setModule(qr, rr, cc, dark);
    }
  }
}

function addAlignment(qr, row, col) {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      setModule(qr, row + r, col + c, dark);
    }
  }
}

function addPatterns(qr) {
  addFinder(qr, 0, 0);
  addFinder(qr, 0, SIZE - 7);
  addFinder(qr, SIZE - 7, 0);

  for (let i = 8; i < SIZE - 8; i += 1) {
    setModule(qr, 6, i, i % 2 === 0);
    setModule(qr, i, 6, i % 2 === 0);
  }

  for (const row of ALIGNMENT_CENTERS) {
    for (const col of ALIGNMENT_CENTERS) {
      const overlapsFinder = (row === 6 && col === 6) || (row === 6 && col === SIZE - 7) || (row === SIZE - 7 && col === 6);
      if (!overlapsFinder) addAlignment(qr, row, col);
    }
  }

  setModule(qr, SIZE - 8, 8, true);

  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      qr.reserved[8][i] = true;
      qr.reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i += 1) {
    qr.reserved[8][SIZE - 1 - i] = true;
    qr.reserved[SIZE - 1 - i][8] = true;
  }
}

function dataBits(text) {
  const data = makeDataCodewords(text);
  const ec = reedSolomon(data, EC_CODEWORDS);
  return [...data, ...ec].flatMap((codeword) => {
    const bits = [];
    for (let i = 7; i >= 0; i -= 1) bits.push((codeword >>> i) & 1);
    return bits;
  });
}

function maskBit(mask, row, col) {
  switch (mask) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return false;
  }
}

function placeData(qr, bits, mask) {
  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < SIZE; vert += 1) {
      const row = upward ? SIZE - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        if (qr.reserved[row][col]) continue;
        const raw = bits[bitIndex] === 1;
        setModule(qr, row, col, raw !== maskBit(mask, row, col), false);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function formatBits(mask) {
  let data = (0b01 << 3) | mask;
  let bits = data << 10;
  const gen = 0b10100110111;
  for (let i = 14; i >= 10; i -= 1) {
    if ((bits >>> i) & 1) bits ^= gen << (i - 10);
  }
  return (((data << 10) | bits) ^ 0b101010000010010) & 0x7fff;
}

function addFormat(qr, mask) {
  const bits = formatBits(mask);
  const get = (i) => ((bits >>> i) & 1) === 1;
  const coords1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const coords2 = [
    [SIZE - 1, 8], [SIZE - 2, 8], [SIZE - 3, 8], [SIZE - 4, 8], [SIZE - 5, 8], [SIZE - 6, 8], [SIZE - 7, 8],
    [8, SIZE - 8], [8, SIZE - 7], [8, SIZE - 6], [8, SIZE - 5], [8, SIZE - 4], [8, SIZE - 3], [8, SIZE - 2], [8, SIZE - 1],
  ];

  coords1.forEach(([row, col], i) => setModule(qr, row, col, get(i)));
  coords2.forEach(([row, col], i) => setModule(qr, row, col, get(i)));
}

function penalty(modules) {
  let score = 0;
  for (let row = 0; row < SIZE; row += 1) {
    let runColor = modules[row][0];
    let run = 1;
    for (let col = 1; col < SIZE; col += 1) {
      if (modules[row][col] === runColor) {
        run += 1;
      } else {
        if (run >= 5) score += run - 2;
        runColor = modules[row][col];
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let col = 0; col < SIZE; col += 1) {
    let runColor = modules[0][col];
    let run = 1;
    for (let row = 1; row < SIZE; row += 1) {
      if (modules[row][col] === runColor) {
        run += 1;
      } else {
        if (run >= 5) score += run - 2;
        runColor = modules[row][col];
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let col = 0; col < SIZE - 1; col += 1) {
      const color = modules[row][col];
      if (modules[row][col + 1] === color && modules[row + 1][col] === color && modules[row + 1][col + 1] === color) score += 3;
    }
  }
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const reverse = [...pattern].reverse();
  const matches = (line, index, target) => target.every((value, offset) => line[index + offset] === value);
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col <= SIZE - 11; col += 1) {
      const line = modules[row];
      if (matches(line, col, pattern) || matches(line, col, reverse)) score += 40;
    }
  }
  for (let col = 0; col < SIZE; col += 1) {
    const line = modules.map((row) => row[col]);
    for (let row = 0; row <= SIZE - 11; row += 1) {
      if (matches(line, row, pattern) || matches(line, row, reverse)) score += 40;
    }
  }
  const darkCount = modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs((darkCount * 100) / (SIZE * SIZE) - 50) / 5) * 10;
  return score;
}

function makeQr(text) {
  const bits = dataBits(text);
  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const qr = blankMatrix();
    addPatterns(qr);
    placeData(qr, bits, mask);
    addFormat(qr, mask);
    const score = penalty(qr.modules);
    if (!best || score < best.score) best = { qr, mask, score };
  }
  return best.qr.modules;
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

function featureDots(width, height) {
  return `<circle cx="${width - 120}" cy="112" r="48" fill="${YELLOW}"/>
  <circle cx="102" cy="${height - 116}" r="44" fill="${PINK}" opacity="0.95"/>
  <rect x="${width - 216}" y="${height - 202}" width="92" height="92" rx="18" fill="${TEAL}" transform="rotate(-8 ${width - 170} ${height - 156})"/>`;
}

function socialSvg({ width, height, qrSize, qrY, titleSize }) {
  const qrX = (width - qrSize) / 2;
  const moduleSize = qrSize / (SIZE + 8);
  const modulesOffset = qrX + moduleSize * 4;
  const qrOffsetY = qrY + moduleSize * 4;
  const badgeY = qrY + qrSize + 54;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="It's On The Fridge install QR code">
  <title>${INSTALL_URL}</title>
  <rect width="${width}" height="${height}" fill="${CREAM}"/>
  ${featureDots(width, height)}
  <image href="${LOGO_DATA_URI}" x="${(width - 244) / 2}" y="62" width="244" height="244" preserveAspectRatio="xMidYMid meet"/>
  <text x="${width / 2}" y="${height === 1350 ? 390 : 348}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800" fill="${DARK}">
    <tspan x="${width / 2}">Turn Your Favorite Photos</tspan>
    <tspan x="${width / 2}" dy="${titleSize + 12}">Into Custom Fridge Magnets</tspan>
  </text>
  <rect x="${qrX - 24}" y="${qrY - 24}" width="${qrSize + 48}" height="${qrSize + 48}" rx="36" fill="${WHITE}" stroke="${DARK}" stroke-width="8"/>
  <g fill="${DARK}">${qrRects(modules, moduleSize, modulesOffset, qrOffsetY)}</g>
  <text x="${width / 2}" y="${qrY + qrSize + 130}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="800" fill="${DARK}">📱 Scan to Install &amp; Start Designing</text>
  ${badge('✓ iPhone', width / 2 - 388, badgeY, 212)}
  ${badge('✓ Android', width / 2 - 146, badgeY, 236)}
  ${badge('✓ No App Store Required', width / 2 + 120, badgeY, 388)}
</svg>
`;
}

const modules = makeQr(INSTALL_URL);

writeFileSync(`${OUT_DIR}/install-qr.svg`, qrSvg(modules));
writeFileSync(`${OUT_DIR}/instagram-post-1080x1080.svg`, socialSvg({ width: 1080, height: 1080, qrSize: 430, qrY: 472, titleSize: 58 }));
writeFileSync(`${OUT_DIR}/instagram-portrait-1080x1350.svg`, socialSvg({ width: 1080, height: 1350, qrSize: 520, qrY: 545, titleSize: 60 }));
writeFileSync(`${OUT_DIR}/facebook-post-1200x1200.svg`, socialSvg({ width: 1200, height: 1200, qrSize: 500, qrY: 508, titleSize: 64 }));

console.log(`Generated install QR assets for ${INSTALL_URL}`);
