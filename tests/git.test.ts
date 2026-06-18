import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { analyzeGit } from '../src/analyzer/git-history.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-git-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('analyzeGit', () => {
  it('returns hasGit:false outside a repo', async () => {
    const info = await analyzeGit(dir);
    expect(info.hasGit).toBe(false);
  });

  it('reads branch, authors and hot files from a real repo', async () => {
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig('user.name', 'Test Dev');
    await git.addConfig('user.email', 'test@example.com');
    await git.checkoutLocalBranch('main');

    await writeFile(join(dir, 'a.txt'), '1', 'utf-8');
    await git.add('.');
    await git.commit('first');
    await writeFile(join(dir, 'a.txt'), '2', 'utf-8');
    await git.add('.');
    await git.commit('second');

    const info = await analyzeGit(dir);
    expect(info.hasGit).toBe(true);
    expect(info.defaultBranch).toBe('main');
    expect(info.topAuthors).toContain('Test Dev');
    expect(info.hotFiles).toContain('a.txt');
  });
});
