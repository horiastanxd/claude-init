import { join } from 'node:path';
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
  return mergeRunnerCommands(base, runners);
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
