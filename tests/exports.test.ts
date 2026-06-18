import { describe, it, expect } from 'vitest';
import * as lib from '../src/index.js';
import { getVersion } from '../src/version.js';
import {
  generateClaudeMd,
  generateAgentsMd,
  generateCursorRules,
  generateGeminiMd,
  generateCopilotInstructions,
} from '../src/index.js';
import type { ProjectAnalysis } from '../src/types.js';

const sample: ProjectAnalysis = {
  name: 'exp',
  description: 'd',
  techStack: {
    language: 'TypeScript',
    framework: 'Next.js',
    runtime: 'Node.js',
    packageManager: 'npm',
    database: null,
    testing: 'Vitest',
    buildTool: null,
    extraLibraries: [],
  },
  structure: { tree: 'src/', entryPoints: [], configFiles: [], srcDir: 'src', testDir: null },
  commands: { install: 'npm install', dev: null, build: null, test: 'npm test', lint: null, format: null, extra: {} },
  tests: { framework: 'Vitest', command: 'npm test', coverage: false, testDir: null },
  envVars: [],
  codePatterns: { strict: true, linter: null, formatter: null, commitConvention: null, importStyle: 'relative' },
  gitInfo: { hasGit: false, remoteName: null, defaultBranch: null, topAuthors: [], hotFiles: [] },
};

describe('public library surface', () => {
  it('exports the documented API', () => {
    for (const name of [
      'analyzeProject',
      'generateAll',
      'buildFiles',
      'checkAll',
      'TARGETS',
      'TARGET_IDS',
      'resolveTargets',
      'invalidTargets',
      'renderFull',
      'renderRules',
    ]) {
      expect(lib).toHaveProperty(name);
    }
  });

  it('getVersion returns a semver from package.json', () => {
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('every named generator wrapper renders the analysis', () => {
    // claude/gemini are titled by project name; agents.md is titled by convention.
    expect(generateClaudeMd(sample)).toContain('# exp');
    for (const out of [generateAgentsMd(sample), generateGeminiMd(sample)]) {
      expect(out).toContain('Next.js');
      expect(out.length).toBeGreaterThan(40);
    }
    // rules-style wrappers (frontmatter is applied by the registry, not the wrapper)
    expect(generateCursorRules(sample)).toContain('# exp');
    expect(generateCopilotInstructions(sample)).toContain('Next.js');
  });
});
