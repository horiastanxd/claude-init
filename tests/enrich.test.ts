import { describe, it, expect } from 'vitest';
import { enrichAnalysis, createAnthropicCompleter } from '../src/enrich.js';
import type { ProjectAnalysis } from '../src/types.js';

const base: ProjectAnalysis = {
  name: 'demo',
  description: '',
  techStack: {
    language: 'TypeScript',
    framework: 'Next.js',
    runtime: 'Node.js',
    packageManager: 'npm',
    database: null,
    testing: 'Vitest',
    buildTool: null,
    extraLibraries: [],
  },
  structure: { tree: 'src/\n  index.ts', entryPoints: [], configFiles: [], srcDir: 'src', testDir: null },
  commands: { install: 'npm install', dev: null, build: null, test: null, lint: null, format: null, extra: {} },
  tests: { framework: 'Vitest', command: null, coverage: false, testDir: null },
  envVars: [],
  codePatterns: { strict: true, linter: null, formatter: null, commitConvention: null, importStyle: null },
  gitInfo: { hasGit: false, remoteName: null, defaultBranch: null, topAuthors: [], hotFiles: [] },
};

describe('enrichAnalysis', () => {
  it('replaces the description with the completer output', async () => {
    const complete = async () => 'A CLI that generates AI context files for any repository.';
    const out = await enrichAnalysis({ ...base }, complete);
    expect(out.description).toBe('A CLI that generates AI context files for any repository.');
  });

  it('keeps the original description when the completer returns blank', async () => {
    const out = await enrichAnalysis({ ...base, description: 'original' }, async () => '   ');
    expect(out.description).toBe('original');
  });

  it('gives the completer the project facts to summarise', async () => {
    let prompt = '';
    await enrichAnalysis({ ...base, name: 'cool-proj' }, async (_system, user) => {
      prompt = user;
      return 'x';
    });
    expect(prompt).toContain('cool-proj');
    expect(prompt).toContain('TypeScript');
  });

  it('does not mutate the input analysis', async () => {
    const input = { ...base, description: 'before' };
    await enrichAnalysis(input, async () => 'after');
    expect(input.description).toBe('before');
  });
});

describe('createAnthropicCompleter', () => {
  it('errors clearly when the Anthropic SDK is not installed', async () => {
    await expect(
      createAnthropicCompleter({ model: 'claude-opus-4-8', apiKey: 'sk-test' }),
    ).rejects.toThrow(/Anthropic SDK/);
  });
});
