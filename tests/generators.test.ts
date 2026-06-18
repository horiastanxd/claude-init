import { describe, it, expect } from 'vitest';
import { generateClaudeMd } from '../src/generators/claude-md.js';
import { generateCursorRules } from '../src/generators/cursor-rules.js';
import { generateAgentsMd } from '../src/generators/agents-md.js';
import { buildFiles } from '../src/generators/index.js';
import type { ProjectAnalysis } from '../src/types.js';

const sample: ProjectAnalysis = {
  name: 'demo-app',
  description: 'A demo application.',
  techStack: {
    language: 'TypeScript',
    framework: 'Next.js',
    runtime: 'Node.js',
    packageManager: 'pnpm',
    database: 'Prisma ORM',
    testing: 'Vitest',
    buildTool: 'Vite',
    extraLibraries: ['zod', 'zustand'],
  },
  structure: {
    tree: 'src/\n  index.ts',
    entryPoints: ['src/index.ts'],
    configFiles: ['tsconfig.json'],
    srcDir: 'src',
    testDir: 'tests',
  },
  commands: {
    install: 'pnpm install',
    dev: 'pnpm run dev',
    build: 'pnpm run build',
    test: 'pnpm run test',
    lint: 'pnpm run lint',
    format: null,
    extra: { migrate: 'pnpm run migrate' },
  },
  tests: { framework: 'Vitest', command: 'pnpm run test', coverage: false, testDir: 'tests' },
  envVars: [{ name: 'DATABASE_URL', description: 'Postgres connection string', required: true, example: null }],
  codePatterns: {
    strict: true,
    linter: 'ESLint',
    formatter: 'Prettier',
    commitConvention: null,
    importStyle: 'absolute (path aliases)',
  },
  gitInfo: { hasGit: true, remoteName: 'origin', defaultBranch: 'main', topAuthors: ['Ada'], hotFiles: [] },
};

describe('generateClaudeMd', () => {
  it('includes name, stack, commands and env vars', () => {
    const md = generateClaudeMd(sample);
    expect(md).toContain('# demo-app');
    expect(md).toContain('Framework: Next.js');
    expect(md).toContain('pnpm run dev');
    expect(md).toContain('DATABASE_URL');
    expect(md).toContain('pnpm run migrate');
  });

  it('does not leave empty sections', () => {
    const md = generateClaudeMd(sample);
    expect(md).not.toMatch(/##[^\n]*\n\n##/);
  });
});

describe('generateCursorRules', () => {
  it('mentions the language and framework', () => {
    const rules = generateCursorRules(sample);
    expect(rules).toContain('TypeScript');
    expect(rules).toContain('Next.js');
    expect(rules).toContain('pnpm run test');
  });
});

describe('generateAgentsMd', () => {
  it('uses the AGENTS.md heading', () => {
    expect(generateAgentsMd(sample)).toContain('# AGENTS.md');
  });
});

describe('buildFiles', () => {
  it('produces the core targets with correct paths', () => {
    const files = buildFiles(sample);
    const paths = files.map((f) => f.relPath);
    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('GEMINI.md');
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('WARP.md');
    expect(paths).toContain('CONVENTIONS.md');
    expect(paths.some((p) => p.includes('cursor') && p.endsWith('.mdc'))).toBe(true);
    expect(paths.some((p) => p.endsWith('copilot-instructions.md'))).toBe(true);
    expect(paths.some((p) => p.includes('windsurf'))).toBe(true);
    expect(paths.some((p) => p.includes('clinerules'))).toBe(true);
  });

  it('filters by requested targets', () => {
    const files = buildFiles(sample, ['claude', 'gemini']);
    expect(files.map((f) => f.relPath).sort()).toEqual(['CLAUDE.md', 'GEMINI.md']);
  });

  it('wraps Cursor output in .mdc frontmatter', () => {
    const cursor = buildFiles(sample, ['cursor'])[0];
    expect(cursor?.content.startsWith('---\n')).toBe(true);
    expect(cursor?.content).toContain('alwaysApply: true');
  });
});
