import type { ProjectAnalysis } from '../types.js';
import {
  compose,
  stackSection,
  commandsSection,
  structureSection,
  conventionsSection,
  envSection,
  testingSection,
} from './sections.js';

export interface RenderOpts {
  /** Top-level heading, e.g. "demo-app" or "AGENTS.md". */
  title: string;
  /** Optional paragraph placed under the heading, before the description. */
  intro?: string;
}

/**
 * Full reference document: stack, commands, structure, conventions, env, testing.
 * Used by file-based context formats (CLAUDE.md, GEMINI.md, AGENTS.md, ...).
 */
export function renderFull(a: ProjectAnalysis, opts: RenderOpts): string {
  const parts = [`# ${opts.title}`];
  if (opts.intro) parts.push('', opts.intro);
  if (a.description) parts.push('', a.description);

  const body = compose([
    ['Stack', stackSection(a)],
    ['Commands', commandsSection(a)],
    ['Project structure', structureSection(a)],
    ['Code conventions', conventionsSection(a)],
    ['Environment variables', envSection(a)],
    ['Testing', testingSection(a)],
  ]);

  return `${parts.join('\n')}\n\n${body}`;
}

/**
 * Concise, imperative "rules" document. Editors like Cursor, Windsurf, Cline and
 * Copilot work better with short directives than with a long reference doc.
 */
export function renderRules(a: ProjectAnalysis, opts: RenderOpts): string {
  const { techStack: t, commands: c } = a;

  const lines: string[] = [
    `# ${opts.title}`,
    '',
    `You are working in a ${t.language} project${t.framework ? ` using ${t.framework}` : ''}.`,
    `Package manager: ${t.packageManager}.`,
  ];

  const conv = conventionsSection(a);
  if (conv) lines.push('', '## Code style', conv);

  const cmdLines: string[] = [];
  if (c.dev) cmdLines.push(`- Dev: \`${c.dev}\``);
  if (c.test) cmdLines.push(`- Test: \`${c.test}\``);
  if (c.build) cmdLines.push(`- Build: \`${c.build}\``);
  if (c.lint) cmdLines.push(`- Lint: \`${c.lint}\``);
  if (cmdLines.length) lines.push('', '## Commands', ...cmdLines);

  if (a.envVars.length) {
    lines.push(
      '',
      '## Environment',
      `Config lives in \`.env.example\` (${a.envVars.length} variable(s)). Never hardcode secrets.`,
    );
  }

  return lines.join('\n') + '\n';
}

/** Wrap rules body in Cursor's modern `.mdc` frontmatter. */
export function withCursorFrontmatter(body: string, projectName: string): string {
  const fm = ['---', `description: Project rules for ${projectName}`, 'alwaysApply: true', '---', ''];
  return fm.join('\n') + body;
}
