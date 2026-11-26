// server/utils/postCover.ts
//
// Draws the picture that goes with a page post: a hardcover book with the
// post's title stamped in gold on the cover, photographed-looking on a
// table or in a studio. Every post gets a different look: the scene (book
// lying at an angle, or standing), the table or backdrop, the cover
// colour, and the cover's ornament are picked at random.
//
// No people or animals, and no AI image model: those cost money and write
// Persian letters as gibberish. It's all drawn as SVG and rendered with
// resvg; the title is set in Vazirmatn (server/assets/fonts, SIL Open Font
// License), which resvg shapes correctly right to left.

import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const SIZE = 1080;

export type CoverKind = 'tip' | 'question' | 'poem';

const LABELS: Record<CoverKind, string> = {
  tip: 'یک گپ برای دل',
  question: 'سوال امروز',
  poem: 'دوبیتی',
};

const COVER_COLOURS = [
  { cover: '#1d3557', dark: '#101f36' }, // lapis
  { cover: '#6e1f2b', dark: '#43111a' }, // pomegranate
  { cover: '#1f4a36', dark: '#112b1f' }, // forest
  { cover: '#1b1b1f', dark: '#0b0b0d' }, // black
  { cover: '#5a1730', dark: '#360c1c' }, // burgundy
  { cover: '#17494d', dark: '#0c2c2f' }, // teal
  { cover: '#3d2350', dark: '#241331' }, // plum
  { cover: '#4a2f1f', dark: '#2b1a10' }, // walnut
];

const FOILS = [
  ['#fff1b8', '#e6c36a', '#c39a45', '#f3dc94', '#cfa44c'], // gold
  ['#fbf3df', '#eadbb8', '#cdb98e', '#f4e8c9', '#d9c69c'], // cream
];

const BACKGROUNDS = ['lightWood', 'darkWood', 'studio', 'linen'] as const;
const SCENES = ['lyingLeft', 'lyingRight', 'standing'] as const;
const ORNAMENTS = ['garland', 'geometric', 'corners', 'night'] as const;

type Style = {
  scene: (typeof SCENES)[number];
  background: (typeof BACKGROUNDS)[number];
  colours: (typeof COVER_COLOURS)[number];
  foil: string[];
  ornament: (typeof ORNAMENTS)[number];
};

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

function pickStyle(random: () => number): Style {
  const scene = pick(SCENES, random);
  return {
    scene,
    // A standing book needs a wall behind it, not a table top.
    background: scene === 'standing' ? pick(['studio', 'linen'] as const, random) : pick(BACKGROUNDS, random),
    colours: pick(COVER_COLOURS, random),
    foil: random() < 0.75 ? FOILS[0]! : FOILS[1]!,
    ornament: pick(ORNAMENTS, random),
  };
}

// mulberry32: small, and its first outputs already differ a lot between
// nearby seeds (a plain LCG picked the same style for seeds 11, 22, 33...).
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const FONT_FILES = ['Vazirmatn-Bold.ttf', 'Vazirmatn-Regular.ttf'];

let fontPaths: Promise<string[]> | null = null;

// resvg only loads fonts from files, and a serverless bundle has no fonts
// folder of its own, so the bundled fonts are copied to /tmp once.
function getFontPaths() {
  fontPaths ??= Promise.all(FONT_FILES.map(async (name) => {
    const data = await useStorage('assets:server').getItemRaw(`fonts/${name}`);
    if (!data) throw new Error(`Font ${name} is missing from server/assets/fonts`);
    const path = join(tmpdir(), `sitara-${name}`);
    await writeFile(path, Buffer.from(data as ArrayBuffer));
    return path;
  })).catch((err) => {
    fontPaths = null;
    throw err;
  });
  return fontPaths;
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Cover art, drawn flat in a W x H space ----

const W = 560;
const H = 760;

type Point = { x: number; y: number };
const poly = (...points: Point[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

// An almond-shaped leaf pointing up from (0,0), length 1.
const LEAF = 'M0,0 C0.34,-0.25 0.3,-0.7 0,-1 C-0.3,-0.7 -0.34,-0.25 0,0 Z';

// A curved stem with leaves on alternate sides, starting at (x,y) and
// heading at `angle` degrees (0 = up).
function sprig(x: number, y: number, angle: number, length: number, bend: number, leafSize: number) {
  const leaves: string[] = [];
  const count = Math.max(3, Math.round(length / (leafSize * 0.62)));
  for (let i = 1; i <= count; i += 1) {
    const t = i / (count + 1);
    const lx = bend * 4 * t * (1 - t);
    const side = i % 2 === 0 ? 1 : -1;
    const size = leafSize * (1 - t * 0.4);
    leaves.push(`<path d="${LEAF}" transform="translate(${lx.toFixed(1)} ${(-length * t).toFixed(1)}) rotate(${side * 48}) scale(${(size * 0.6).toFixed(1)} ${size.toFixed(1)})" fill="url(#foil)"/>`);
  }
  const tip = `<path d="${LEAF}" transform="translate(0 ${(-length).toFixed(1)}) scale(${(leafSize * 0.4).toFixed(1)} ${(leafSize * 0.8).toFixed(1)})" fill="url(#foil)"/>`;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})"><path d="M0,0 Q${bend.toFixed(1)},${(-length / 2).toFixed(1)} 0,${(-length).toFixed(1)}" fill="none" stroke="url(#foil)" stroke-width="3"/>${leaves.join('')}${tip}</g>`;
}

function sparkle(x: number, y: number, r: number) {
  const s = r * 0.22;
  return `<path d="M${x},${y - r} L${x + s},${y - s} L${x + r},${y} L${x + s},${y + s} L${x},${y + r} L${x - s},${y + s} L${x - r},${y} L${x - s},${y - s} Z" fill="url(#foil)"/>`;
}

// An eight-point star (two overlapping squares), the shape that runs
// through Afghan tile and wood work.
function star(cx: number, cy: number, r: number, filled = false) {
  const square = (radius: number, angle: number, attrs: string) => {
    const points = [0, 1, 2, 3].map((i) => {
      const a = angle + (i * Math.PI) / 2;
      return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
    });
    return `<polygon points="${poly(...points)}" ${attrs}/>`;
  };
  const outline = filled ? 'fill="url(#foil)"' : 'fill="none" stroke="url(#foil)" stroke-width="2.5"';
  return square(r, 0, outline) + square(r, Math.PI / 4, outline)
    + (filled ? '' : square(r * 0.42, 0, 'fill="url(#foil)"') + square(r * 0.42, Math.PI / 4, 'fill="url(#foil)"'));
}

function frame(inset: number, weight: number) {
  return `<rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" fill="none" stroke="url(#foil)" stroke-width="${weight}"/>`;
}

// Top medallion, and where the label and title sit, per ornament.
function ornamentArt(ornament: Style['ornament'], random: () => number) {
  const parts: string[] = [];
  if (ornament === 'garland') {
    parts.push(frame(26, 3), frame(38, 1.2));
    // Mirrored garlands climbing both sides, and a bouquet at the bottom.
    parts.push(sprig(78, H - 70, 12, 300, -55, 30), sprig(W - 78, H - 70, -12, 300, 55, 30));
    parts.push(sprig(W / 2, H - 46, 0, 60, 0, 18), sprig(W / 2 - 14, H - 46, -55, 70, 15, 17), sprig(W / 2 + 14, H - 46, 55, 70, -15, 17));
    parts.push(sprig(78, 70, 165, 150, 40, 24), sprig(W - 78, 70, -165, 150, -40, 24));
    for (let i = 0; i < 10; i += 1) {
      const x = 110 + random() * (W - 220);
      const y = 80 + random() * 120;
      parts.push(sparkle(x, y, 5 + random() * 6));
    }
    parts.push(star(W / 2, 145, 32));
  } else if (ornament === 'geometric') {
    parts.push(frame(24, 3), frame(84, 2));
    // A band of eight-point stars between the two frames.
    for (let x = 54; x <= W - 54; x += 50) parts.push(star(x, 54, 15, true), star(x, H - 54, 15, true));
    for (let y = 104; y <= H - 104; y += 50) parts.push(star(54, y, 15, true), star(W - 54, y, 15, true));
    parts.push(star(W / 2, 165, 44), `<circle cx="${W / 2}" cy="165" r="58" fill="none" stroke="url(#foil)" stroke-width="2"/>`);
  } else if (ornament === 'corners') {
    parts.push(frame(30, 2.5));
    // Curling sprigs out of each corner and a ringed medallion.
    for (const [x, y, a] of [[44, 44, 135], [W - 44, 44, -135], [44, H - 44, 45], [W - 44, H - 44, -45]] as const) {
      parts.push(sprig(x, y, a, 150, a > 0 ? 50 : -50, 24), sprig(x, y, a + (a > 0 ? -40 : 40), 110, a > 0 ? -40 : 40, 20));
    }
    parts.push(`<circle cx="${W / 2}" cy="160" r="62" fill="none" stroke="url(#foil)" stroke-width="2.5"/>`, `<circle cx="${W / 2}" cy="160" r="52" fill="none" stroke="url(#foil)" stroke-width="1"/>`, star(W / 2, 160, 34));
  } else {
    parts.push(frame(30, 1.5), frame(40, 1));
    // A crescent moon over a field of stars.
    parts.push(`<mask id="crescent" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#ffffff"/><circle cx="${W / 2 + 22}" cy="136" r="46" fill="#000000"/></mask>`,
      `<circle cx="${W / 2}" cy="150" r="52" fill="url(#foil)" mask="url(#crescent)"/>`);
    for (let i = 0; i < 60; i += 1) {
      const x = 60 + random() * (W - 120);
      const y = 60 + random() * (H - 120);
      if (y > 250 && y < 600 && x > 70 && x < W - 70) continue;
      parts.push(sparkle(x, y, 3 + random() * 9));
    }
  }
  return parts.join('');
}

// Short vowel marks and the zero-width non-joiner take no width of their
// own, so they don't count toward a line's length.
function visibleLength(text: string) {
  return text.replace(/[ً-ٰٟ‌‍]/g, '').length;
}

const TITLE_LINE_HEIGHT = 1.35;

// resvg doesn't wrap text, so the title is broken into lines here. The
// font size shrinks for longer titles; chars per line is a rough fit for
// Vazirmatn Bold across the cover's text area.
function layoutTitle(title: string) {
  const words = title.trim().split(/\s+/);
  for (const fontSize of [80, 70, 60, 52, 46]) {
    const maxChars = Math.floor(680 / fontSize);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (visibleLength(next) > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    // The title has to fit between the label (y 268) and the name line
    // (y 620).
    const height = (lines.length - 1) * fontSize * TITLE_LINE_HEIGHT + fontSize * 1.1;
    if (lines.length <= 3 && height <= 280 && lines.every((l) => visibleLength(l) <= maxChars + 1)) return { fontSize, lines };
  }
  return null;
}

type TitleLayout = NonNullable<ReturnType<typeof layoutTitle>>;

function coverArt(kind: CoverKind, layout: TitleLayout, style: Style, random: () => number) {
  // Centred on y=445; a line's visual middle sits about a third of the
  // font size above its baseline.
  const lineHeight = layout.fontSize * TITLE_LINE_HEIGHT;
  const firstBaseline = 445 + layout.fontSize * 0.35 - ((layout.lines.length - 1) * lineHeight) / 2;
  const title = layout.lines
    .map((line, i) => `<text x="${W / 2}" y="${(firstBaseline + i * lineHeight).toFixed(0)}" font-family="Vazirmatn" font-weight="700" font-size="${layout.fontSize}" fill="url(#foil)" text-anchor="middle" direction="rtl">${escapeXml(line)}</text>`)
    .join('');

  const art = ornamentArt(style.ornament, random);

  return `<rect x="0" y="0" width="${W}" height="${H}" fill="${style.colours.cover}"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#coverShade)"/>
    ${art}
    <text x="${W / 2}" y="268" font-family="Vazirmatn" font-size="30" fill="url(#foil)" text-anchor="middle" direction="rtl">${escapeXml(LABELS[kind])}</text>
    ${title}
    <text x="${W / 2}" y="${H - 140}" font-family="Vazirmatn" font-size="26" fill="url(#foil)" text-anchor="middle" direction="rtl">ستاره شام آغیل</text>`;
}

// ---- Backgrounds ----

function background(kind: Style['background']) {
  if (kind === 'lightWood' || kind === 'darkWood') {
    const base = kind === 'lightWood' ? '#d9c29d' : '#6b4a33';
    const grain = kind === 'lightWood' ? '0.42 0.28 0.16' : '0.2 0.12 0.07';
    const [r, g, b] = grain.split(' ');
    return `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0035 0.11" numOctaves="3" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 0.65 0"/></filter>
  <rect width="${SIZE}" height="${SIZE}" fill="${base}"/>
  <rect width="${SIZE}" height="${SIZE}" filter="url(#grain)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#vignette)"/>`;
  }
  if (kind === 'studio') {
    return `<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9aa7a6"/><stop offset="100%" stop-color="#6f7c7b"/></linearGradient>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#wall)"/>
  <rect y="860" width="${SIZE}" height="220" fill="#7d8a89"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#vignette)"/>`;
  }
  return `<filter id="weave" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.35 0"/></filter>
  <rect width="${SIZE}" height="${SIZE}" fill="#e7dccb"/>
  <rect width="${SIZE}" height="${SIZE}" filter="url(#weave)"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#vignette)"/>`;
}

// ---- Scenes ----
//
// The cover art is mapped onto the book by an affine transform: tl -> the
// cover's top-left corner, its x axis along tl->tr and its y axis along
// tl->bl.

function matrix(tl: Point, tr: Point, bl: Point) {
  return `matrix(${((tr.x - tl.x) / W).toFixed(4)} ${((tr.y - tl.y) / W).toFixed(4)} ${((bl.x - tl.x) / H).toFixed(4)} ${((bl.y - tl.y) / H).toFixed(4)} ${tl.x} ${tl.y})`;
}

function offset(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

// Page edges: a cream band with fine lines along it.
function pageBlock(a: Point, b: Point, dx: number, dy: number, steps: number) {
  const lines = Array.from({ length: steps }, (_, i) => {
    const f = (i + 1) / (steps + 1);
    return `<line x1="${(a.x + dx * f).toFixed(1)}" y1="${(a.y + dy * f).toFixed(1)}" x2="${(b.x + dx * f).toFixed(1)}" y2="${(b.y + dy * f).toFixed(1)}" stroke="#d3c8b2" stroke-width="1"/>`;
  }).join('');
  return `<polygon points="${poly(a, b, offset(b, dx, dy), offset(a, dx, dy))}" fill="#f4eddf"/>${lines}`;
}

function lyingScene(mirror: boolean, art: string, spineTitle: string, colours: Style['colours']) {
  const tl: Point = { x: 170, y: 330 };
  const tr: Point = { x: 640, y: 150 };
  const bl: Point = { x: 470, y: 790 };
  const br: Point = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };
  const t = 50;
  const board = 7;
  const spineLength = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const spineMatrix = `matrix(${((bl.x - tl.x) / spineLength).toFixed(4)} ${((bl.y - tl.y) / spineLength).toFixed(4)} 0 1 ${tl.x} ${tl.y})`;
  // Mirroring the whole book flips the text too, so a mirrored scene draws
  // the book mirrored and the cover art un-mirrored on top.
  const flip = mirror ? `transform="translate(${SIZE} 0) scale(-1 1)"` : '';
  const coverMatrix = mirror
    ? matrix({ x: SIZE - tr.x, y: tr.y }, { x: SIZE - tl.x, y: tl.y }, { x: SIZE - br.x, y: br.y })
    : matrix(tl, tr, bl);
  const spineTextMatrix = mirror
    ? `matrix(${((bl.x - tl.x) / spineLength).toFixed(4)} ${(-(bl.y - tl.y) / spineLength).toFixed(4)} 0 1 ${SIZE - bl.x} ${bl.y})`
    : spineMatrix;

  return `<polygon points="${poly(offset(tl, 30, t + 50), offset(bl, 30, t + 50), offset(br, 30, t + 40), offset(tr, 30, t + 40))}" fill="#000000" fill-opacity="0.45" filter="url(#blur)" ${flip}/>
  <g ${flip}>
    ${pageBlock(offset(bl, 0, board), offset(br, 0, board), 0, t - board * 2, 9)}
    <polygon points="${poly(bl, br, offset(br, 0, board), offset(bl, 0, board))}" fill="${colours.dark}"/>
    <polygon points="${poly(offset(bl, 0, t - board), offset(br, 0, t - board), offset(br, 0, t), offset(bl, 0, t))}" fill="${colours.dark}"/>
    <polygon points="${poly(tl, bl, offset(bl, 0, t), offset(tl, 0, t))}" fill="${colours.dark}"/>
    <g transform="${spineMatrix}"><rect width="${spineLength.toFixed(1)}" height="${t}" fill="url(#spineShade)"/>
      <line x1="40" y1="8" x2="${(spineLength - 40).toFixed(1)}" y2="8" stroke="url(#foil)" stroke-width="1.5"/>
      <line x1="40" y1="${t - 8}" x2="${(spineLength - 40).toFixed(1)}" y2="${t - 8}" stroke="url(#foil)" stroke-width="1.5"/></g>
  </g>
  <g transform="${spineTextMatrix}"><text x="${(spineLength / 2).toFixed(1)}" y="${t / 2 + 8}" font-family="Vazirmatn" font-weight="700" font-size="22" fill="url(#foil)" text-anchor="middle" direction="rtl">${spineTitle}</text></g>
  <g transform="${coverMatrix}">${art}<rect width="${W}" height="${H}" fill="url(#coverLight)"/></g>`;
}

function standingScene(art: string, colours: Style['colours']) {
  const tl: Point = { x: 300, y: 130 };
  const tr: Point = { x: 750, y: 165 };
  const bl: Point = { x: 300, y: 905 };
  const br: Point = { x: tr.x + bl.x - tl.x, y: tr.y + bl.y - tl.y };
  const depth = { x: 34, y: -16 };
  return `<ellipse cx="${(bl.x + br.x) / 2 + 40}" cy="${br.y - 6}" rx="330" ry="34" fill="#000000" fill-opacity="0.4" filter="url(#blur)"/>
  ${pageBlock(offset(tr, 0, 6), offset(br, 0, -6), depth.x, depth.y, 10)}
  <polygon points="${poly(tr, offset(tr, depth.x, depth.y), offset(tr, depth.x + 2, depth.y + 6), offset(tr, 0, 6))}" fill="${colours.dark}"/>
  <g transform="${matrix(tl, tr, bl)}">${art}<rect width="${W}" height="${H}" fill="url(#coverLight)"/>
    <rect width="18" height="${H}" fill="#000000" fill-opacity="0.25"/></g>`;
}

function coverSvg(kind: CoverKind, title: string, random: () => number) {
  const layout = layoutTitle(title);
  if (!layout) return null;
  const style = pickStyle(random);
  const art = coverArt(kind, layout, style, random);
  const spineTitle = escapeXml(layout.lines.join(' '));
  const stops = style.foil.map((colour, i) => `<stop offset="${(i / (style.foil.length - 1)).toFixed(2)}" stop-color="${colour}"/>`).join('');

  const scene = style.scene === 'standing'
    ? standingScene(art, style.colours)
    : lyingScene(style.scene === 'lyingRight', art, spineTitle, style.colours);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
    <radialGradient id="vignette" cx="50%" cy="42%" r="75%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/><stop offset="100%" stop-color="#000000" stop-opacity="0.32"/></radialGradient>
    <linearGradient id="foil" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H * 0.6}">${stops}</linearGradient>
    <radialGradient id="coverShade" cx="40%" cy="30%" r="90%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="100%" stop-color="#000000" stop-opacity="0.30"/></radialGradient>
    <linearGradient id="coverLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.22"/></linearGradient>
    <linearGradient id="spineShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="100%" stop-color="#000000" stop-opacity="0.35"/></linearGradient>
  </defs>
  ${background(style.background)}
  ${scene}
</svg>`;
}

// PNG of the cover, or null when the title is too long to set well (the
// post then goes out as text). `seed` makes the style repeatable (tests).
export async function renderCover(kind: CoverKind, title: string, seed = Math.floor(Math.random() * 2 ** 32)): Promise<Buffer | null> {
  const svg = coverSvg(kind, title, seededRandom(seed));
  if (!svg) return null;

  const resvg = new Resvg(svg, {
    font: { fontFiles: await getFontPaths(), loadSystemFonts: false, defaultFontFamily: 'Vazirmatn' },
  });
  return Buffer.from(resvg.render().asPng());
}
