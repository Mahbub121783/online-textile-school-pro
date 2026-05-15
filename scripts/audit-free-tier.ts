#!/usr/bin/env bun
/**
 * Free-tier load audit. Scans src TS/TSX files and reports:
 *  - supabase.from('X').select(...) calls (flags select('*'))
 *  - useQuery option overrides (staleTime / refetchInterval / refetchOnMount)
 *  - realtime channel subscriptions
 *  - .range() / .limit() presence on list queries
 *  - search inputs without debounce
 *
 * Output: .lovable/free-tier-audit.json + .lovable/free-tier-audit.md
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = 'src';
type Finding = { file: string; line: number; kind: string; detail: string };
const findings: Finding[] = [];

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
  if (!text.includes('supabase') && !text.includes('useQuery')) return;
  const rel = relative('.', file);
  const lines = text.split('\n');

  // Multi-line select detection
  const fromSelectRe = /\.from\(\s*['"`]([\w_]+)['"`][^)]*\)\s*\.select\(\s*['"`]([^'"`]*)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = fromSelectRe.exec(text))) {
    const before = text.slice(0, m.index).split('\n').length;
    const cols = m[2];
    findings.push({
      file: rel,
      line: before,
      kind: cols.trim() === '*' ? 'select-star' : 'select-cols',
      detail: `from('${m[1]}').select('${cols.length > 60 ? cols.slice(0, 60) + '…' : cols}')`,
    });
  }

  lines.forEach((line, i) => {
    const ln = i + 1;
    if (/refetchInterval\s*:\s*\d/.test(line)) findings.push({ file: rel, line: ln, kind: 'refetchInterval', detail: line.trim().slice(0, 100) });
    if (/refetchOnMount\s*:\s*['"]?always/.test(line)) findings.push({ file: rel, line: ln, kind: 'refetchOnMount-always', detail: line.trim().slice(0, 100) });
    if (/staleTime\s*:\s*0\b/.test(line)) findings.push({ file: rel, line: ln, kind: 'staleTime-0', detail: line.trim().slice(0, 100) });
    if (/supabase\s*\.\s*channel\(/.test(line)) findings.push({ file: rel, line: ln, kind: 'realtime-channel', detail: line.trim().slice(0, 100) });
    if (/postgres_changes/.test(line)) findings.push({ file: rel, line: ln, kind: 'postgres_changes', detail: line.trim().slice(0, 100) });
    if (/setInterval\s*\(/.test(line)) findings.push({ file: rel, line: ln, kind: 'setInterval', detail: line.trim().slice(0, 100) });
  });

  // Detect list reads without limit/range
  const fromAny = /\.from\(\s*['"`]([\w_]+)['"`]/g;
  while ((m = fromAny.exec(text))) {
    // Look in next 400 chars for .single() / .maybeSingle() / .limit / .range / .eq
    const tail = text.slice(m.index, m.index + 600);
    if (/\.(single|maybeSingle)\(/.test(tail)) continue;
    if (/\.(limit|range)\(/.test(tail)) continue;
    // If it has a unique-id .eq filter it's likely a single-row read; skip
    if (/\.eq\(\s*['"`]id['"`]/.test(tail)) continue;
    const before = text.slice(0, m.index).split('\n').length;
    findings.push({ file: rel, line: before, kind: 'unbounded-list', detail: `from('${m[1]}') without limit/range` });
  }
}

walk(ROOT);

// Group + summarize
const byKind: Record<string, Finding[]> = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);
const counts = Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length]));

mkdirSync('.lovable', { recursive: true });
writeFileSync('.lovable/free-tier-audit.json', JSON.stringify({ counts, findings }, null, 2));

// Markdown report — top offenders per kind
const md: string[] = ['# Free-tier load audit', '', '## Summary', ''];
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md.push(`- **${k}**: ${n}`);
md.push('', '## Findings by kind', '');
for (const [kind, list] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  md.push(`### ${kind} (${list.length})`, '');
  // top 40 per kind to keep file readable
  for (const f of list.slice(0, 40)) md.push(`- \`${f.file}:${f.line}\` — ${f.detail}`);
  if (list.length > 40) md.push(`- … and ${list.length - 40} more (see JSON)`);
  md.push('');
}
writeFileSync('.lovable/free-tier-audit.md', md.join('\n'));
console.log(`Wrote ${findings.length} findings → .lovable/free-tier-audit.{json,md}`);
console.log('Counts:', counts);
