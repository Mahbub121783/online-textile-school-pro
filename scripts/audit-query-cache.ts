#!/usr/bin/env bun
/**
 * Static audit: scans src/**\/*.{ts,tsx} for useQuery() blocks that
 * override the safe global defaults (5min staleTime, refetchOnMount: true).
 *
 * Flags:
 *   - staleTime: Infinity        → data will NEVER refetch automatically
 *   - refetchOnMount: false      → page revisit won't refresh stale data
 *   - enabled: false (literal)   → query permanently disabled
 *
 * Run:  bun scripts/audit-query-cache.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = 'src';
const findings: { file: string; line: number; issue: string; snippet: string }[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) scan(p);
  }
}

function scan(file: string) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('useQuery')) return;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    if (/staleTime\s*:\s*Infinity/.test(line)) {
      findings.push({ file, line: lineNum, issue: 'staleTime: Infinity', snippet: line.trim() });
    }
    if (/refetchOnMount\s*:\s*false/.test(line)) {
      findings.push({ file, line: lineNum, issue: 'refetchOnMount: false', snippet: line.trim() });
    }
    if (/enabled\s*:\s*false\b/.test(line) && !/\?\s*:/.test(line) && !/&&|\|\|/.test(line)) {
      findings.push({ file, line: lineNum, issue: 'enabled: false (literal)', snippet: line.trim() });
    }
  });
}

walk(ROOT);

if (findings.length === 0) {
  console.log('✅ No cache locks found. All useQuery hooks respect global defaults.');
  process.exit(0);
}

console.log(`⚠ Found ${findings.length} potential cache lock(s):\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}`);
  console.log(`    ${f.issue}`);
  console.log(`    > ${f.snippet}\n`);
}
process.exit(1);
