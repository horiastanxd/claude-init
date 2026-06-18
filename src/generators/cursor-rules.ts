import type { ProjectAnalysis } from '../types.js';
import { renderRules } from './render.js';

export function generateCursorRules(a: ProjectAnalysis): string {
  return renderRules(a, { title: a.name });
}
