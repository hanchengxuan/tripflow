#!/usr/bin/env node
// One-off: shrink avatars uploaded before upload-time resizing to the same 256px square the app now stores.
// Overwrites each file at its existing path, so profile and archived-member rows keep working unchanged.
// Uses macOS `sips`. Dry run by default; pass --apply to write.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/shrink-existing-avatars.mjs [--apply]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const AVATAR_PIXELS = 256;
const apply = process.argv.includes('--apply');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// The service role has no table grants here, so walk the bucket (`<user id>/<file>`) instead of profiles.
async function list(prefix) {
  const items = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from('avatars').list(prefix, { limit: 1000, offset });
    if (error) throw error;
    items.push(...data);
    if (data.length < 1000) return items;
  }
}

async function avatarPaths() {
  const paths = [];
  for (const folder of await list('')) {
    if (folder.id) continue;
    for (const file of await list(folder.name)) if (file.id) paths.push(`${folder.name}/${file.name}`);
  }
  return paths;
}

function dimensions(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  return [Number(out.match(/pixelWidth: (\d+)/)[1]), Number(out.match(/pixelHeight: (\d+)/)[1])];
}

const work = mkdtempSync(join(tmpdir(), 'avatars-'));
let shrunk = 0;
let failed = 0;
try {
  for (const path of await avatarPaths()) {
    try {
      const { data, error } = await client.storage.from('avatars').download(path);
      if (error) throw error;
      const source = join(work, 'source');
      writeFileSync(source, new Uint8Array(await data.arrayBuffer()));
      const [width, height] = dimensions(source);
      if (Math.max(width, height) <= AVATAR_PIXELS) {
        console.log(`skip   ${path} (${width}x${height})`);
        continue;
      }
      const png = /\.(png|webp)$/i.test(path);
      const output = join(work, png ? 'out.png' : 'out.jpg');
      const side = Math.min(width, height);
      execFileSync('sips', [
        '--cropToHeightWidth', String(side), String(side),
        '--resampleHeightWidthMax', String(AVATAR_PIXELS),
        '-s', 'format', png ? 'png' : 'jpeg',
        ...(png ? [] : ['-s', 'formatOptions', '80']),
        source, '--out', output,
      ], { stdio: 'ignore' });
      const body = readFileSync(output);
      console.log(`${apply ? 'shrink' : 'would '} ${path} ${width}x${height} ${data.size} B -> ${AVATAR_PIXELS}px ${body.length} B`);
      if (apply) {
        const { error: uploadError } = await client.storage.from('avatars').update(path, body, {
          contentType: png ? 'image/png' : 'image/jpeg',
          upsert: true,
        });
        if (uploadError) throw uploadError;
      }
      shrunk += 1;
    } catch (error) {
      failed += 1;
      console.error(`fail   ${path}: ${error.message ?? error}`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`${apply ? 'Shrunk' : 'Would shrink'} ${shrunk}; failed ${failed}.${apply ? '' : ' Re-run with --apply to write.'}`);
process.exitCode = failed ? 1 : 0;
