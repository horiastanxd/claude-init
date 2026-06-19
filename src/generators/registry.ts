import { join } from 'node:path';
import type { ProjectAnalysis } from '../types.js';
import { renderFull, renderRules, withCursorFrontmatter } from './render.js';

export interface Target {
  /** CLI id, e.g. "claude". */
  id: string;
  /** Human label, e.g. "Claude Code". */
  label: string;
  /** Which tools read the produced file(s). */
  tools: string;
  /** One file per output (most targets have exactly one). */
  files: Array<{
    /** Path relative to the output directory. Uses POSIX separators in docs. */
    path: string;
    render: (a: ProjectAnalysis) => string;
  }>;
}

export const TARGETS: Target[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    tools: 'Claude Code',
    files: [{ path: 'CLAUDE.md', render: (a) => renderFull(a, { title: a.name }) }],
  },
  {
    id: 'agents',
    label: 'AGENTS.md (open standard)',
    tools: 'OpenAI Codex, Jules, Amp, Zed, Devin, RooCode, Factory, and 20+ agents',
    files: [
      {
        path: 'AGENTS.md',
        render: (a) =>
          renderFull(a, {
            title: 'AGENTS.md',
            intro: `Instructions for AI coding agents working in **${a.name}**.`,
          }),
      },
    ],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    tools: 'Cursor (modern .mdc project rules)',
    files: [
      {
        path: join('.cursor', 'rules', 'project.mdc'),
        render: (a) => withCursorFrontmatter(renderRules(a, { title: a.name }), a.name),
      },
    ],
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    tools: 'Windsurf / Codeium',
    files: [
      {
        path: join('.windsurf', 'rules', 'project.md'),
        render: (a) => renderRules(a, { title: a.name }),
      },
    ],
  },
  {
    id: 'cline',
    label: 'Cline',
    tools: 'Cline, Roo Code',
    files: [
      { path: join('.clinerules', 'project.md'), render: (a) => renderRules(a, { title: a.name }) },
    ],
  },
  {
    id: 'continue',
    label: 'Continue',
    tools: 'Continue (.continue/rules)',
    files: [
      {
        path: join('.continue', 'rules', 'project.md'),
        render: (a) => renderRules(a, { title: a.name }),
      },
    ],
  },
  {
    id: 'kilocode',
    label: 'Kilo Code',
    tools: 'Kilo Code',
    files: [
      {
        path: join('.kilocode', 'rules', 'project.md'),
        render: (a) => renderRules(a, { title: a.name }),
      },
    ],
  },
  {
    id: 'trae',
    label: 'Trae',
    tools: 'Trae IDE',
    files: [
      {
        path: join('.trae', 'rules', 'project_rules.md'),
        render: (a) => renderRules(a, { title: a.name }),
      },
    ],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    tools: 'GitHub Copilot',
    files: [
      {
        path: join('.github', 'copilot-instructions.md'),
        render: (a) => renderRules(a, { title: `Copilot instructions for ${a.name}` }),
      },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    tools: 'Gemini CLI',
    files: [{ path: 'GEMINI.md', render: (a) => renderFull(a, { title: a.name }) }],
  },
  {
    id: 'aider',
    label: 'Aider',
    tools: 'Aider (CONVENTIONS.md)',
    files: [{ path: 'CONVENTIONS.md', render: (a) => renderFull(a, { title: a.name }) }],
  },
  {
    id: 'junie',
    label: 'JetBrains Junie',
    tools: 'JetBrains Junie',
    files: [
      {
        path: join('.junie', 'guidelines.md'),
        render: (a) => renderFull(a, { title: a.name }),
      },
    ],
  },
  {
    id: 'warp',
    label: 'Warp',
    tools: 'Warp terminal',
    files: [{ path: 'WARP.md', render: (a) => renderFull(a, { title: a.name }) }],
  },
];

export const TARGET_IDS: string[] = TARGETS.map((t) => t.id);

/** Resolve requested ids (supports "all") into Target objects, preserving registry order. */
export function resolveTargets(requested: string[]): Target[] {
  if (requested.length === 0 || requested.includes('all')) return TARGETS;
  const wanted = new Set(requested);
  return TARGETS.filter((t) => wanted.has(t.id));
}

/** Returns the invalid ids from a request, if any. */
export function invalidTargets(requested: string[]): string[] {
  const valid = new Set([...TARGET_IDS, 'all']);
  return requested.filter((r) => !valid.has(r));
}
