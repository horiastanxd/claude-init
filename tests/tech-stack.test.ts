import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
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
  const full = join(dir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, 'utf-8');
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

  it('detects Astro', async () => {
    await write('package.json', JSON.stringify({ dependencies: { astro: '4', react: '18' } }));
    const t = await detectTechStack(dir);
    expect(t.framework).toBe('Astro');
  });

  it('detects Angular', async () => {
    await write('package.json', JSON.stringify({ dependencies: { '@angular/core': '17' } }));
    const t = await detectTechStack(dir);
    expect(t.framework).toBe('Angular');
  });

  it('detects Python framework and pytest from requirements.txt', async () => {
    await write('requirements.txt', 'django==5.0\npytest==8.0\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Python', framework: 'Django', testing: 'pytest', packageManager: 'pip' });
  });

  it('detects Ruby on Rails and RSpec from Gemfile', async () => {
    await write('Gemfile', 'source "https://rubygems.org"\ngem "rails", "~> 7.1"\ngem "rspec-rails"\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Ruby', framework: 'Rails', testing: 'RSpec' });
  });

  it('detects PHP Laravel and PHPUnit from composer.json', async () => {
    await write(
      'composer.json',
      JSON.stringify({ require: { 'laravel/framework': '^11.0' }, 'require-dev': { 'phpunit/phpunit': '^11.0' } }),
    );
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'PHP', framework: 'Laravel', testing: 'PHPUnit' });
  });

  it('detects Java Spring Boot from pom.xml', async () => {
    await write(
      'pom.xml',
      '<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>',
    );
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Java', framework: 'Spring Boot' });
  });

  it('detects SQLite', async () => {
    await write('package.json', JSON.stringify({ dependencies: { 'better-sqlite3': '11' } }));
    expect((await detectTechStack(dir)).database).toBe('SQLite');
  });

  it('detects Redis', async () => {
    await write('package.json', JSON.stringify({ dependencies: { ioredis: '5' } }));
    expect((await detectTechStack(dir)).database).toBe('Redis');
  });

  it('detects Supabase', async () => {
    await write('package.json', JSON.stringify({ dependencies: { '@supabase/supabase-js': '2' } }));
    expect((await detectTechStack(dir)).database).toBe('Supabase');
  });

  it('detects Nx as the monorepo build tool', async () => {
    await write('package.json', JSON.stringify({ devDependencies: { nx: '19' } }));
    expect((await detectTechStack(dir)).buildTool).toBe('Nx');
  });

  it('detects Lerna as the monorepo build tool', async () => {
    await write('package.json', JSON.stringify({ devDependencies: { lerna: '8' } }));
    expect((await detectTechStack(dir)).buildTool).toBe('Lerna');
  });

  it('detects GitHub Actions as the CI provider', async () => {
    await write('package.json', JSON.stringify({ dependencies: {} }));
    await write('.github/workflows/ci.yml', 'name: CI\non: [push]\n');
    expect((await detectTechStack(dir)).ci).toBe('GitHub Actions');
  });

  it('detects GitLab CI as the CI provider', async () => {
    await write('package.json', JSON.stringify({ dependencies: {} }));
    await write('.gitlab-ci.yml', 'stages: [test]\n');
    expect((await detectTechStack(dir)).ci).toBe('GitLab CI');
  });

  it('detects CircleCI as the CI provider', async () => {
    await write('package.json', JSON.stringify({ dependencies: {} }));
    await write('.circleci/config.yml', 'version: 2.1\n');
    expect((await detectTechStack(dir)).ci).toBe('CircleCI');
  });

  it('detects Deno from deno.json', async () => {
    await write('deno.json', JSON.stringify({ tasks: { dev: 'deno run main.ts' } }));
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'TypeScript', runtime: 'Deno', packageManager: 'deno' });
  });

  it('detects Deno Fresh framework', async () => {
    await write('deno.jsonc', JSON.stringify({ imports: { '$fresh/': 'https://deno.land/x/fresh@1.6.8/' } }));
    expect((await detectTechStack(dir)).framework).toBe('Fresh');
  });

  it('detects C# / .NET from a .csproj file', async () => {
    await write('App.csproj', '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'C#', runtime: '.NET', packageManager: 'NuGet' });
  });

  it('detects ASP.NET Core from a web SDK csproj', async () => {
    await write('Web.csproj', '<Project Sdk="Microsoft.NET.Sdk.Web"><ItemGroup><PackageReference Include="Microsoft.AspNetCore.App" /></ItemGroup></Project>');
    expect((await detectTechStack(dir)).framework).toBe('ASP.NET Core');
  });

  it('detects xUnit testing from a csproj', async () => {
    await write('Tests.csproj', '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><PackageReference Include="xunit" Version="2.7.0" /></ItemGroup></Project>');
    expect((await detectTechStack(dir)).testing).toBe('xUnit');
  });

  it('detects Elixir from mix.exs', async () => {
    await write('mix.exs', 'defmodule App.MixProject do\n  use Mix.Project\nend\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Elixir', packageManager: 'mix' });
  });

  it('detects Phoenix from mix.exs', async () => {
    await write('mix.exs', 'defp deps do\n  [{:phoenix, "~> 1.7"}]\nend\n');
    expect((await detectTechStack(dir)).framework).toBe('Phoenix');
  });

  it('detects Kotlin from build.gradle.kts', async () => {
    await write('build.gradle.kts', 'plugins {\n  kotlin("jvm") version "1.9.0"\n}\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Kotlin', packageManager: 'gradle' });
  });

  it('detects Android from build.gradle.kts', async () => {
    await write('build.gradle.kts', 'plugins {\n  id("com.android.application")\n}\n');
    expect((await detectTechStack(dir)).framework).toBe('Android');
  });

  it('detects Dart from pubspec.yaml', async () => {
    await write('pubspec.yaml', 'name: my_app\nenvironment:\n  sdk: ">=3.0.0 <4.0.0"\n');
    const t = await detectTechStack(dir);
    expect(t).toMatchObject({ language: 'Dart', packageManager: 'pub' });
  });

  it('detects Flutter from pubspec.yaml', async () => {
    await write('pubspec.yaml', 'name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\n');
    expect((await detectTechStack(dir)).framework).toBe('Flutter');
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

  it('detects Maven commands from pom.xml', async () => {
    await write('pom.xml', '<project></project>');
    const c = await detectCommands(dir);
    expect(c.build).toBe('mvn package');
    expect(c.test).toBe('mvn test');
  });

  it('detects Gradle commands from build.gradle', async () => {
    await write('build.gradle', 'plugins {}');
    const c = await detectCommands(dir);
    expect(c.build).toBe('./gradlew build');
    expect(c.test).toBe('./gradlew test');
  });

  it('detects Ruby commands from Gemfile', async () => {
    await write('Gemfile', 'source "https://rubygems.org"');
    const c = await detectCommands(dir);
    expect(c.install).toBe('bundle install');
    expect(c.test).toBe('bundle exec rake');
  });

  it('detects Deno commands from deno.json', async () => {
    await write('deno.json', JSON.stringify({ tasks: {} }));
    const c = await detectCommands(dir);
    expect(c.test).toBe('deno test');
    expect(c.lint).toBe('deno lint');
    expect(c.format).toBe('deno fmt');
  });

  it('detects .NET commands from a csproj', async () => {
    await write('App.csproj', '<Project Sdk="Microsoft.NET.Sdk"></Project>');
    const c = await detectCommands(dir);
    expect(c.install).toBe('dotnet restore');
    expect(c.build).toBe('dotnet build');
    expect(c.test).toBe('dotnet test');
  });

  it('detects Elixir commands from mix.exs', async () => {
    await write('mix.exs', 'defmodule App.MixProject do\nend\n');
    const c = await detectCommands(dir);
    expect(c.install).toBe('mix deps.get');
    expect(c.test).toBe('mix test');
  });

  it('detects Flutter commands from pubspec.yaml', async () => {
    await write('pubspec.yaml', 'name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\n');
    const c = await detectCommands(dir);
    expect(c.install).toBe('flutter pub get');
    expect(c.test).toBe('flutter test');
  });

  it('detects PHP commands and scripts from composer.json', async () => {
    await write('composer.json', JSON.stringify({ scripts: { test: 'phpunit', lint: 'phpcs', analyze: 'phpstan' } }));
    const c = await detectCommands(dir);
    expect(c.install).toBe('composer install');
    expect(c.test).toBe('composer test');
    expect(c.lint).toBe('composer lint');
    expect(c.extra.analyze).toBe('composer analyze');
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

  it('surfaces recognised commands from GitHub Actions workflows', async () => {
    await write(
      '.github/workflows/ci.yml',
      'name: CI\non: [push]\njobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - name: checks\n        run: |\n          npm run lint\n          cargo audit\n      - run: pytest -q\n',
    );
    const c = await detectCommands(dir);
    const vals = Object.values(c.extra);
    expect(vals).toContain('npm run lint');
    expect(vals).toContain('cargo audit');
    expect(vals).toContain('pytest -q');
    expect(vals).not.toContain('npm ci');
    expect(vals).not.toContain('actions/checkout@v4');
  });

  it('keeps CI script commands whose names contain install-like words', async () => {
    await write(
      '.github/workflows/ci.yml',
      'jobs:\n  x:\n    steps:\n      - run: pnpm run test:ci\n      - run: npm run typecheck\n',
    );
    const c = await detectCommands(dir);
    const vals = Object.values(c.extra);
    expect(vals).toContain('pnpm run test:ci');
    expect(vals).toContain('npm run typecheck');
  });

  it('does not duplicate CI commands already covered by package.json', async () => {
    await write('package.json', JSON.stringify({ scripts: { build: 'tsc', test: 'vitest' } }));
    await write(
      '.github/workflows/ci.yml',
      'jobs:\n  b:\n    steps:\n      - run: npm run build\n      - run: npm run test\n      - run: npm run release\n',
    );
    const c = await detectCommands(dir);
    const vals = Object.values(c.extra);
    expect(vals).not.toContain('npm run build');
    expect(vals).not.toContain('npm run test');
    expect(vals).toContain('npm run release');
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
