import { join } from 'node:path';
import { pathExists, readText, readJson } from '../utils.js';
import type { CodePatterns } from '../types.js';

export async function detectCodePatterns(projectDir: string): Promise<CodePatterns> {
  const [tsconfig, linter, formatter, commitConvention] = await Promise.all([
    detectStrict(projectDir),
    detectLinter(projectDir),
    detectFormatter(projectDir),
    detectCommitConvention(projectDir),
  ]);

  return {
    strict: tsconfig.strict,
    linter,
    formatter,
    commitConvention,
    importStyle: tsconfig.importStyle,
  };
}

async function detectStrict(dir: string): Promise<{ strict: boolean; importStyle: string | null }> {
  const raw = await readText(join(dir, 'tsconfig.json'));
  if (raw === null) return { strict: false, importStyle: null };
  return {
    strict: /"strict"\s*:\s*true/.test(raw),
    importStyle: /"(baseUrl|paths)"\s*:/.test(raw) ? 'absolute (path aliases)' : 'relative',
  };
}

async function detectLinter(dir: string): Promise<string | null> {
  const eslint = [
    '.eslintrc',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
    'eslint.config.js',
    'eslint.config.mjs',
  ];
  for (const f of eslint) {
    if (await pathExists(join(dir, f))) return 'ESLint';
  }
  if (await pathExists(join(dir, 'biome.json'))) return 'Biome';
  if (await pathExists(join(dir, 'ruff.toml'))) return 'Ruff';
  if (await pathExists(join(dir, '.golangci.yml'))) return 'golangci-lint';
  return null;
}

async function detectFormatter(dir: string): Promise<string | null> {
  const prettier = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'];
  for (const f of prettier) {
    if (await pathExists(join(dir, f))) return 'Prettier';
  }
  if (await pathExists(join(dir, 'biome.json'))) return 'Biome';

  const pkg = await readJson<{ prettier?: unknown; devDependencies?: Record<string, string> }>(
    join(dir, 'package.json'),
  );
  if (pkg?.prettier) return 'Prettier';
  if (pkg?.devDependencies?.['prettier']) return 'Prettier';
  return null;
}

async function detectCommitConvention(dir: string): Promise<string | null> {
  const markers = ['commitlint.config.js', '.commitlintrc', '.commitlintrc.json', '.czrc'];
  for (const f of markers) {
    if (await pathExists(join(dir, f))) return 'Conventional Commits';
  }
  return null;
}
