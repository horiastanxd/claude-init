import { resolve } from 'node:path';
import { analyzeProject } from './analyzer/index.js';
import { detectWorkspacePackages } from './analyzer/workspaces.js';
import { generateAll, checkAll } from './generators/index.js';
import type { CheckEntry } from './types.js';

export interface PackageGenerate {
  rel: string;
  written: string[];
  skipped: string[];
}

export interface PackageCheck {
  rel: string;
  entries: CheckEntry[];
  drifted: boolean;
}

/** Generate context files in each workspace package, analyzing every package on its own. */
export async function generateWorkspacePackages(
  projectDir: string,
  opts: { targets: string[]; overwrite: boolean },
): Promise<PackageGenerate[]> {
  const out: PackageGenerate[] = [];
  for (const rel of await detectWorkspacePackages(projectDir)) {
    const pkgDir = resolve(projectDir, rel);
    let analysis;
    try {
      analysis = await analyzeProject(pkgDir);
    } catch {
      continue;
    }
    const { written, skipped } = await generateAll(analysis, {
      outputDir: pkgDir,
      targets: opts.targets,
      overwrite: opts.overwrite,
      minimal: false,
    });
    out.push({ rel, written, skipped });
  }
  return out;
}

/** Check context files in each workspace package against its own analysis. */
export async function checkWorkspacePackages(
  projectDir: string,
  targets: string[],
): Promise<PackageCheck[]> {
  const out: PackageCheck[] = [];
  for (const rel of await detectWorkspacePackages(projectDir)) {
    const pkgDir = resolve(projectDir, rel);
    let analysis;
    try {
      analysis = await analyzeProject(pkgDir);
    } catch {
      continue;
    }
    const { entries, drifted } = await checkAll(analysis, pkgDir, targets);
    out.push({ rel, entries, drifted });
  }
  return out;
}
