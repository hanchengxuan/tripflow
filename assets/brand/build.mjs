// TripFlow app icon — single source of truth.
//
// One mark, "折页": a paper map reduced to the only thing that makes it a map,
// its folds. Everything below is drawn from the same three quadrilaterals and
// rasterised with the Chromium that Playwright already installs, so there is no
// extra image toolchain to keep alive.
//
//   node assets/brand/build.mjs            # preview sheet only
//   node assets/brand/build.mjs --ship     # + the production sets in out/ship
//   ICON_PALETTE=p3 node assets/brand/build.mjs --ship
//
// Output is grouped light / dark / web, which is also how the three of them get
// consumed: the app icon, its dark counterpart, and the site.

import { mkdirSync, writeFileSync as write, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'out');

// Interpolating a multi-line template into an indented slot leaves the indent
// stranded on its own line, and CI rejects trailing whitespace. Strip it on the
// way out rather than hand-tuning the indentation of every template.
const writeFileSync = (path, text) => write(path, text.replace(/[ \t]+$/gm, ''));

/* ---------- palettes ----------
 * `fold` runs left panel → middle panel → right panel. The middle is the
 * brightest because it is the one facing us; the two wings are shades of the
 * ink, which is what turns three bars into a folded sheet.
 */

const palettes = {
  p1: {
    label: '瓷白与深林',
    note: '中性瓷白，不带米黄；深林墨绿到高饱和青绿的三级折光',
    ground: '#F1F2EF',
    ink: '#123B32',
    fold: ['#123B32', '#17B98A', '#2C6D5C'],
  },
  p3: {
    label: '瓷白与朱',
    note: '同样的瓷白，正面那片换成高饱和的朱红，对比最强',
    ground: '#F3F3F0',
    ink: '#13342D',
    fold: ['#13342D', '#FF5A36', '#2E6659'],
  },
};

const dark = {
  label: '深林',
  note: '深底不是把浅底反相，正面那片保持发光，两翼压成中间调',
  ground: '#0E1F1B',
  ink: '#EEF3F0',
  fold: ['#E8EFEC', '#2ED39B', '#52907C'],
};

/* ---------- the mark ----------
 * Panel widths are 168 / 236 / 176: the middle is widest because it faces the
 * viewer, and the wings differ from each other so the sheet never reads as
 * symmetrical signage. Top and bottom edges run out of phase by 52.
 */

const PANELS = [
  'M226 324 L394 272 V700 L226 752 Z',
  'M394 272 L630 324 V752 L394 700 Z',
  'M630 324 L806 272 V700 L630 752 Z',
];

// `k` frames the mark: 1.08 for app tiles, tighter for favicons, looser inside
// Android's crop. The bbox centre is (516, 512), not (512, 512).
// The 7px stroke only takes the razor off the corners; it has to be painted in
// each panel's own colour, so themed output carries it on the class instead.
const fold = (fills, k = 1.08, asClass = false) => `
  <g transform="translate(512,512) scale(${k}) rotate(-3.5) translate(-516,-512)"
     stroke-linejoin="round" stroke-width="7">
    ${PANELS.map((d, i) =>
      asClass
        ? `<path class="${fills[i]}" d="${d}"/>`
        : `<path fill="${fills[i]}" stroke="${fills[i]}" d="${d}"/>`,
    ).join('\n    ')}
  </g>`;

/* ---------- assembly ---------- */

const svg = (body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${extra}${body}</svg>`;

const tile = (p, k) => svg(`<rect width="1024" height="1024" fill="${p.ground}"/>` + fold(p.fold, k));
const bare = (p, k) => svg(fold(p.fold, k));

const PALETTE = process.env.ICON_PALETTE ?? 'p1';
const P = palettes[PALETTE];
if (!P) throw new Error(`unknown ICON_PALETTE "${PALETTE}" — use ${Object.keys(palettes)}`);

// iOS 18's tinted variant is composited by the system from luminance, so it
// needs the mark in greys — flat black would collapse the folds into one blob.
const TINTED = ['#3A3A3A', '#F2F2F2', '#8A8A8A'];

// A favicon that follows the browser's theme: same geometry, fills swapped by
// a media query inside the file.
const themedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <style>
    .g { fill: ${P.ground} } .a { fill: ${P.fold[0]} } .b { fill: ${P.fold[1]} } .c { fill: ${P.fold[2]} }
    .a { stroke: ${P.fold[0]} } .b { stroke: ${P.fold[1]} } .c { stroke: ${P.fold[2]} }
    @media (prefers-color-scheme: dark) {
      .g { fill: ${dark.ground} }
      .a { fill: ${dark.fold[0]}; stroke: ${dark.fold[0]} }
      .b { fill: ${dark.fold[1]}; stroke: ${dark.fold[1]} }
      .c { fill: ${dark.fold[2]}; stroke: ${dark.fold[2]} }
    }
  </style>
  <rect class="g" width="1024" height="1024"/>
  ${fold(['a', 'b', 'c'], 1.22, true)}
</svg>`;

const ship = {
  // The app icon and everything Android composites it from.
  light: [
    { file: 'icon-1024.png', size: 1024, svg: tile(P, 1.08) },
    { file: 'android-foreground.png', size: 512, svg: bare(P, 0.78), alpha: true },
    { file: 'android-background.png', size: 512, svg: svg(`<rect width="1024" height="1024" fill="${P.ground}"/>`) },
    { file: 'android-monochrome.png', size: 512, svg: bare({ fold: ['#000', '#000', '#000'] }, 0.78), alpha: true },
    { file: 'splash-mark.png', size: 512, svg: bare(P, 1), alpha: true },
  ],
  // iOS 18 takes all three: an opaque light tile, a dark one, and a tinted one.
  dark: [
    { file: 'icon-1024.png', size: 1024, svg: tile(dark, 1.08) },
    { file: 'icon-1024-transparent.png', size: 1024, svg: bare(dark, 1.08), alpha: true },
    { file: 'icon-1024-tinted.png', size: 1024, svg: bare({ fold: TINTED }, 1.08), alpha: true },
    { file: 'splash-mark.png', size: 512, svg: bare(dark, 1), alpha: true },
  ],
  // Favicons sit tighter in their box than an app icon does.
  web: [
    { file: 'favicon-16.png', size: 16, svg: tile(P, 1.22) },
    { file: 'favicon-32.png', size: 32, svg: tile(P, 1.22) },
    { file: 'favicon-48.png', size: 48, svg: tile(P, 1.22) },
    { file: 'favicon-64.png', size: 64, svg: tile(P, 1.22) },
    { file: 'apple-touch-icon-180.png', size: 180, svg: tile(P, 1.08) },
    { file: 'icon-192.png', size: 192, svg: tile(P, 1.22) },
    { file: 'icon-512.png', size: 512, svg: tile(P, 1.22) },
    // PWA maskable: platforms crop up to 20% off each edge.
    { file: 'icon-maskable-512.png', size: 512, svg: tile(P, 0.72) },
  ],
};

/* ---------- rasterise ---------- */

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function raster(source, size, file, alpha = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px">` +
      source.replace('width="1024" height="1024"', `width="${size}" height="${size}"`) +
      '</body>',
  );
  await page.screenshot({ path: file, omitBackground: alpha });
}

if (process.argv.includes('--ship')) {
  for (const [group, files] of Object.entries(ship)) {
    mkdirSync(join(out, 'ship', group), { recursive: true });
    for (const f of files) {
      writeFileSync(join(out, 'ship', group, f.file.replace('.png', '.svg')), f.svg);
      await raster(f.svg, f.size, join(out, 'ship', group, f.file), f.alpha);
    }
  }
  writeFileSync(join(out, 'ship', 'web', 'favicon.svg'), themedSvg);
}

/* ---------- preview sheet ---------- */

const sq = (source, size, radius = size * 0.225) =>
  `<div class="sq" style="width:${size}px;height:${size}px;border-radius:${radius}px">${source.replace(
    'width="1024" height="1024"',
    `width="${size}" height="${size}"`,
  )}</div>`;

const lightTile = tile(P, 1.08);
const darkTile = tile(dark, 1.08);
const webTile = tile(P, 1.22);

const ladder = (source) =>
  [180, 120, 80, 60, 40, 29]
    .map((s) => `<figure>${sq(source, s)}<figcaption>${s}px</figcaption></figure>`)
    .join('');

const webLadder = [64, 48, 32, 16]
  .map((s) => `<figure>${sq(webTile, s, s * 0.16)}<figcaption>${s}px</figcaption></figure>`)
  .join('');

const swatch = (hex, role) =>
  `<div class="sw"><span style="background:${hex}"></span><code>${hex}</code><i>${role}</i></div>`;

const preview = `<title>TripFlow 应用图标 · 折页</title>
<style>
  :root { --ground:#EDEFEF; --card:#FFFFFF; --ink:#16211F; --dim:#5A6663; --line:#E2E5E5; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --ground:#0F1413; --card:#171D1C; --ink:#ECEFEE; --dim:#9EAAA7; --line:#24322D; } }
  :root[data-theme="dark"] { --ground:#0F1413; --card:#171D1C; --ink:#ECEFEE; --dim:#9EAAA7; --line:#24322D; }
  body { margin:0; padding:40px 24px 72px; background:var(--ground); color:var(--ink);
         font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
  main { max-width: 900px; margin:0 auto; display:grid; gap:26px; }
  h1 { font-size:30px; margin:0; letter-spacing:-0.01em; }
  h2 { font-size:15px; margin:0 0 18px; color:var(--dim); font-weight:600; letter-spacing:.06em; }
  p { margin:0; color:var(--dim); line-height:1.75; font-size:15px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:26px; overflow-x:auto; }
  .sq { overflow:hidden; box-shadow:0 6px 18px rgba(22,33,31,.13); }
  .sq svg { display:block; }
  .hero { display:flex; gap:26px; align-items:center; flex-wrap:wrap; }
  .row { display:flex; gap:24px; align-items:flex-end; flex-wrap:wrap; }
  figure { margin:0; display:grid; gap:10px; justify-items:center; }
  figcaption { font-size:12px; color:var(--dim); }
  .sw { display:flex; align-items:center; gap:12px; padding:9px 0; font-size:14px; border-top:1px solid var(--line); }
  .sw:first-child { border-top:0; }
  .sw span { width:26px; height:26px; border-radius:8px; flex:none; border:1px solid rgba(0,0,0,.08); }
  .sw code { width:92px; color:var(--dim); }
  .sw i { color:var(--dim); font-style:normal; }
  .three { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:24px; }
  .three p { font-size:13px; margin-top:10px }
</style>
<main>
  <header>
    <h1>TripFlow 应用图标 · 折页</h1>
    <p style="margin-top:10px">这一轮只做一件事：把折页做细。三片折页现在是三级折光而不是两色平涂——正面那片最亮，两翼是墨绿的深浅两阶，纸才立得起来。面宽改成 168 / 236 / 176，正面最宽因为它正对着我们；整体压回画面正中（原先偏下 24），并留了 3.5° 的倾角。</p>
  </header>

  <section>
    <h2>三套产物</h2>
    <div class="three">
      <div>${sq(lightTile, 168)}<p><b>light</b> — 应用图标主体，瓷白底。Android 自适应前景/背景/单色都从它来。</p></div>
      <div>${sq(darkTile, 168)}<p><b>dark</b> — 深底不是简单反相：正面那片保持发光，两翼压成中间调，否则深底上会全糊成一块。另出透明版和 iOS 18 的 tinted 灰度版。</p></div>
      <div>${sq(webTile, 168, 27)}<p><b>web</b> — favicon 比应用图标收得更紧（1.22×），因为浏览器标签本身就没有留白。另有一个跟随浏览器深浅色的 favicon.svg。</p></div>
    </div>
  </section>

  <section>
    <h2>浅色 · 各尺寸</h2>
    <div class="row">${ladder(lightTile)}</div>
  </section>

  <section>
    <h2>深色 · 各尺寸</h2>
    <div class="row">${ladder(darkTile)}</div>
  </section>

  <section>
    <h2>网站图标 · 浏览器标签实际尺寸</h2>
    <div class="row">${webLadder}</div>
    <p style="margin-top:18px">16px 下三片折页各占 5px，仍分得出深—亮—中三阶。</p>
  </section>

  <section>
    <h2>色值</h2>
    ${swatch(P.ground, 'light 底色')}
    ${swatch(P.fold[0], '左翼 · 背光')}
    ${swatch(P.fold[1], '正面 · 唯一亮色')}
    ${swatch(P.fold[2], '右翼 · 中间调')}
    ${swatch(dark.ground, 'dark 底色')}
    ${swatch(dark.fold[0], 'dark 左翼')}
    ${swatch(dark.fold[1], 'dark 正面')}
    ${swatch(dark.fold[2], 'dark 右翼')}
  </section>
</main>`;

writeFileSync(join(out, 'preview.html'), preview);
await page.setViewportSize({ width: 960, height: 1200 });
await page.setContent(preview);
await page.screenshot({ path: join(out, 'preview.png'), fullPage: true });

await browser.close();
console.log(
  process.argv.includes('--ship')
    ? `wrote light / dark / web sets for palette "${PALETTE}" to assets/brand/out/ship`
    : 'wrote assets/brand/out/preview.html',
);
