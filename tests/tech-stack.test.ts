import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectTechStack } from '../src/analyzer/tech-stack.js';
import { detectCommands } from '../src/analyzer/commands.js';
import { detectEnvVars } from '../src/analyzer/env-vars.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-ts-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  await writeFile(join(dir, rel), content, 'utf-8');
}

describe('detectTechStack', () => {
  it('detects TypeScript + Next.js + Prisma + pnpm', async () => {
    await write(
      'package.json',
      JSON.stringify({
        dependencies: { next: '14', react: '18', '@prisma/client': '5' },
        devDependencies: { typescript: '5', vitest: '2' },
      }),
    );
    await write('pnpm-lock.yaml', '');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({
      language: 'TypeScript',
      framework: 'Next.js',
      database: 'Prisma ORM',
      testing: 'Vitest',
      packageManager: 'pnpm',
    });
  });

  it('detects plain JavaScript when no typescript dep', async () => {
    await write('package.json', JSON.stringify({ dependencies: { express: '4' } }));
    const t = await detectTechStack(dir);
    expect(t.language).toBe('JavaScript');
    expect(t.framework).toBe('Express');
  });

  it('detects Python + FastAPI + uv', async () => {
    await write('pyproject.toml', '[project]\ndependencies=["fastapi"]\n[tool.uv]\n');
    await write('uv.lock', '');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Python', framework: 'FastAPI', packageManager: 'uv' });
  });

  it('detects Rust + Axum + Tokio', async () => {
    await write('Cargo.toml', '[package]\nname="x"\n[dependencies]\naxum="0.7"\ntokio="1"\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Rust', framework: 'Axum', packageManager: 'cargo' });
    expect(t.runtime).toContain('Tokio');
  });

  it('detects Go + Gin', async () => {
    await write('go.mod', 'module x\nrequire github.com/gin-gonic/gin v1.9.0\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Go', framework: 'Gin' });
  });
});

describe('detectCommands', () => {
  it('maps npm scripts through the detected package manager', async () => {
    await write(
      'package.json',
      JSON.stringify({ scripts: { dev: 'x', build: 'x', test: 'x', migrate: 'x' } }),
    );
    await write('yarn.lock', '');
    const c = await detectCommands(dir);
    expect(c.dev).toBe('yarn run dev');
    expect(c.test).toBe('yarn run test');
    expect(c.extra.migrate).toBe('yarn run migrate');
  });

  it('falls back to cargo commands for Rust', async () => {
    await write('Cargo.toml', '[package]\nname="x"\n');
    const c = await detectCommands(dir);
    expect(c.build).toBe('cargo build --release');
    expect(c.test).toBe('cargo test');
  });

  it('surfaces Makefile targets as extra commands', async () => {
    await write(
      'Makefile',
      '.PHONY: build test\n\nbuild:\n\tgcc -o app main.c\n\ntest:\n\t./run-tests.sh\n\ndeploy:\n\tscp app server:/\n',
    );
    const c = await detectCommands(dir);
    expect(c.extra.build).toBe('make build');
    expect(c.extra.test).toBe('make test');
    expect(c.extra.deploy).toBe('make deploy');
  });

  it('ignores Makefile variable assignments and pattern rules', async () => {
    await write('Makefile', 'CC := gcc\nCFLAGS = -O2\n\n%.o: %.c\n\t$(CC) -c $<\n\nall:\n\techo hi\n');
    const c = await detectCommands(dir);
    expect(Object.keys(c.extra)).toEqual(['all']);
  });

  it('surfaces justfile recipes as extra commands', async () => {
    await write(
      'justfile',
      'set shell := ["bash", "-c"]\n\nbuild:\n  cargo build\n\nlint args="":\n  cargo clippy {{args}}\n',
    );
    const c = await detectCommands(dir);
    expect(c.extra.build).toBe('just build');
    expect(c.extra.lint).toBe('just lint');
  });

  it('surfaces Taskfile tasks as extra commands', async () => {
    await write(
      'Taskfile.yml',
      'version: "3"\n\ntasks:\n  build:\n    cmds:\n      - go build\n  test:\n    cmds:\n      - go test ./...\n',
    );
    const c = await detectCommands(dir);
    expect(c.extra.build).toBe('task build');
    expect(c.extra.test).toBe('task test');
  });

  it('captures every target on a multi-target Makefile line', async () => {
    await write('Makefile', 'clean distclean:\n\trm -rf build\n');
    const c = await detectCommands(dir);
    expect(c.extra.clean).toBe('make clean');
    expect(c.extra.distclean).toBe('make distclean');
  });

  it('does not treat justfile recipe parameters as separate recipes', async () => {
    await write('justfile', 'build target:\n  echo {{target}}\n');
    const c = await detectCommands(dir);
    expect(c.extra.build).toBe('just build');
    expect(c.extra.target).toBeUndefined();
  });

  it('merges Makefile targets without duplicating filled standard commands', async () => {
    await write('package.json', JSON.stringify({ scripts: { test: 'vitest', build: 'tsc' } }));
    await write('Makefile', 'test:\n\t./integration.sh\n\nrelease:\n\tnpm publish\n');
    const c = await detectCommands(dir);
    expect(c.test).toBe('npm run test');
    expect(c.extra.test).toBeUndefined();
    expect(c.extra.release).toBe('make release');
  });
});

describe('detectEnvVars (real file)', () => {
  it('reads .env.example with comments and required flags', async () => {
    await write('.env.example', '# Postgres DSN\nDATABASE_URL=\nDEBUG=false\n');
    const vars = await detectEnvVars(dir);
    expect(vars).toHaveLength(2);
    expect(vars[0]).toMatchObject({ name: 'DATABASE_URL', required: true, description: 'Postgres DSN' });
    expect(vars[1]).toMatchObject({ name: 'DEBUG', required: false, example: 'false' });
  });
});
