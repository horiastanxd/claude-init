import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { detectWorkspacePackages } from '../src/analyzer/workspaces.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-ws-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = join(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, 'utf-8');
}

describe('detectWorkspacePackages', () => {
  it('resolves npm/yarn workspace globs to packages that have a package.json', async () => {
    await write('package.json', JSON.stringify({ workspaces: ['packages/*', 'apps/web'] }));
    await write('packages/a/package.json', '{}');
    await write('packages/b/package.json', '{}');
    await write('packages/notapkg/readme.md', 'x');
    await write('apps/web/package.json', '{}');
    const pkgs = await detectWorkspacePackages(dir);
    expect(pkgs.sort()).toEqual(['apps/web', 'packages/a', 'packages/b']);
  });

  it('supports the { packages: [...] } workspaces form', async () => {
    await write('package.json', JSON.stringify({ workspaces: { packages: ['libs/*'] } }));
    await write('libs/x/package.json', '{}');
    const pkgs = await detectWorkspacePackages(dir);
    expect(pkgs).toEqual(['libs/x']);
  });

  it('reads pnpm-workspace.yaml', async () => {
    await write('pnpm-workspace.yaml', 'packages:\n  - "packages/*"\n  - services/api\n');
    await write('packages/ui/package.json', '{}');
    await write('services/api/package.json', '{}');
    const pkgs = await detectWorkspacePackages(dir);
    expect(pkgs.sort()).toEqual(['packages/ui', 'services/api']);
  });

  it('returns empty for a non-monorepo', async () => {
    await write('package.json', JSON.stringify({ name: 'x' }));
    expect(await detectWorkspacePackages(dir)).toEqual([]);
  });
});
