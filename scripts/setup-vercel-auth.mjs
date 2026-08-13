#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const globalConfig = process.env.VERCEL_GLOBAL_CONFIG;
const token = process.env.VERCEL_TOKEN;
const currentTeam = process.env.VERCEL_ORG_ID;

if (!globalConfig || !token || !currentTeam) {
  console.error('VERCEL_GLOBAL_CONFIG, VERCEL_TOKEN, and VERCEL_ORG_ID are required.');
  process.exit(1);
}

fs.mkdirSync(globalConfig, { recursive: true, mode: 0o700 });
fs.writeFileSync(
  path.join(globalConfig, 'auth.json'),
  `${JSON.stringify({ token }, null, 2)}\n`,
  { mode: 0o600 },
);
fs.writeFileSync(
  path.join(globalConfig, 'config.json'),
  `${JSON.stringify({ currentTeam }, null, 2)}\n`,
  { mode: 0o600 },
);
