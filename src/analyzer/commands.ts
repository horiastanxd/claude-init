import { join } from 'node:path';
import { pathExists, readJson, detectPackageManager } from '../utils.js';
import type { ProjectCommands } from '../types.js';

const EMPTY: ProjectCommands = {
  install: null,
  dev: null,
  build: null,
  test: null,
  lint: null,
  format: null,
  extra: {},
};

const KNOWN_SCRIPTS = new Set([
  'dev',
  'start',
  'build',
  'test',
  'lint',
  'format',
  'fmt',
  'prepare',
  'postinstall',
  'prepublishonly',
]);

export async function detectCommands(projectDir: string): Promise<ProjectCommands> {
  if (await pathExists(join(projectDir, 'package.json'))) {
    return fromPackageJson(projectDir);
  }
  if (await pathExists(join(projectDir, 'Cargo.toml'))) {
    return {
      install: null,
      dev: 'cargo run',
      build: 'cargo build --release',
      test: 'cargo test',
      lint: 'cargo clippy',
      format: 'cargo fmt',
      extra: {},
    };
  }
  if (await pathExists(join(projectDir, 'pyproject.toml'))) {
    const hasUv = await pathExists(join(projectDir, 'uv.lock'));
    return {
      install: hasUv ? 'uv sync' : 'pip install -e ".[dev]"',
      dev: null,
      build: null,
      test: 'pytest',
      lint: 'ruff check .',
      format: 'ruff format .',
      extra: {},
    };
  }
  if (await pathExists(join(projectDir, 'go.mod'))) {
    return {
      install: 'go mod download',
      dev: 'go run .',
      build: 'go build ./...',
      test: 'go test ./...',
      lint: 'golangci-lint run',
      format: 'go fmt ./...',
      extra: {},
    };
  }
  return { ...EMPTY };
}

async function fromPackageJson(dir: string): Promise<ProjectCommands> {
  const pkg = await readJson<{ scripts?: Record<string, string> }>(join(dir, 'package.json'));
  const scripts = pkg?.scripts ?? {};
  const pm = await detectPackageManager(dir);
  const run = (script: string) => `${pm} run ${script}`;
  const has = (script: string) => typeof scripts[script] === 'string';

  const formatScript = has('format') ? 'format' : has('fmt') ? 'fmt' : null;

  const extra: Record<string, string> = {};
  for (const key of Object.keys(scripts)) {
    if (!KNOWN_SCRIPTS.has(key.toLowerCase())) extra[key] = run(key);
  }

  return {
    install: pm === 'npm' ? 'npm install' : `${pm} install`,
    dev: has('dev') ? run('dev') : has('start') ? run('start') : null,
    build: has('build') ? run('build') : null,
    test: has('test') ? run('test') : null,
    lint: has('lint') ? run('lint') : null,
    format: formatScript ? run(formatScript) : null,
    extra,
  };
}
