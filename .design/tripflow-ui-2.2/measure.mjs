/**
 * Measures the claims made in README.md against the built artboards, so a
 * figure in the prose is a reading rather than an estimate. Run after build:
 *
 *   node .design/tripflow-ui-2.2/build.mjs && node .design/tripflow-ui-2.2/measure.mjs
 */
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
await page.goto(`file://${join(here, 'preview.html')}`);

const read = async (board, selector) =>
  page.evaluate(([board, selector]) => {
    const root = document.querySelector(`[data-board="${board}"]`);
    const frame = root.getBoundingClientRect();
    const node = root.querySelector(selector);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { top: Math.round(box.top - frame.top), height: Math.round(box.height), width: Math.round(box.width) };
  }, [board, selector]);

const frameHeight = async (board) =>
  page.evaluate((board) => Math.round(document.querySelector(`[data-board="${board}"]`).getBoundingClientRect().height), board);

// Atlas: how much of the frame the map viewport actually gets.
for (const board of ['AtlasNow', 'Atlas']) {
  const map = await read(board, '#map');
  const frame = await frameHeight(board);
  console.log(`${board}: map ${map.width}x${map.height}, top ${map.top}, ${(100 * map.height / frame).toFixed(0)}% of the ${frame}px frame`);
}

// Atlas: how much of the map a reader can actually see, i.e. above the panel.
for (const board of ['AtlasNow', 'Atlas']) {
  const clear = await page.evaluate((board) => {
    const root = document.querySelector(`[data-board="${board}"]`);
    const frame = root.getBoundingClientRect();
    const map = root.querySelector('#map').getBoundingClientRect();
    const panel = root.querySelector('#panel');
    const floor = panel ? panel.getBoundingClientRect().top : map.bottom;
    return Math.round(Math.min(map.bottom, floor) - map.top);
  }, board);
  console.log(`${board}: map visible (not under the place panel) ${clear}px`);
}

// Me: distinct row heights among the settings rows — the count of row idioms.
for (const board of ['MeNow', 'Me']) {
  const heights = await page.evaluate((board) => {
    const root = document.querySelector(`[data-board="${board}"]`);
    const rows = [...root.querySelectorAll('[data-row]')].map((node) => Math.round(node.getBoundingClientRect().height));
    return [...new Set(rows)].sort((a, b) => a - b);
  }, board);
  console.log(`${board}: settings-row heights in use ${JSON.stringify(heights)} (${heights.length} idioms)`);
}

// Branch: tinted (accentSoft / selected) area competing with the primary action.
for (const board of ['BranchNow', 'Branch']) {
  const tinted = await page.evaluate((board) => {
    const root = document.querySelector(`[data-board="${board}"]`);
    const people = root.querySelector('#people');
    let area = 0;
    let stroked = 0;
    for (const node of people.querySelectorAll('*')) {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      if (style.backgroundColor === 'rgb(225, 237, 231)') area += Math.round(box.width * box.height);
      if (style.borderTopColor === 'rgb(14, 110, 87)' && parseFloat(style.borderTopWidth) > 0) stroked += 1;
    }
    return { area, stroked, height: Math.round(people.getBoundingClientRect().height) };
  }, board);
  console.log(`${board}: traveller block ${tinted.height}px tall, accent-stroked surfaces ${tinted.stroked}, accentSoft fill ${tinted.area}px²`);
}

// Branch sheet: can the primary action be reached without scrolling?
for (const board of ['BranchNow', 'Branch']) {
  const reach = await page.evaluate((board) => {
    const root = document.querySelector(`[data-board="${board}"]`);
    const frame = root.getBoundingClientRect();
    const button = [...root.querySelectorAll('.btn-p')].pop().getBoundingClientRect();
    return { bottom: Math.round(button.bottom - frame.top), frame: Math.round(frame.height) };
  }, board);
  console.log(`${board}: 创建分支 bottom at ${reach.bottom}px in a ${reach.frame}px frame` +
    (reach.bottom > reach.frame ? ` — ${reach.bottom - reach.frame}px below the fold` : ' — reachable without scrolling'));
}

await browser.close();
