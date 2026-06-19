import type { ProjectAnalysis } from '../types.js';

export function stackSection(a: ProjectAnalysis): string {
  const { techStack: t } = a;
  const lines = [`- Language: ${t.language}`];
  if (t.framework) lines.push(`- Framework: ${t.framework}`);
  if (t.runtime) lines.push(`- Runtime: ${t.runtime}`);
  lines.push(`- Package manager: ${t.packageManager}`);
  if (t.database) lines.push(`- Database: ${t.database}`);
  if (t.testing) lines.push(`- Testing: ${t.testing}`);
  if (t.buildTool) lines.push(`- Build tool: ${t.buildTool}`);
  if (t.extraLibraries.length) lines.push(`- Notable libraries: ${t.extraLibraries.join(', ')}`);
  return lines.join('\n');
}

export function commandsSection(a: ProjectAnalysis): string {
  const { commands: c } = a;
  const pairs: Array<[string, string | null]> = [
    ['Install', c.install],
    ['Dev', c.dev],
    ['Build', c.build],
    ['Test', c.test],
    ['Lint', c.lint],
    ['Format', c.format],
  ];
  const present = pairs.filter((p): p is [string, string] => Boolean(p[1]));
  const block: string[] = [];

  if (present.length) {
    const width = Math.max(...present.map(([, cmd]) => cmd.length));
    block.push(
      '```bash',
      ...present.map(([label, cmd]) => `${cmd.padEnd(width)}  # ${label.toLowerCase()}`),
      '```',
    );
  }

  const extraKeys = Object.keys(c.extra);
  if (extraKeys.length) {
    if (block.length) block.push('');
    block.push('Other scripts:');
    for (const key of extraKeys) block.push(`- \`${c.extra[key]}\``);
  }
  return block.join('\n');
}

export function structureSection(a: ProjectAnalysis): string {
  if (!a.structure.tree) return '';
  return ['```', a.structure.tree, '```'].join('\n');
}

export function conventionsSection(a: ProjectAnalysis): string {
  const { codePatterns: p } = a;
  const lines: string[] = [];
  if (p.strict) lines.push('- TypeScript strict mode is enabled - keep full type safety, avoid `any`.');
  if (p.linter) lines.push(`- Linter: ${p.linter}. Run it before committing.`);
  if (p.formatter) lines.push(`- Formatter: ${p.formatter}. Do not hand-format against it.`);
  if (p.importStyle) lines.push(`- Import style: ${p.importStyle}.`);
  if (p.commitConvention) lines.push(`- Commit convention: ${p.commitConvention}.`);
  return lines.join('\n');
}

export function envSection(a: ProjectAnalysis): string {
  if (!a.envVars.length) return '';
  const lines = ['Copy `.env.example` to `.env` and set:'];
  for (const v of a.envVars) {
    const req = v.required ? '**required**' : 'optional';
    const desc = v.description ? ` - ${v.description}` : '';
    lines.push(`- \`${v.name}\` (${req})${desc}`);
  }
  return lines.join('\n');
}

export function testingSection(a: ProjectAnalysis): string {
  if (!a.tests.command) return '';
  const lines = ['```bash', a.tests.command, '```'];
  if (a.tests.framework) lines.unshift(`Framework: ${a.tests.framework}.`, '');
  return lines.join('\n');
}

/** Join titled sections, dropping empty ones. */
export function compose(blocks: Array<[string, string]>): string {
  const out: string[] = [];
  for (const [title, body] of blocks) {
    if (!body.trim()) continue;
    out.push(title ? `## ${title}` : '');
    out.push(body, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
