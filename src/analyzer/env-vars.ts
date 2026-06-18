import { join } from 'node:path';
import { readText } from '../utils.js';
import type { EnvVar } from '../types.js';

const CANDIDATES = ['.env.example', '.env.sample', '.env.template', '.env.local.example'];

export async function detectEnvVars(projectDir: string): Promise<EnvVar[]> {
  for (const candidate of CANDIDATES) {
    const content = await readText(join(projectDir, candidate));
    if (content !== null) return parseEnvFile(content);
  }
  return [];
}

export function parseEnvFile(content: string): EnvVar[] {
  const vars: EnvVar[] = [];
  let pendingComment = '';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      pendingComment = '';
      continue;
    }
    if (line.startsWith('#')) {
      pendingComment = line.replace(/^#+\s*/, '');
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const name = line.slice(0, eqIdx).trim().replace(/^export\s+/, '');
    if (!name) continue;
    const value = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

    vars.push({
      name,
      example: value || null,
      required: value === '',
      description: pendingComment,
    });
    pendingComment = '';
  }

  return vars;
}
