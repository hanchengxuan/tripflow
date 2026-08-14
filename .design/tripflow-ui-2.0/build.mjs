// Inlines tokens.css + kit.css into each source page so every published card
// is self-contained (the Design System pane and static snapshots do not resolve
// relative stylesheet links).
//
//   node .design/tripflow-ui-2.0/build.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

const tokens = readFileSync(join(src, 'tokens.css'), 'utf8');
const kit = readFileSync(join(src, 'kit.css'), 'utf8');
const bundle = `<style>\n${tokens}\n${kit}\n</style>`;

const pages = readdirSync(src).filter((f) => f.endsWith('.html'));
const built = [];

for (const page of pages) {
  const html = readFileSync(join(src, page), 'utf8');
  const out = html.replace(
    /<link rel="stylesheet" href="tokens\.css">\s*<link rel="stylesheet" href="kit\.css">/,
    bundle,
  );
  if (out === html) throw new Error(`${page}: stylesheet links not found — check the link tags`);
  writeFileSync(join(root, page), out);
  built.push(page);
}

console.log(`built ${built.length} self-contained pages:\n  ${built.join('\n  ')}`);
