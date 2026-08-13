#!/usr/bin/env node

import fs from 'node:fs';

const auditPath = process.argv[2];

if (!auditPath) {
  console.error('Usage: node scripts/check-npm-audit.mjs <npm-audit-json>');
  process.exit(2);
}

let report;

try {
  report = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
} catch (error) {
  console.error(`Unable to read npm audit JSON: ${error.message}`);
  process.exit(2);
}

if (
  !report
  || typeof report !== 'object'
  || report.error
  || !report.vulnerabilities
  || typeof report.vulnerabilities !== 'object'
  || !report.metadata?.vulnerabilities
) {
  const detail = report?.error?.summary ?? report?.error?.message ?? 'the report is incomplete';
  console.error(`npm audit did not return a complete vulnerability report: ${detail}`);
  process.exit(2);
}

// Expo SDK 57 currently reports these advisories through its Metro/Xcode
// build-time dependency graph. Keep this list exact and small so any new
// high/critical advisory still fails the quality gate.
const approvedBuildChainAdvisories = new Set([
  'GHSA-5P2G-FCMC-QVQQ',
  'GHSA-W3RX-R6R6-PGPR',
  'GHSA-W5HQ-G745-H8PQ',
]);

const vulnerabilities = report.vulnerabilities ?? {};

function unique(values) {
  return [...new Set(values)];
}

function advisoryIds(via) {
  return via.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];

    const url = typeof entry.url === 'string' ? entry.url : '';
    const match = url.match(/GHSA-[0-9a-z-]+/i);

    return match ? [match[0].toUpperCase()] : [];
  });
}

function advisoryRoots(packageName, visiting = new Set()) {
  if (visiting.has(packageName)) return [];

  const vulnerability = vulnerabilities[packageName];
  if (!vulnerability) return [];

  const nextVisiting = new Set(visiting).add(packageName);
  const roots = (vulnerability.via ?? []).flatMap((entry) => {
    if (typeof entry === 'string') {
      return advisoryRoots(entry, nextVisiting);
    }

    return advisoryIds([entry]);
  });

  return unique(roots);
}

const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };
const failures = [];
const approved = [];

for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
  if ((severityRank[vulnerability.severity] ?? 0) < severityRank.high) continue;

  const roots = advisoryRoots(packageName);
  const isCritical = vulnerability.severity === 'critical';
  const isApproved = !isCritical
    && roots.length > 0
    && roots.every((root) => approvedBuildChainAdvisories.has(root));

  if (isApproved) {
    approved.push({ packageName, severity: vulnerability.severity, roots });
  } else {
    failures.push({ packageName, severity: vulnerability.severity, roots });
  }
}

const metadata = report.metadata?.vulnerabilities ?? {};
console.log(
  `npm audit: ${metadata.total ?? 0} total `
    + `(${metadata.critical ?? 0} critical, ${metadata.high ?? 0} high, `
    + `${metadata.moderate ?? 0} moderate, ${metadata.low ?? 0} low)`,
);

if (approved.length > 0) {
  console.log(`Approved Expo build-chain advisories: ${approved.length}`);
}

if (failures.length > 0) {
  console.error('Unapproved high/critical advisories found:');
  for (const failure of failures) {
    const roots = failure.roots.length > 0 ? failure.roots.join(', ') : 'unknown advisory source';
    console.error(`- ${failure.packageName} (${failure.severity}; ${roots})`);
  }
  process.exit(1);
}

console.log('Dependency audit gate passed.');
