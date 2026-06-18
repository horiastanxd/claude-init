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
    ['requirements.txt', async () => ({ language: 'Python', packageManager: 'pip' })],
    ['pom.xml', async () => ({ language: 'Java', packageManager: 'maven' })],
    ['build.gradle', async () => ({ language: 'Java/Kotlin', packageManager: 'gradle' })],
    ['Gemfile', async () => ({ language: 'Ruby', packageManager: 'bundler' })],
    ['composer.json', async () => ({ language: 'PHP', packageManager: 'composer' })],
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
    framework: content.includes('fastapi')
      ? 'FastAPI'
      : content.includes('django')
        ? 'Django'
        : content.includes('flask')
          ? 'Flask'
          : null,
    testing: content.includes('pytest') ? 'pytest' : null,
  };
}
