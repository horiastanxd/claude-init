import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from './helpers.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-e2e-'));
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'e2e-proj', scripts: { test: 'vitest', build: 'tsc' }, devDependencies: { typescript: '5' } }),
    'utf-8',
  );
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('CLI e2e (built binary)', () => {
  it('--version prints a semver', async () => {
    const r = await runCli(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('list shows the targets', async () => {
    const r = await runCli(['list']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('claude');
    expect(r.stdout).toContain('AGENTS.md');
  });

  it('generate writes files and is idempotent without --overwrite', async () => {
    const first = await runCli(['generate', dir, '-o', dir]);
    expect(first.code).toBe(0);
    expect(await readFile(join(dir, 'CLAUDE.md'), 'utf-8')).toContain('# e2e-proj');

    const second = await runCli(['generate', dir, '-o', dir]);
    expect(second.stdout).toContain('Nothing written');
  });

  it('check exits 0 when fresh and 1 when stale', async () => {
    await runCli(['generate', dir, '-o', dir, '--overwrite']);
    const fresh = await runCli(['check', dir, '-o', dir]);
    expect(fresh.code).toBe(0);

    await writeFile(join(dir, 'CLAUDE.md'), 'stale', 'utf-8');
    const stale = await runCli(['check', dir, '-o', dir]);
    expect(stale.code).toBe(1);
    expect(stale.stdout).toContain('stale');
  });

  it('rejects an invalid target with a non-zero exit', async () => {
    const r = await runCli(['generate', dir, '-o', dir, '-t', 'bogus']);
    expect(r.code).not.toBe(0);
    expect(r.stderr + r.stdout).toContain('Unknown target');
  });

  it('--dry-run prints JSON and writes nothing', async () => {
    const r = await runCli(['generate', dir, '-o', dir, '--dry-run']);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.name).toBe('e2e-proj');
    await expect(readFile(join(dir, 'CLAUDE.md'), 'utf-8')).rejects.toThrow();
  });
});
