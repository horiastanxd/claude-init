import { join } from 'node:path';
import { pathExists, readJson, readText, detectPackageManager } from '../utils.js';
import type { TechStack } from '../types.js';

const EMPTY: TechStack = {
  language: 'unknown',
  framework: null,
  runtime: null,
  packageManager: 'unknown',
  database: null,
  testing: null,
  buildTool: null,
  extraLibraries: [],
};

export async function detectTechStack(projectDir: string): Promise<TechStack> {
  const manifest: Array<[string, (dir: string) => Promise<Partial<TechStack>>]> = [
    ['package.json', parsePackageJson],
    ['Cargo.toml', parseCargoToml],
    ['go.mod', parseGoMod],
    ['pyproject.toml', parsePyproject],
    ['requirements.txt', parseRequirementsTxt],
    ['pom.xml', parsePomXml],
    ['build.gradle', parseGradle],
    ['Gemfile', parseGemfile],
    ['composer.json', parseComposerJson],
  ];

  for (const [file, parser] of manifest) {
    if (await pathExists(join(projectDir, file))) {
      return { ...EMPTY, ...(await parser(projectDir)) };
    }
  }

  return { ...EMPTY };
}

async function parsePackageJson(dir: string): Promise<Partial<TechStack>> {
  const pkg = await readJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(join(dir, 'package.json'));
  if (!pkg) return {};

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (name: string) => name in deps;

  const result: Partial<TechStack> = {
    language: has('typescript') || has('ts-node') || has('tsx') ? 'TypeScript' : 'JavaScript',
    packageManager: await detectPackageManager(dir),
    runtime: has('bun') ? 'Bun' : 'Node.js',
  };

  if (has('next')) result.framework = 'Next.js';
  else if (has('@remix-run/node') || has('@remix-run/react')) result.framework = 'Remix';
  else if (has('astro')) result.framework = 'Astro';
  else if (has('@angular/core')) result.framework = 'Angular';
  else if (has('gatsby')) result.framework = 'Gatsby';
  else if (has('@nestjs/core')) result.framework = 'NestJS';
  else if (has('express')) result.framework = 'Express';
  else if (has('fastify')) result.framework = 'Fastify';
  else if (has('hono')) result.framework = 'Hono';
  else if (has('@sveltejs/kit')) result.framework = 'SvelteKit';
  else if (has('nuxt')) result.framework = 'Nuxt';
  else if (has('vue')) result.framework = 'Vue';
  else if (has('svelte')) result.framework = 'Svelte';
  else if (has('react')) result.framework = 'React';

  if (has('@prisma/client') || has('prisma')) result.database = 'Prisma ORM';
  else if (has('drizzle-orm')) result.database = 'Drizzle ORM';
  else if (has('mongoose')) result.database = 'MongoDB/Mongoose';
  else if (has('pg') || has('postgres')) result.database = 'PostgreSQL';
  else if (has('mysql2')) result.database = 'MySQL';

  if (has('vitest')) result.testing = 'Vitest';
  else if (has('jest')) result.testing = 'Jest';
  else if (has('@playwright/test')) result.testing = 'Playwright';
  else if (has('mocha')) result.testing = 'Mocha';

  if (has('vite')) result.buildTool = 'Vite';
  else if (has('turbo')) result.buildTool = 'Turborepo';
  else if (has('esbuild')) result.buildTool = 'esbuild';
  else if (has('webpack')) result.buildTool = 'webpack';

  const notable = ['zod', 'tailwindcss', 'trpc', '@tanstack/react-query', 'redux', 'zustand', 'graphql'];
  result.extraLibraries = notable.filter(has);

  return result;
}

async function parseCargoToml(dir: string): Promise<Partial<TechStack>> {
  const content = (await readText(join(dir, 'Cargo.toml'))) ?? '';
  return {
    language: 'Rust',
    packageManager: 'cargo',
    runtime: content.includes('tokio') ? 'Tokio (async)' : 'sync',
    framework: content.includes('axum')
      ? 'Axum'
      : content.includes('actix-web')
        ? 'Actix Web'
        : content.includes('rocket')
          ? 'Rocket'
          : null,
  };
}

async function parseGoMod(dir: string): Promise<Partial<TechStack>> {
  const content = (await readText(join(dir, 'go.mod'))) ?? '';
  return {
    language: 'Go',
    packageManager: 'go modules',
    framework: content.includes('gin-gonic/gin')
      ? 'Gin'
      : content.includes('gofiber/fiber')
        ? 'Fiber'
        : content.includes('labstack/echo')
          ? 'Echo'
          : null,
  };
}

async function parsePyproject(dir: string): Promise<Partial<TechStack>> {
  const content = (await readText(join(dir, 'pyproject.toml'))) ?? '';
  const hasUv = content.includes('[tool.uv]') || (await pathExists(join(dir, 'uv.lock')));
  const hasPoetry = content.includes('[tool.poetry]');
  return {
    language: 'Python',
    packageManager: hasUv ? 'uv' : hasPoetry ? 'poetry' : 'pip',
    framework: pythonFramework(content),
    testing: content.includes('pytest') ? 'pytest' : null,
  };
}

async function parseRequirementsTxt(dir: string): Promise<Partial<TechStack>> {
  const content = ((await readText(join(dir, 'requirements.txt'))) ?? '').toLowerCase();
  return {
    language: 'Python',
    packageManager: 'pip',
    framework: pythonFramework(content),
    testing: content.includes('pytest') ? 'pytest' : null,
  };
}

function pythonFramework(content: string): string | null {
  const c = content.toLowerCase();
  if (c.includes('fastapi')) return 'FastAPI';
  if (c.includes('django')) return 'Django';
  if (c.includes('flask')) return 'Flask';
  return null;
}

async function parsePomXml(dir: string): Promise<Partial<TechStack>> {
  const content = (await readText(join(dir, 'pom.xml'))) ?? '';
  return {
    language: 'Java',
    packageManager: 'maven',
    framework: content.includes('spring-boot') ? 'Spring Boot' : null,
  };
}

async function parseGradle(dir: string): Promise<Partial<TechStack>> {
  const content = (await readText(join(dir, 'build.gradle'))) ?? '';
  return {
    language: 'Java/Kotlin',
    packageManager: 'gradle',
    framework: content.includes('spring-boot') ? 'Spring Boot' : null,
  };
}

async function parseGemfile(dir: string): Promise<Partial<TechStack>> {
  const content = ((await readText(join(dir, 'Gemfile'))) ?? '').toLowerCase();
  return {
    language: 'Ruby',
    packageManager: 'bundler',
    framework: content.includes('rails')
      ? 'Rails'
      : content.includes('sinatra')
        ? 'Sinatra'
        : null,
    testing: content.includes('rspec') ? 'RSpec' : content.includes('minitest') ? 'Minitest' : null,
  };
}

async function parseComposerJson(dir: string): Promise<Partial<TechStack>> {
  const pkg = await readJson<{
    require?: Record<string, string>;
    'require-dev'?: Record<string, string>;
  }>(join(dir, 'composer.json'));
  const deps = { ...pkg?.require, ...pkg?.['require-dev'] };
  const has = (name: string) => name in deps;
  const hasPrefix = (prefix: string) => Object.keys(deps).some((k) => k.startsWith(prefix));
  return {
    language: 'PHP',
    packageManager: 'composer',
    framework: has('laravel/framework')
      ? 'Laravel'
      : hasPrefix('symfony/')
        ? 'Symfony'
        : null,
    testing: has('phpunit/phpunit') ? 'PHPUnit' : has('pestphp/pest') ? 'Pest' : null,
  };
}
