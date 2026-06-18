import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { analyzeProject } from '../src/analyzer/index.js';

describe('analyzeProject (self-analysis)', () => {
  it('detects claude-init as a TypeScript project', async () => {
    const analysis = await analyzeProject(resolve(import.meta.dirname, '..'));
    expect(analysis.name).toBe('@horiastanxd/claude-init');
    expect(analysis.techStack.language).toBe('TypeScript');
    expect(analysis.techStack.packageManager).toBe('npm');
    expect(analysis.techStack.testing).toBe('Vitest');
    expect(analysis.commands.test).toBe('npm run test');
    expect(analysis.gitInfo).toBeDefined();
  });
});
