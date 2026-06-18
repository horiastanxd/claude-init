import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeStructure } from '../src/analyzer/project-structure.js';
import { detectCodePatterns } from '../src/analyzer/code-patterns.js';
import { detectTechStack } from '../src/analyzer/tech-stack.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-sp-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('analyzeStructure', () => {
  it('builds a tree, finds entry points, ignores noise dirs', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await mkdir(join(dir, 'node_modules', 'x'), { recursive: true });
    await mkdir(join(dir, 'tests'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.ts'), '', 'utf-8');
    await writeFile(join(dir, '.env.example'), 'A=1', 'utf-8');

    const s = await analyzeStructure(dir);
    expect(s.tree).toContain('src/');
    expect(s.tree).not.toContain('node_modules');
    expect(s.entryPoints).toContain('src/index.ts');
    expect(s.configFiles).toContain('.env.example');
    expect(s.srcDir).toBe('src');
    expect(s.testDir).toBe('tests');
  });
});

describe('detectCodePatterns', () => {
  it('detects strict mode, linter, formatter, commit convention and import style', async () => {
    await writeFile(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true, baseUrl: '.' } }),
      'utf-8',
    );
    await writeFile(join(dir, '.eslintrc.json'), '{}', 'utf-8');
    await writeFile(join(dir, '.prettierrc'), '{}', 'utf-8');
    await writeFile(join(dir, 'commitlint.config.js'), '', 'utf-8');

    const p = await detectCodePatterns(dir);
    expect(p.strict).toBe(true);
    expect(p.linter).toBe('ESLint');
    expect(p.formatter).toBe('Prettier');
    expect(p.commitConvention).toBe('Conventional Commits');
    expect(p.importStyle).toContain('absolute');
  });

  it('returns sane defaults for a bare directory', async () => {
    const p = await detectCodePatterns(dir);
    expect(p).toMatchObject({ strict: false, linter: null, formatter: null });
  });
});

describe('detectTechStack - partial languages and empty', () => {
  it('detects Java from pom.xml', async () => {
    await writeFile(join(dir, 'pom.xml'), '<project/>', 'utf-8');
    expect((await detectTechStack(dir)).language).toBe('Java');
  });

  it('detects Ruby from Gemfile', async () => {
    await writeFile(join(dir, 'Gemfile'), 'source "x"', 'utf-8');
    expect((await detectTechStack(dir)).language).toBe('Ruby');
  });

  it('detects PHP from composer.json', async () => {
    await writeFile(join(dir, 'composer.json'), '{}', 'utf-8');
    expect((await detectTechStack(dir)).language).toBe('PHP');
  });

  it('returns unknown for an empty directory', async () => {
    const t = await detectTechStack(dir);
    expect(t.language).toBe('unknown');
    expect(t.packageManager).toBe('unknown');
  });
});
