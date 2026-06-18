import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { detectTechStack } from '../src/analyzer/tech-stack.js';
import { detectCommands } from '../src/analyzer/commands.js';
import { detectCodePatterns } from '../src/analyzer/code-patterns.js';
import type { TechStack, ProjectCommands, CodePatterns } from '../src/types.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-mtx-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Write a set of files (relative path -> content) into the temp dir. */
async function scaffold(files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, 'utf-8');
  }
}

function pkg(deps: Record<string, string>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ devDependencies: deps, ...extra });
}

describe('tech-stack: every JS framework branch', () => {
  const cases: Array<[string, string]> = [
    ['next', 'Next.js'],
    ['@remix-run/node', 'Remix'],
    ['@nestjs/core', 'NestJS'],
    ['express', 'Express'],
    ['fastify', 'Fastify'],
    ['hono', 'Hono'],
    ['@sveltejs/kit', 'SvelteKit'],
    ['nuxt', 'Nuxt'],
    ['vue', 'Vue'],
    ['svelte', 'Svelte'],
    ['react', 'React'],
  ];
  it.each(cases)('detects %s -> %s', async (dep, framework) => {
    await scaffold({ 'package.json': pkg({ [dep]: '1' }) });
    expect((await detectTechStack(dir)).framework).toBe(framework);
  });

  it('framework precedence: next wins over react', async () => {
    await scaffold({ 'package.json': pkg({ next: '1', react: '1' }) });
    expect((await detectTechStack(dir)).framework).toBe('Next.js');
  });
});

describe('tech-stack: database branches', () => {
  const cases: Array<[string, string]> = [
    ['@prisma/client', 'Prisma ORM'],
    ['drizzle-orm', 'Drizzle ORM'],
    ['mongoose', 'MongoDB/Mongoose'],
    ['pg', 'PostgreSQL'],
    ['mysql2', 'MySQL'],
  ];
  it.each(cases)('detects %s -> %s', async (dep, db) => {
    await scaffold({ 'package.json': pkg({ [dep]: '1' }) });
    expect((await detectTechStack(dir)).database).toBe(db);
  });
});

describe('tech-stack: testing + buildTool + runtime + libs', () => {
  const testers: Array<[string, string]> = [
    ['vitest', 'Vitest'],
    ['jest', 'Jest'],
    ['@playwright/test', 'Playwright'],
    ['mocha', 'Mocha'],
  ];
  it.each(testers)('test runner %s -> %s', async (dep, t) => {
    await scaffold({ 'package.json': pkg({ [dep]: '1' }) });
    expect((await detectTechStack(dir)).testing).toBe(t);
  });

  const builders: Array<[string, string]> = [
    ['vite', 'Vite'],
    ['turbo', 'Turborepo'],
    ['esbuild', 'esbuild'],
    ['webpack', 'webpack'],
  ];
  it.each(builders)('build tool %s -> %s', async (dep, b) => {
    await scaffold({ 'package.json': pkg({ [dep]: '1' }) });
    expect((await detectTechStack(dir)).buildTool).toBe(b);
  });

  it('runtime Bun when bun dep present', async () => {
    await scaffold({ 'package.json': pkg({ bun: '1' }) });
    expect((await detectTechStack(dir)).runtime).toBe('Bun');
  });

  it('collects notable extra libraries', async () => {
    await scaffold({ 'package.json': pkg({ zod: '1', tailwindcss: '1', zustand: '1' }) });
    const libs = (await detectTechStack(dir)).extraLibraries;
    expect(libs).toEqual(expect.arrayContaining(['zod', 'tailwindcss', 'zustand']));
  });

  it('TypeScript via tsx or ts-node, not only typescript', async () => {
    await scaffold({ 'package.json': pkg({ tsx: '1' }) });
    expect((await detectTechStack(dir)).language).toBe('TypeScript');
  });
});

describe('tech-stack: Rust / Go / Python branches', () => {
  const rust: Array<[string, string | null, string]> = [
    ['[dependencies]\naxum="0.7"\ntokio="1"\n', 'Axum', 'Tokio (async)'],
    ['[dependencies]\nactix-web="4"\n', 'Actix Web', 'sync'],
    ['[dependencies]\nrocket="0.5"\n', 'Rocket', 'sync'],
    ['[dependencies]\nserde="1"\n', null, 'sync'],
  ];
  it.each(rust)('Cargo.toml %#', async (content, framework, runtime) => {
    await scaffold({ 'Cargo.toml': `[package]\nname="x"\n${content}` });
    const t = await detectTechStack(dir);
    expect(t.framework).toBe(framework);
    expect(t.runtime).toBe(runtime);
  });

  const go: Array<[string, string | null]> = [
    ['require github.com/gin-gonic/gin v1', 'Gin'],
    ['require github.com/gofiber/fiber/v2 v2', 'Fiber'],
    ['require github.com/labstack/echo/v4 v4', 'Echo'],
    ['require github.com/foo/bar v1', null],
  ];
  it.each(go)('go.mod %#', async (req, framework) => {
    await scaffold({ 'go.mod': `module x\n${req}\n` });
    expect((await detectTechStack(dir)).framework).toBe(framework);
  });

  const py: Array<[string, string | null, string]> = [
    ['fastapi', 'FastAPI', 'pip'],
    ['django', 'Django', 'pip'],
    ['flask', 'Flask', 'pip'],
  ];
  it.each(py)('pyproject framework %s', async (lib, framework, pm) => {
    await scaffold({ 'pyproject.toml': `[project]\ndependencies=["${lib}"]\n` });
    const t = await detectTechStack(dir);
    expect(t.framework).toBe(framework);
    expect(t.packageManager).toBe(pm);
  });

  it('pyproject poetry package manager', async () => {
    await scaffold({ 'pyproject.toml': '[tool.poetry]\nname="x"\n' });
    expect((await detectTechStack(dir)).packageManager).toBe('poetry');
  });

  it('requirements.txt -> Python/pip', async () => {
    await scaffold({ 'requirements.txt': 'flask\n' });
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Python', packageManager: 'pip' });
  });

  it('build.gradle -> Java/Kotlin/gradle', async () => {
    await scaffold({ 'build.gradle': 'plugins {}' });
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Java/Kotlin', packageManager: 'gradle' });
  });
});

describe('commands: package managers and ecosystems', () => {
  const pms: Array<[string, string, string]> = [
    ['package-lock.json', 'npm', 'npm install'],
    ['pnpm-lock.yaml', 'pnpm', 'pnpm install'],
    ['yarn.lock', 'yarn', 'yarn install'],
    ['bun.lockb', 'bun', 'bun install'],
  ];
  it.each(pms)('lockfile %s -> %s commands', async (lock, pm, install) => {
    await scaffold({
      'package.json': JSON.stringify({ scripts: { dev: 'x', test: 'x' } }),
      [lock]: '',
    });
    const c = await detectCommands(dir);
    expect(c.install).toBe(install);
    expect(c.dev).toBe(`${pm} run dev`);
  });

  it('dev falls back to start; fmt used when no format', async () => {
    await scaffold({
      'package.json': JSON.stringify({ scripts: { start: 'x', fmt: 'x' } }),
    });
    const c = await detectCommands(dir);
    expect(c.dev).toBe('npm run start');
    expect(c.format).toBe('npm run fmt');
  });

  it('pyproject with uv vs without', async () => {
    await scaffold({ 'pyproject.toml': '[project]\n', 'uv.lock': '' });
    expect((await detectCommands(dir)).install).toBe('uv sync');

    await rm(join(dir, 'uv.lock'));
    expect((await detectCommands(dir)).install).toBe('pip install -e ".[dev]"');
  });

  it('go.mod command set', async () => {
    await scaffold({ 'go.mod': 'module x\n' });
    const c = await detectCommands(dir);
    expect(c).toMatchObject({ build: 'go build ./...', test: 'go test ./...', lint: 'golangci-lint run' });
  });

  it('empty dir -> all null', async () => {
    const c = await detectCommands(dir);
    expect(c.install).toBeNull();
    expect(c.test).toBeNull();
  });
});

describe('code-patterns: linter and formatter variants', () => {
  it('Biome serves as both linter and formatter', async () => {
    await scaffold({ 'biome.json': '{}' });
    const p = await detectCodePatterns(dir);
    expect(p.linter).toBe('Biome');
    expect(p.formatter).toBe('Biome');
  });

  it('Ruff and golangci-lint', async () => {
    await scaffold({ 'ruff.toml': '' });
    expect((await detectCodePatterns(dir)).linter).toBe('Ruff');
    await rm(join(dir, 'ruff.toml'));
    await scaffold({ '.golangci.yml': '' });
    expect((await detectCodePatterns(dir)).linter).toBe('golangci-lint');
  });

  it('Prettier via package.json devDependency', async () => {
    await scaffold({ 'package.json': JSON.stringify({ devDependencies: { prettier: '3' } }) });
    expect((await detectCodePatterns(dir)).formatter).toBe('Prettier');
  });

  it('importStyle relative when tsconfig has no path aliases', async () => {
    await scaffold({ 'tsconfig.json': JSON.stringify({ compilerOptions: { strict: false } }) });
    const p = await detectCodePatterns(dir);
    expect(p.importStyle).toBe('relative');
    expect(p.strict).toBe(false);
  });

  it('commit convention via .czrc', async () => {
    await scaffold({ '.czrc': '{}' });
    expect((await detectCodePatterns(dir)).commitConvention).toBe('Conventional Commits');
  });
});

// keep imported types referenced for clarity
export type _Sig = [TechStack, ProjectCommands, CodePatterns];
