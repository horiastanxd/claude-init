import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { pathExists, readJson, readText } from '../utils.js';

/**
 * Workspace package directories of a monorepo, relative to `projectDir` with POSIX
 * separators. Reads npm/yarn `workspaces` (array or `{ packages: [] }`) and
 * `pnpm-workspace.yaml`. Only `dir/*` (single level) and exact paths are resolved;
 * each result is confirmed to contain a `package.json`.
 */
export async function detectWorkspacePackages(projectDir: string): Promise<string[]> {
  const globs = [
    ...(await npmWorkspaceGlobs(projectDir)),
    ...(await pnpmWorkspaceGlobs(projectDir)),
  ];
  const out: string[] = [];
  for (const glob of globs) {
    for (const rel of await resolveGlob(projectDir, glob)) {
      if (!out.includes(rel)) out.push(rel);
    }
  }
  return out;
}

async function npmWorkspaceGlobs(dir: string): Promise<string[]> {
  const pkg = await readJson<{ workspaces?: string[] | { packages?: string[] } }>(
    join(dir, 'package.json'),
  );
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) return ws;
  if (ws && Array.isArray(ws.packages)) return ws.packages;
  return [];
}

async function pnpmWorkspaceGlobs(dir: string): Promise<string[]> {
  const content = await readText(join(dir, 'pnpm-workspace.yaml'));
  if (content === null) return [];
  const globs: string[] = [];
  let inPackages = false;
  for (const line of content.split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const m = /^\s*-\s*["']?([^"'\n]+?)["']?\s*$/.exec(line);
    if (m) globs.push(m[1]!.trim());
    else if (/^\S/.test(line)) break;
  }
  return globs;
}

async function resolveGlob(projectDir: string, glob: string): Promise<string[]> {
  const g = glob.replace(/\/+$/, '');
  if (g.startsWith('!') || g === '') return []; // pnpm exclusions / blanks
  const hasPkgJson = (rel: string) => pathExists(join(projectDir, rel, 'package.json'));

  if (g.endsWith('/*')) {
    const base = g.slice(0, -2);
    let entries;
    try {
      entries = await readdir(join(projectDir, base), { withFileTypes: true });
    } catch {
      return [];
    }
    const out: string[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const rel = `${base}/${e.name}`;
      if (await hasPkgJson(rel)) out.push(rel);
    }
    return out;
  }

  // Deeper globs (** or mid-path *) are not resolved - avoid guessing wrong paths.
  if (g.includes('*')) return [];

  return (await hasPkgJson(g)) ? [g] : [];
}
