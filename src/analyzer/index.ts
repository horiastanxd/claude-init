import { basename, join } from 'node:path';
import { readJson } from '../utils.js';
import { detectTechStack } from './tech-stack.js';
import { analyzeGit } from './git-history.js';
import { analyzeStructure } from './project-structure.js';
import { detectCommands } from './commands.js';
import { detectEnvVars } from './env-vars.js';
import { detectCodePatterns } from './code-patterns.js';
import { TARGETS } from '../generators/registry.js';
import type { ProjectAnalysis } from '../types.js';

/**
 * Top-level path segments of every file we generate. Excluded from the structure
 * tree so that running `generate` does not make a later `check` report drift.
 */
const GENERATED_SEGMENTS: string[] = [
  ...new Set(TARGETS.flatMap((t) => t.files.map((f) => f.path.split(/[\\/]/)[0]!))),
];

export async function analyzeProject(projectDir: string): Promise<ProjectAnalysis> {
  const [techStack, gitInfo, structure, commands, envVars, codePatterns, pkg] = await Promise.all([
    detectTechStack(projectDir),
    analyzeGit(projectDir),
    analyzeStructure(projectDir, GENERATED_SEGMENTS),
    detectCommands(projectDir),
    detectEnvVars(projectDir),
    detectCodePatterns(projectDir),
    readJson<{ name?: string; description?: string; scripts?: Record<string, string> }>(
      join(projectDir, 'package.json'),
    ),
  ]);

  return {
    name: pkg?.name || basename(projectDir) || 'project',
    description: pkg?.description ?? '',
    techStack,
    structure,
    commands,
    tests: {
      framework: techStack.testing,
      command: commands.test,
      coverage: Boolean(pkg?.scripts && ('coverage' in pkg.scripts || 'test:coverage' in pkg.scripts)),
      testDir: structure.testDir,
    },
    envVars,
    codePatterns,
    gitInfo,
  };
}

export type { ProjectAnalysis } from '../types.js';
