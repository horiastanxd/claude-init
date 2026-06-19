import { describe, it, expect } from 'vitest';
import { renderFull, renderRules } from '../src/generators/render.js';
import type { ProjectAnalysis } from '../src/types.js';

const empty: ProjectAnalysis = {
  name: 'bare',
  description: '',
  techStack: {
    language: 'unknown',
    framework: null,
    runtime: null,
    packageManager: 'unknown',
    database: null,
    testing: null,
    buildTool: null,
    extraLibraries: [],
  },
  structure: { tree: '', entryPoints: [], configFiles: [], srcDir: null, testDir: null },
  commands: { install: null, dev: null, build: null, test: null, lint: null, format: null, extra: {} },
  tests: { framework: null, command: null, coverage: false, testDir: null },
  envVars: [],
  codePatterns: { strict: false, linter: null, formatter: null, commitConvention: null, importStyle: null },
  gitInfo: { hasGit: false, remoteName: null, defaultBranch: null, topAuthors: [], hotFiles: [] },
};

describe('render edge cases', () => {
  it('renderFull does not crash on an empty analysis', () => {
    const md = renderFull(empty, { title: 'bare' });
    expect(md).toContain('# bare');
    // language is always present in the stack section
    expect(md).toContain('Language: unknown');
  });

  it('renderFull never emits an empty "## " heading or triple newlines', () => {
    const md = renderFull(empty, { title: 'bare' });
    expect(md).not.toMatch(/^##\s*$/m);
    expect(md).not.toMatch(/\n{3,}/);
  });

  it('renderFull adds an intro line when provided', () => {
    const md = renderFull(empty, { title: 'AGENTS.md', intro: 'Hello agents.' });
    expect(md.indexOf('Hello agents.')).toBeGreaterThan(md.indexOf('# AGENTS.md'));
  });

  it('renderRules works with no commands and no env', () => {
    const rules = renderRules(empty, { title: 'bare' });
    expect(rules).toContain('# bare');
    expect(rules).not.toContain('## Commands');
    expect(rules).not.toContain('## Environment');
  });

  it('renders runner-only commands (extra) when no standard commands exist', () => {
    const a: ProjectAnalysis = {
      ...empty,
      commands: { ...empty.commands, extra: { build: 'make build', deploy: 'make deploy' } },
    };
    const md = renderFull(a, { title: 'bare' });
    expect(md).toContain('## Commands');
    expect(md).toContain('Other scripts:');
    expect(md).toContain('`make build`');
    expect(md).toContain('`make deploy`');
  });

  it('output always ends with a single trailing newline', () => {
    expect(renderRules(empty, { title: 'x' }).endsWith('\n')).toBe(true);
    expect(renderRules(empty, { title: 'x' }).endsWith('\n\n')).toBe(false);
  });
});
