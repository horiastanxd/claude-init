import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathExists } from '../utils.js';
import { resolveTargets } from './registry.js';
import type {
  ProjectAnalysis,
  GeneratorOptions,
  GenerateResult,
  CheckResult,
  CheckEntry,
} from '../types.js';

export interface PlannedFile {
  targetId: string;
  relPath: string;
  content: string;
}

/** Render the files for the requested targets without touching disk. */
export function buildFiles(analysis: ProjectAnalysis, targets: string[] = ['all']): PlannedFile[] {
  const planned: PlannedFile[] = [];
  for (const target of resolveTargets(targets)) {
    for (const file of target.files) {
      planned.push({ targetId: target.id, relPath: file.path, content: file.render(analysis) });
    }
  }
  return planned;
}

export async function generateAll(
  analysis: ProjectAnalysis,
  options: GeneratorOptions,
): Promise<GenerateResult> {
  const planned = buildFiles(analysis, options.targets);

  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of planned) {
    const fullPath = join(options.outputDir, file.relPath);
    if (!options.overwrite && (await pathExists(fullPath))) {
      skipped.push(fullPath);
      continue;
    }
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, 'utf-8');
    written.push(fullPath);
  }

  return { written, skipped };
}

/** Compare generated output against what is on disk (for CI / pre-commit). */
export async function checkAll(
  analysis: ProjectAnalysis,
  outputDir: string,
  targets: string[],
): Promise<CheckResult> {
  const planned = buildFiles(analysis, targets);
  const entries: CheckEntry[] = [];

  for (const file of planned) {
    const fullPath = join(outputDir, file.relPath);
    const current = await readFile(fullPath, 'utf-8').catch(() => null);
    const status = current === null ? 'missing' : current === file.content ? 'ok' : 'stale';
    entries.push({ path: fullPath, status });
  }

  return { entries, drifted: entries.some((e) => e.status !== 'ok') };
}
