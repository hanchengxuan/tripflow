/**
 * Assembles the UI 2.3 artboards.
 *
 * `parts/<Name>.html` holds the artboard body; `_tokens.css` holds the values
 * lifted from `src/constants/theme.ts`. One source for the tokens means an
 * artboard can never drift from the app's palette by a hand-edited hex.
 *
 * Two outputs, from the same parts:
 *   <Name>.dc.html   one artboard per file, in the design-canvas shell
 *   preview.html     every artboard on one page, with the briefs — this is
 *                    the file that gets published and the one measure.mjs
 *                    reads, because it needs no canvas host to render.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, '_tokens.css'), 'utf8').trimEnd();
const canvas = JSON.parse(readFileSync(join(here, 'canvas.json'), 'utf8'));

const parts = new Map(
  readdirSync(join(here, 'parts'))
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((file) => [file.replace(/\.html$/, ''), readFileSync(join(here, 'parts', file), 'utf8').trimEnd()]),
);

for (const [name, body] of parts) {
  writeFileSync(
    join(here, `${name}.dc.html`),
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
${tokens}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`,
  );
  console.log(`built ${name}.dc.html`);
}

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A brief is written as one string in canvas.json so the design-canvas host can
 * show it verbatim. preview.html renders the same four moves as labelled blocks
 * — 现状 / 参考 / 提案 / 实测 — because the argument each brief makes has that
 * shape, and a reader should be able to jump straight to the measurement.
 */
function brief(text) {
  const parts = { now: '', reference: '', proposal: '', measured: '' };
  let rest = text;
  const cut = (marker, key) => {
    const at = rest.indexOf(marker);
    if (at === -1) return;
    parts[key] = rest.slice(at + marker.length).trim();
    rest = rest.slice(0, at).trim();
  };
  cut('实测', 'measured');
  cut('提案：', 'proposal');
  cut('参考：', 'reference');
  parts.now = rest.trim();
  parts.measured = parts.measured.replace(/^[（(]/, '').replace(/^([^）)]*)[）)]\s*[:：]?\s*/, '$1 — ');

  const block = (label, body, kind) => body
    ? `<div class="move ${kind}"><span class="move-label">${label}</span>` +
      `<div class="move-body"><p>${escape(body).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p></div></div>`
    : '';

  return `<div class="brief">
      ${block('现状', parts.now, 'is-now')}
      ${block('参考', parts.reference, 'is-ref')}
      ${block('提案', parts.proposal, 'is-new')}
      ${block('实测', parts.measured, 'is-measured')}
    </div>`;
}

const pages = canvas.pages.map((page, index) => {
  const boards = canvas.artboards.filter((board) => board.page === page.id);
  const briefs = canvas.annotations.filter((note) => note.page === page.id);
  return `<section class="page" id="${page.id}">
  <header class="page-head">
    <span class="page-index">${String(index + 1).padStart(2, '0')}</span>
    <h2>${escape(page.name)}</h2>
  </header>
  ${briefs.map((note) => brief(note.text)).join('\n  ')}
  <div class="boards">
    ${boards.map((board) => {
      const name = board.file.replace(/\.dc\.html$/, '');
      const state = /Now\.dc\.html$/.test(board.file) ? 'now' : 'new';
      return `<figure class="board" style="--w:${board.w}px">
      <figcaption class="is-${state}">${escape(board.title)}</figcaption>
      <div class="artboard" data-board="${name}" style="width:${board.w}px;height:${board.h}px">${parts.get(name) ?? ''}</div>
    </figure>`;
    }).join('\n    ')}
  </div>
</section>`;
}).join('\n');

writeFileSync(
  join(here, 'preview.html'),
  `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TripFlow UI 2.3</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${tokens}

  /* ---- Canvas chrome ---------------------------------------------------
     The artboards render in TripFlow's own tokens and native system face —
     that is the product, and nothing here may restyle it. Everything below
     is the spec sheet the artboards are pinned to: Plex Sans for argument,
     Plex Mono for every label, path and measured figure. Pine is borrowed
     from the app's own accent so the chrome belongs to this product and not
     to a template. */
  :root{
    --paper:#E6E9E8; --panel:#FFFFFF; --rule:#CDD4D2;
    --ink:#16211F; --ink2:#4E5B58; --pine:#0E6E57; --rust:#AF3128;
    --sans:"IBM Plex Sans","PingFang SC","Hiragino Sans GB",system-ui,sans-serif;
    --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  body{background:var(--paper);color:var(--ink);font-family:var(--sans);padding:0}
  .wrap{max-width:1460px;margin:0 auto;padding:56px 32px 96px}

  .lede{display:grid;gap:18px;padding-bottom:36px;border-bottom:1px solid var(--rule)}
  .stamp{font-family:var(--mono);font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--pine)}
  .lede h1{margin:0;font-size:clamp(30px,4vw,44px);line-height:1.1;font-weight:600;letter-spacing:-0.02em;
    text-wrap:balance;max-width:20ch}
  .lede p{margin:0;font-size:16px;line-height:1.62;color:var(--ink2);max-width:64ch}
  .lede .sources{font-family:var(--mono);font-size:12.5px;line-height:1.9;color:var(--ink2);
    display:grid;gap:2px;max-width:70ch}
  .lede .sources b{font-weight:600;color:var(--ink)}

  .page{margin-top:64px}
  .page-head{display:flex;align-items:baseline;gap:14px;margin-bottom:22px}
  .page-index{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--pine);
    font-variant-numeric:tabular-nums}
  .page-head h2{margin:0;font-size:25px;line-height:1.2;font-weight:600;letter-spacing:-0.015em}

  .brief{display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule);border-radius:4px;
    overflow:hidden;max-width:1080px;margin-bottom:26px}
  .move{display:grid;grid-template-columns:96px minmax(0,1fr);gap:20px;background:var(--panel);
    padding:18px 22px}
  .move-label{font-family:var(--mono);font-size:11.5px;letter-spacing:0.12em;text-transform:uppercase;
    font-weight:600;padding-top:3px}
  .is-now .move-label{color:var(--rust)}
  .is-ref .move-label{color:var(--ink2)}
  .is-new .move-label{color:var(--pine)}
  .is-measured{background:#F3F5F4}
  .is-measured .move-label{color:var(--ink)}
  .is-measured .move-body p{font-family:var(--mono);font-size:13.5px;font-variant-numeric:tabular-nums}
  .move-body p{margin:0 0 9px;font-size:14.5px;line-height:1.68;color:var(--ink2);max-width:74ch}
  .move-body p:last-child{margin-bottom:0}

  .boards{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}
  .board{margin:0;display:flex;flex-direction:column;gap:10px;width:var(--w)}
  .board figcaption{font-family:var(--mono);font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;
    font-weight:600;display:flex;align-items:center;gap:8px}
  .board figcaption::before{content:"";width:9px;height:9px;border-radius:2px;flex:none}
  .board figcaption.is-now{color:var(--rust)}
  .board figcaption.is-now::before{background:var(--rust)}
  .board figcaption.is-new{color:var(--pine)}
  .board figcaption.is-new::before{background:var(--pine)}
  .artboard{position:relative;border-radius:20px;overflow:hidden;background:var(--bg);
    box-shadow:0 1px 2px rgba(22,33,31,0.10),0 14px 34px rgba(22,33,31,0.13)}
  .artboard .screen{width:100%!important}

  @media (max-width:820px){
    .wrap{padding:36px 18px 64px}
    .move{grid-template-columns:1fr;gap:8px;padding:16px 18px}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="lede">
    <div class="stamp">TripFlow · Rail &amp; Ledger · 2.2</div>
    <h1>剩下的那些页面</h1>
    <p>2.2 之后剩下的部分：行程页、登录注册整条链路、账本，以及几个从来没画过的公共页面。规则不新增 —— 全部沿用 2.2 已经写下的那三条：一种行的写法、尾部说明按下去会做什么、不可撤销的动作走自己的确认面板。每个面画两次，现状与提案。</p>
    <div class="sources">
      <div><b>Apple 地图</b> · 地点面板的最低档位：圆角、四周留缝、浮在地图上</div>
      <div><b>Google Places UI Kit</b> · 地点卡片分 compact 与 full 两种布局</div>
      <div><b>iOS 设置</b> · 一种行贯穿全应用，尾部要么是数值要么是箭头</div>
      <div><b>Material 3 ListItem</b> · 行尾是「数值、图标或控件」之一</div>
      <div><b>Apple action sheet</b> · 破坏性动作最显眼，取消单独放最下，确认面板不滚动</div>
    </div>
  </div>
${pages}
</div>
</body>
</html>
`,
);
console.log('built preview.html');
