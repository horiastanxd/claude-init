import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { isDir, readText, readJson } from '../src/utils.js';
import { parseEnvFile } from '../src/analyzer/env-vars.js';
import { detectTechStack } from '../src/analyzer/tech-stack.js';
import { detectCommands } from '../src/analyzer/commands.js';
import { analyzeStructure } from '../src/analyzer/project-structure.js';
import { analyzeGit } from '../src/analyzer/git-history.js';
import { analyzeProject } from '../src/analyzer/index.js';
import {
  commandsSection,
  testingSection,
  envSection,
  conventionsSection,
  compose,
} from '../src/generators/sections.js';
import type { ProjectAnalysis } from '../src/types.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-gap-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('utils error branches', () => {
  it('isDir false on missing path', async () => {
    expect(await isDir(join(dir, 'nope'))).toBe(false);
  });
  it('readText null on missing file', async () => {
    expect(await readText(join(dir, 'nope.txt'))).toBeNull();
  });
  it('readJson null on malformed JSON', async () => {
    await writeFile(join(dir, 'bad.json'), '{ not json', 'utf-8');
    expect(await readJson(join(dir, 'bad.json'))).toBeNull();
  });
});

describe('tech-stack / commands on malformed package.json', () => {
  it('detectTechStack falls back when package.json is unparseable', async () => {
    await writeFile(join(dir, 'package.json'), '{ broken', 'utf-8');
    const t = await detectTechStack(dir);
    expect(t.language).toBe('unknown'); // manifest present but parser returns {} -> EMPTY
    expect(t.framework).toBeNull();
  });
  it('detectCommands tolerates malformed package.json (scripts default {})', async () => {
    await writeFile(join(dir, 'package.json'), '{ broken', 'utf-8');
    const c = await detectCommands(dir);
    expect(c.install).toBe('npm install');
    expect(c.dev).toBeNull();
    expect(c.test).toBeNull();
  });

  it('detectCommands with only a test script leaves dev/build/format null', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'x' } }), 'utf-8');
    const c = await detectCommands(dir);
    expect(c.test).toBe('npm run test');
    expect(c.dev).toBeNull();
    expect(c.build).toBeNull();
    expect(c.format).toBeNull();
  });

  it('detectCommands picks the "format" script over "fmt" and maps lint', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ scripts: { build: 'x', format: 'x', fmt: 'x', lint: 'x' } }),
      'utf-8',
    );
    const c = await detectCommands(dir);
    expect(c.build).toBe('npm run build');
    expect(c.format).toBe('npm run format');
    expect(c.lint).toBe('npm run lint');
  });
});

describe('code-patterns: prettier via package.json key', () => {
  it('detects Prettier from the "prettier" key in package.json', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ prettier: { semi: false } }), 'utf-8');
    const { detectCodePatterns } = await import('../src/analyzer/code-patterns.js');
    expect((await detectCodePatterns(dir)).formatter).toBe('Prettier');
  });
});

describe('env-vars parse edge branches', () => {
  it('skips lines without "=" and orphan "=value", strips export and quotes', () => {
    const vars = parseEnvFile(
      ['NO_EQUALS_LINE', '=orphan', 'export TOKEN="abc"', '', 'PLAIN=1'].join('\n'),
    );
    const names = vars.map((v) => v.name);
    expect(names).toEqual(['TOKEN', 'PLAIN']);
    expect(vars[0]).toMatchObject({ name: 'TOKEN', example: 'abc', required: false });
  });
});

describe('git branches: remote + zero-commit repo', () => {
  it('captures remote fetch url', async () => {
    const git = simpleGit(dir);
    await git.init();
    await git.addConfig('user.name', 'A');
    await git.addConfig('user.email', 'a@b.c');
    await git.addRemote('origin', 'https://example.com/x.git');
    await writeFile(join(dir, 'f'), '1', 'utf-8');
    await git.add('.');
    await git.commit('c');
    const info = await analyzeGit(dir);
    expect(info.remoteName).toContain('example.com');
  });

  it('handles a freshly-initialized repo with no commits', async () => {
    const git = simpleGit(dir);
    await git.init();
    const info = await analyzeGit(dir);
    expect(info.hasGit).toBe(true);
    expect(info.topAuthors).toEqual([]);
    expect(info.hotFiles).toEqual([]);
    expect(info.defaultBranch).toBeTruthy();
  });
});

describe('structure null branches', () => {
  it('srcDir/testDir null and deep nesting beyond max depth', async () => {
    await mkdir(join(dir, 'a', 'b', 'c', 'd'), { recursive: true });
    await writeFile(join(dir, 'a', 'b', 'c', 'd', 'deep.txt'), '', 'utf-8');
    const s = await analyzeStructure(dir);
    expect(s.srcDir).toBeNull();
    expect(s.testDir).toBeNull();
    expect(s.tree).toContain('a/');
  });
});

describe('analyzeProject basename fallback (no package.json)', () => {
  it('uses the directory name when there is no package.json', async () => {
    await writeFile(join(dir, 'Cargo.toml'), '[package]\nname="x"\n', 'utf-8');
    const a = await analyzeProject(dir);
    expect(a.name).toBe(dir.split(/[\\/]/).pop());
    expect(a.description).toBe('');
    expect(a.techStack.language).toBe('Rust');
  });

  it('uses the directory name when package.json has no name field', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ version: '1' }), 'utf-8');
    const a = await analyzeProject(dir);
    expect(a.name).toBe(dir.split(/[\\/]/).pop());
  });
});

describe('sections edge branches', () => {
  const base: ProjectAnalysis = {
    name: 'x',
    description: '',
    techStack: {
      language: 'TypeScript',
      framework: null,
      runtime: null,
      packageManager: 'npm',
      database: null,
      testing: null,
      buildTool: null,
      extraLibraries: [],
    },
    structure: { tree: '', entryPoints: [], configFiles: [], srcDir: null, testDir: null },
    commands: { install: null, dev: null, build: null, test: null, lint: null, format: null, extra: {} },
    tests: { framework: null, command: null, coverage: false, testDir: null },
    envVars: [],
    codePatterns: { strict: false, linter: null, formatter: null, commitConvention: null, importStyle: null },
    gitInfo: { hasGit: false, remoteName: null, defaultBranch: null, topAuthors: [], hotFiles: [] },
  };

  it('commandsSection returns empty when no commands', () => {
    expect(commandsSection(base)).toBe('');
  });

  it('commandsSection includes extra scripts block', () => {
    const out = commandsSection({ ...base, commands: { ...base.commands, install: 'npm i', extra: { db: 'npm run db' } } });
    expect(out).toContain('Other scripts:');
    expect(out).toContain('npm run db');
  });

  it('testingSection without framework omits the framework line', () => {
    const out = testingSection({ ...base, tests: { ...base.tests, command: 'npm test', framework: null } });
    expect(out).toContain('npm test');
    expect(out).not.toContain('Framework:');
  });

  it('testingSection with framework prepends the framework line', () => {
    const out = testingSection({ ...base, tests: { ...base.tests, command: 'npm test', framework: 'Vitest' } });
    expect(out).toContain('Framework: Vitest.');
  });

  it('conventionsSection renders all set conventions and is empty when none', () => {
    const full = conventionsSection({
      ...base,
      codePatterns: {
        strict: true,
        linter: 'ESLint',
        formatter: 'Prettier',
        commitConvention: 'Conventional Commits',
        importStyle: 'relative',
      },
    });
    expect(full).toContain('strict mode');
    expect(full).toContain('Linter: ESLint');
    expect(full).toContain('Formatter: Prettier');
    expect(full).toContain('Import style: relative');
    expect(full).toContain('Commit convention: Conventional Commits');
    expect(conventionsSection(base)).toBe('');
  });

  it('envSection marks optional vars and handles missing description', () => {
    const out = envSection({
      ...base,
      envVars: [{ name: 'OPT', example: '1', required: false, description: '' }],
    });
    expect(out).toContain('`OPT` (optional)');
    expect(out).not.toContain(' - ');
  });

  it('compose drops empty-bodied sections and collapses blank runs', () => {
    const out = compose([
      ['Stack', 'content'],
      ['Empty', '   '],
    ]);
    expect(out).toContain('## Stack');
    expect(out).not.toContain('## Empty');
    expect(out).not.toMatch(/\n{3,}/);
  });

  it('compose with an untitled block emits the body without a heading', () => {
    const out = compose([['', 'lead paragraph']]);
    expect(out).toContain('lead paragraph');
    expect(out).not.toContain('## ');
  });
});

describe('tech-stack: unreadable manifest falls back to empty content', () => {
  // A manifest that is a directory passes pathExists but readText returns null.
  it.each(['Cargo.toml', 'go.mod', 'pyproject.toml'])('%s as a directory', async (name) => {
    await mkdir(join(dir, name), { recursive: true });
    const t = await detectTechStack(dir);
    expect(t.framework).toBeNull();
    expect(['Rust', 'Go', 'Python']).toContain(t.language);
  });

  it('pyproject with pytest sets the test runner', async () => {
    await writeFile(join(dir, 'pyproject.toml'), '[project]\ndependencies=["pytest"]\n', 'utf-8');
    expect((await detectTechStack(dir)).testing).toBe('pytest');
  });
});
