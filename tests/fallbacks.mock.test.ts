import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// These tests force the defensive fallback branches (catch blocks, nullish
// coalescing, optional chaining) that only fire on corrupted/degenerate inputs.

describe('version.ts fallbacks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('node:module');
  });

  it('returns 0.0.0 when the require throws', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => {
        throw new Error('boom');
      },
    }));
    const { getVersion } = await import('../src/version.js');
    expect(getVersion()).toBe('0.0.0');
  });

  it('returns 0.0.0 when package.json has no version', async () => {
    vi.doMock('node:module', () => ({
      createRequire: () => () => ({}),
    }));
    const { getVersion } = await import('../src/version.js');
    expect(getVersion()).toBe('0.0.0');
  });
});

describe('git-history remote without a fetch ref', () => {
  it('falls back to the remote name when refs.fetch is absent', async () => {
    vi.resetModules();
    vi.doMock('simple-git', () => ({
      simpleGit: () => ({
        checkIsRepo: async () => true,
        getRemotes: async () => [{ name: 'origin' }], // no refs object
        revparse: async () => 'main',
        raw: async () => '',
      }),
    }));
    const { analyzeGit } = await import('../src/analyzer/git-history.js');
    const info = await analyzeGit('/whatever');
    expect(info.remoteName).toBe('origin');
    expect(info.hasGit).toBe(true);
    vi.doUnmock('simple-git');
    vi.resetModules();
  });

  it('remoteName is null when a remote has neither refs nor name', async () => {
    vi.resetModules();
    vi.doMock('simple-git', () => ({
      simpleGit: () => ({
        checkIsRepo: async () => true,
        getRemotes: async () => [{}], // neither refs nor name
        revparse: async () => '',
        raw: async () => '',
      }),
    }));
    const { analyzeGit } = await import('../src/analyzer/git-history.js');
    const info = await analyzeGit('/whatever');
    expect(info.remoteName).toBeNull();
    expect(info.defaultBranch).toBe('main'); // empty revparse -> 'main'
    vi.doUnmock('simple-git');
    vi.resetModules();
  });
});

describe('analyzeProject name fallback', () => {
  it("uses 'project' when both package.json name and basename are empty", async () => {
    vi.resetModules();
    const path = await vi.importActual<typeof import('node:path')>('node:path');
    vi.doMock('node:path', () => ({ ...path, basename: () => '' }));
    const { analyzeProject } = await import('../src/analyzer/index.js');
    const empty = await mkdtemp(join(tmpdir(), 'cinit-name-'));
    try {
      // no package.json -> pkg?.name empty, basename mocked to '' -> 'project'
      const a = await analyzeProject(empty);
      expect(a.name).toBe('project');
    } finally {
      await rm(empty, { recursive: true, force: true });
      vi.doUnmock('node:path');
      vi.resetModules();
    }
  });
});
