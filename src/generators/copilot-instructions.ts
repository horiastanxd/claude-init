import type { ProjectAnalysis } from '../types.js';
import { renderRules } from './render.js';

export function generateCopilotInstructions(a: ProjectAnalysis): string {
  return renderRules(a, { title: `Copilot instructions for ${a.name}` });
}
