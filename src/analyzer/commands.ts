import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { pathExists, readJson, readText, detectPackageManager } from '../utils.js';
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

/** Standard command slots, used to avoid duplicating them in `extra`. */
const STANDARD_SLOTS = ['install', 'dev', 'build', 'test', 'lint', 'format'] as const;

export async function detectCommands(projectDir: string): Promise<ProjectCommands> {
  const base = await detectBaseCommands(projectDir);
  const runners = await detectRunnerCommands(projectDir);
  const merged = mergeRunnerCommands(base, runners);
  const ci = await detectCiCommands(projectDir);
  return mergeCiCommands(merged, ci);
}

/** Language-toolchain commands derived from the manifest (package.json, Cargo, ...). */
async function detectBaseCommands(projectDir: string): Promise<ProjectCommands> {
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
  if (await pathExists(join(projectDir, 'pom.xml'))) {
    return {
      install: null,
      dev: null,
      build: 'mvn package',
      test: 'mvn test',
      lint: null,
      format: null,
      extra: {},
    };
  }
  if (
    (await pathExists(join(projectDir, 'build.gradle'))) ||
    (await pathExists(join(projectDir, 'build.gradle.kts')))
  ) {
    return {
      install: null,
      dev: null,
      build: './gradlew build',
      test: './gradlew test',
      lint: null,
      format: null,
      extra: {},
    };
  }
  if (await pathExists(join(projectDir, 'Gemfile'))) {
    return {
      install: 'bundle install',
      dev: null,
      build: null,
      test: 'bundle exec rake',
      lint: null,
      format: null,
      extra: {},
    };
  }
  if (await pathExists(join(projectDir, 'composer.json'))) {
    return fromComposerJson(projectDir);
  }
  return { ...EMPTY };
}

async function fromComposerJson(dir: string): Promise<ProjectCommands> {
  const pkg = await readJson<{ scripts?: Record<string, unknown> }>(join(dir, 'composer.json'));
  const scripts = pkg?.scripts ?? {};
  const has = (script: string) => script in scripts;
  const known = new Set(['test', 'lint']);

  const extra: Record<string, string> = {};
  for (const key of Object.keys(scripts)) {
    if (!known.has(key)) extra[key] = `composer ${key}`;
  }

  return {
    install: 'composer install',
    dev: null,
    build: null,
    test: has('test') ? 'composer test' : null,
    lint: has('lint') ? 'composer lint' : null,
    format: null,
    extra,
  };
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

const MAKEFILES = ['Makefile', 'makefile', 'GNUmakefile'];
const JUSTFILES = ['justfile', '.justfile', 'Justfile'];
const TASKFILES = ['Taskfile.yml', 'Taskfile.yaml', 'taskfile.yml', 'taskfile.yaml'];

/**
 * Project-specific commands from task runners (Makefile, justfile, Taskfile).
 * These are where repo-specific build/run steps tend to hide when they are not
 * expressed as npm scripts. Returns target name -> runner command, first source wins.
 */
async function detectRunnerCommands(projectDir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const add = (name: string, cmd: string) => {
    if (!(name in out)) out[name] = cmd;
  };

  for (const name of await readTargets(projectDir, MAKEFILES, (c) => parseRecipeTargets(c, true))) {
    add(name, `make ${name}`);
  }
  for (const name of await readTargets(projectDir, JUSTFILES, (c) => parseRecipeTargets(c, false))) {
    add(name, `just ${name}`);
  }
  for (const name of await readTargets(projectDir, TASKFILES, parseTaskfileTargets)) {
    add(name, `task ${name}`);
  }
  return out;
}

async function readTargets(
  projectDir: string,
  filenames: string[],
  parse: (content: string) => string[],
): Promise<string[]> {
  for (const file of filenames) {
    const content = await readText(join(projectDir, file));
    if (content !== null) return parse(content);
  }
  return [];
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * Targets/recipes for Makefile and justfile. Both put `name...: deps` at column 0.
 * Excludes recipe bodies (indented), pattern rules (`%.o:`), dotted directives
 * (`.PHONY`) and variable assignments (`VAR := value`, `VAR = value`).
 *
 * Make allows several targets on one line (`clean distclean:`), so with
 * `splitMulti` every identifier left of the colon is a target. just instead puts
 * the recipe name followed by parameters (`build target:`), so only the first
 * token is the recipe and the rest must be ignored to avoid inventing recipes.
 */
function parseRecipeTargets(content: string, splitMulti: boolean): string[] {
  const names: string[] = [];
  const re = /^([A-Za-z_][^:\n]*):(?!=)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const head = m[1]!.trim().split(/\s+/);
    const tokens = splitMulti ? head : head.slice(0, 1);
    for (const tok of tokens) {
      if (IDENTIFIER.test(tok) && !names.includes(tok)) names.push(tok);
    }
  }
  return names;
}

/** Top-level keys under the `tasks:` map of a Taskfile (minimal indentation parse). */
function parseTaskfileTargets(content: string): string[] {
  const names: string[] = [];
  let inTasks = false;
  for (const line of content.split('\n')) {
    if (/^tasks:\s*$/.test(line)) {
      inTasks = true;
      continue;
    }
    if (!inTasks) continue;
    if (/^\S/.test(line)) break; // a new top-level key ends the tasks block
    const name = /^ {2}([A-Za-z][A-Za-z0-9_-]*):/.exec(line)?.[1];
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Add runner commands to `extra`, skipping names already covered by a standard slot. */
function mergeRunnerCommands(
  base: ProjectCommands,
  runners: Record<string, string>,
): ProjectCommands {
  const filled = new Set<string>(STANDARD_SLOTS.filter((slot) => base[slot] !== null));
  const extra = { ...base.extra };
  for (const [name, cmd] of Object.entries(runners)) {
    if (name in extra || filled.has(name)) continue;
    extra[name] = cmd;
  }
  return { ...base, extra };
}

/** Tools whose invocation in a CI `run:` step counts as a project command worth surfacing. */
const CI_RUNNERS = new Set([
  'npm', 'pnpm', 'yarn', 'bun', 'npx', 'pnpx', 'make', 'just', 'task', 'cargo', 'go',
  'python', 'python3', 'pytest', 'ruff', 'mypy', 'tox', 'poetry', 'uv', 'uvx', 'node',
  'deno', 'gradle', './gradlew', 'gradlew', 'mvn', './mvnw', 'dotnet', 'rake', 'bundle',
  'composer', 'php', 'rails', 'mix', 'gleam', 'swift', 'flutter', 'dart', 'docker',
  'docker-compose', 'terraform', 'tsc', 'eslint', 'prettier', 'vitest', 'jest',
  'playwright', 'cypress',
]);

// Dependency-install invocations - already covered by the install slot, not worth listing.
// The install keyword must be the subcommand right after the tool (so `pnpm run test:ci`
// is kept, only `pnpm install` / `npm ci` are dropped).
const CI_INSTALL = /^(npm|pnpm|yarn|bun|pip|pip3|poetry|uv|bundle|gem|composer)\s+(install|ci|sync|i)\b/;
const CI_GO_INSTALL = /^go\s+(get|mod\s+download)\b/;
const CI_BARE_INSTALL = /^(yarn|bun)$/;

/** Normalise one shell command from a CI step; null if it is noise or an install. */
function cleanCiCommand(raw: string): string | null {
  let cmd = raw.trim();
  if (cmd.startsWith('sudo ')) cmd = cmd.slice(5).trim();
  cmd = cmd.replace(/^["']|["']$/g, '').trim();
  if (!cmd) return null;
  const first = cmd.split(/\s+/)[0];
  if (!first || !CI_RUNNERS.has(first)) return null;
  if (CI_INSTALL.test(cmd) || CI_GO_INSTALL.test(cmd) || CI_BARE_INSTALL.test(cmd)) return null;
  return cmd;
}

/**
 * Pull recognised commands out of a GitHub Actions workflow. Handles both inline
 * (`run: npm test`) and block-scalar (`run: |`) steps, splitting on `&&` / `;`.
 * CI config is often the real source of truth for how a project builds and ships.
 */
function parseWorkflowCommands(content: string): string[] {
  const out: string[] = [];
  const lines = content.split('\n');
  const push = (raw: string) => {
    for (const part of raw.split(/&&|;/)) {
      const c = cleanCiCommand(part);
      if (c && !out.includes(c)) out.push(c);
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const idx = line.indexOf('run:');
    if (idx < 0 || !/^[\s-]*$/.test(line.slice(0, idx))) continue;
    const value = line.slice(idx + 4).trim();
    if (value === '' || /^[|>][+-]?$/.test(value)) {
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]!;
        if (l.trim() === '') continue;
        if (l.length - l.trimStart().length <= idx) break;
        push(l.trim());
      }
    } else {
      push(value);
    }
  }
  return out;
}

async function detectCiCommands(projectDir: string): Promise<string[]> {
  const dir = join(projectDir, '.github', 'workflows');
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const file of files.sort()) {
    if (!/\.ya?ml$/i.test(file)) continue;
    const content = await readText(join(dir, file));
    if (content === null) continue;
    for (const cmd of parseWorkflowCommands(content)) {
      if (!out.includes(cmd)) out.push(cmd);
    }
  }
  return out;
}

/** Add CI commands to `extra`, skipping any command string already surfaced elsewhere. */
function mergeCiCommands(cmds: ProjectCommands, ci: string[]): ProjectCommands {
  const known = new Set<string>([
    ...STANDARD_SLOTS.map((slot) => cmds[slot]).filter((v): v is string => v !== null),
    ...Object.values(cmds.extra),
  ]);
  const extra = { ...cmds.extra };
  for (const cmd of ci) {
    if (known.has(cmd) || cmd in extra) continue;
    extra[cmd] = cmd;
    known.add(cmd);
  }
  return { ...cmds, extra };
}
