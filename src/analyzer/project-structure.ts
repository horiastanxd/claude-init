import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isDir, pathExists } from '../utils.js';
import type { ProjectStructure } from '../types.js';

const IGNORE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  'target',
  '.cargo',
  'vendor',
  'coverage',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
]);

const ENTRY_CANDIDATES = [
  'src/index.ts',
  'src/main.ts',
  'src/app.ts',
  'src/cli.ts',
  'index.ts',
  'main.ts',
  'app.ts',
  'src/index.js',
  'index.js',
  'main.py',
  'app.py',
  'src/main.rs',
  'main.go',
  'cmd/main.go',
];

const CONFIG_CANDIDATES = [
  '.env.example',
  '.env.sample',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'docker-compose.yml',
  'Dockerfile',
  'Makefile',
];

export async function analyzeStructure(
  projectDir: string,
  extraIgnore: Iterable<string> = [],
): Promise<ProjectStructure> {
  const ignore = new Set([...IGNORE, ...extraIgnore]);
  const [tree, entryPoints, configFiles, srcDir, testDir] = await Promise.all([
    buildTree(projectDir, 0, 2, ignore),
    findExisting(projectDir, ENTRY_CANDIDATES),
    findExisting(projectDir, CONFIG_CANDIDATES),
    (async () => ((await isDir(join(projectDir, 'src'))) ? 'src' : null))(),
    detectTestDir(projectDir),
  ]);

  return { tree, entryPoints, configFiles, srcDir, testDir };
}

async function buildTree(
  dir: string,
  depth: number,
  maxDepth: number,
  ignore: Set<string>,
): Promise<string> {
  if (depth > maxDepth) return '';
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const sorted = entries
    .filter((e) => !ignore.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 25);

  const lines: string[] = [];
  for (const entry of sorted) {
    const prefix = '  '.repeat(depth);
    if (entry.isDirectory()) {
      lines.push(`${prefix}${entry.name}/`);
      const sub = await buildTree(join(dir, entry.name), depth + 1, maxDepth, ignore);
      if (sub) lines.push(sub);
    } else {
      lines.push(`${prefix}${entry.name}`);
    }
  }
  return lines.join('\n');
}

async function findExisting(dir: string, candidates: string[]): Promise<string[]> {
  const checks = await Promise.all(
    candidates.map(async (c) => ((await pathExists(join(dir, c))) ? c : null)),
  );
  return checks.filter((c): c is string => c !== null);
}

async function detectTestDir(dir: string): Promise<string | null> {
  for (const candidate of ['tests', 'test', '__tests__', 'spec', 'e2e']) {
    if (await isDir(join(dir, candidate))) return candidate;
  }
  return null;
}
