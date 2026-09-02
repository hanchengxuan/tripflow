/**
 * Assembles the UI 2.1 artboards.
 *
 * `parts/<Name>.html` holds the artboard body; `_tokens.css` holds the values
 * lifted from `src/constants/theme.ts`. One source for the tokens means an
 * artboard can never drift from the app's palette by a hand-edited hex.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, '_tokens.css'), 'utf8');

for (const file of readdirSync(join(here, 'parts')).filter((name) => name.endsWith('.html')).sort()) {
  const name = file.replace(/\.html$/, '');
  const body = readFileSync(join(here, 'parts', file), 'utf8').trimEnd();
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
${tokens.trimEnd()}
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
