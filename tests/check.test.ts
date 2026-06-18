import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateAll, checkAll, buildFiles } from '../src/generators/index.js';
import { invalidTargets, resolveTargets } from '../src/generators/registry.js';
import type { ProjectAnalysis } from '../src/types.js';

const sample: ProjectAnalysis = {
  name: 'tmp-proj',
  description: '',
  techStack: {
    language: 'TypeScript',
    framework: null,
    runtime: 'Node.js',
    packageManager: 'npm',
    database: null,
    testing: 'Vitest',
    buildTool: null,
    extraLibraries: [],
  },
  structure: { tree: 'src/', entryPoints: [], configFiles: [], srcDir: 'src', testDir: null },
  commands: {
    install: 'npm install',
    dev: null,
    build: null,
    test: 'npm run test',
    lint: null,
    format: null,
    extra: {},
  },
  tests: { framework: 'Vitest', command: 'npm run test', coverage: false, testDir: null },
  envVars: [],
  codePatterns: { strict: true, linter: null, formatter: null, commitConvention: null, importStyle: 'relative' },
  gitInfo: { hasGit: false, remoteName: null, defaultBranch: null, topAuthors: [], hotFiles: [] },
};

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'claude-init-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('generateAll', () => {
  it('writes files, then skips them without --overwrite', async () => {
    const first = await generateAll(sample, { outputDir: dir, targets: ['claude'], overwrite: false, minimal: false });
    expect(first.written).toHaveLength(1);

    const second = await generateAll(sample, { outputDir: dir, targets: ['claude'], overwrite: false, minimal: false });
    expect(second.written).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);

    const third = await generateAll(sample, { outputDir: dir, targets: ['claude'], overwrite: true, minimal: false });
    expect(third.written).toHaveLength(1);
  });

  it('creates nested directories for targets like cursor', async () => {
    const res = await generateAll(sample, { outputDir: dir, targets: ['cursor'], overwrite: false, minimal: false });
    expect(res.written[0]).toContain(join('.cursor', 'rules'));
  });
});

describe('checkAll', () => {
  it('reports missing, ok, then stale', async () => {
    const missing = await checkAll(sample, dir, ['claude']);
    expect(missing.entries[0]?.status).toBe('missing');
    expect(missing.drifted).toBe(true);

    const planned = buildFiles(sample, ['claude'])[0]!;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, planned.relPath), planned.content, 'utf-8');

    const ok = await checkAll(sample, dir, ['claude']);
    expect(ok.entries[0]?.status).toBe('ok');
    expect(ok.drifted).toBe(false);

    await writeFile(join(dir, planned.relPath), 'stale content', 'utf-8');
    const stale = await checkAll(sample, dir, ['claude']);
    expect(stale.entries[0]?.status).toBe('stale');
    expect(stale.drifted).toBe(true);
  });
});

describe('registry helpers', () => {
  it('resolves "all" to every target', () => {
    expect(resolveTargets(['all']).length).toBeGreaterThanOrEqual(10);
  });

  it('flags invalid target ids', () => {
    expect(invalidTargets(['claude', 'bogus'])).toEqual(['bogus']);
    expect(invalidTargets(['all', 'cursor'])).toEqual([]);
  });
});
