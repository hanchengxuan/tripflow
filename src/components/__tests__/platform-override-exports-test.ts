// Declared locally rather than pulling `@types/node` into the app's tsconfig
// for one test; this file is the only place that touches the filesystem.
declare const require: (id: string) => any;
declare const __dirname: string;

interface DirEntry { name: string; isDirectory(): boolean }
const { readdirSync, readFileSync, existsSync } = require('fs') as {
  readdirSync: (dir: string, options: { withFileTypes: true }) => DirEntry[];
  readFileSync: (path: string, encoding: string) => string;
  existsSync: (path: string) => boolean;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * Metro picks `foo.web.tsx` over `foo.tsx` on web without any diagnostic, and
 * TypeScript only ever resolves the base file. An export present on one side
 * and missing on the other therefore passes lint, tsc, and the native build,
 * then throws "Element type is invalid" at render time on the other platform —
 * which unmounts the tree and shows a blank screen.
 *
 * That is exactly how the itinerary composer went black on web: `a001c0b`
 * added `DateTimePairField` to `date-time-field.tsx` and not to
 * `date-time-field.web.tsx`.
 */

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry: DirEntry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function exportedNames(path: string) {
  const source = readFileSync(path, 'utf8');
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(source)) names.add('default');
  return names;
}

const overrides = sourceFiles(SRC)
  .filter((path) => /\.web\.tsx?$/.test(path))
  .map((webPath) => {
    const base = webPath.replace(/\.web\.(tsx?)$/, '.$1');
    const alternate = base.replace(/\.ts$/, '.tsx').replace(/\.tsx$/, base.endsWith('.ts') ? '.tsx' : '.ts');
    return { webPath, basePath: existsSync(base) ? base : alternate };
  })
  .filter(({ basePath }) => existsSync(basePath));

test('every platform override has a base module to compare against', () => {
  expect(overrides.length).toBeGreaterThan(0);
});

describe.each(overrides)('$webPath', ({ webPath, basePath }) => {
  it('exports exactly the same names as its base module', () => {
    expect([...exportedNames(webPath)].sort()).toEqual([...exportedNames(basePath)].sort());
  });
});
