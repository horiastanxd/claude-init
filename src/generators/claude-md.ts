import type { ProjectAnalysis } from '../types.js';
import { renderFull } from './render.js';

export function generateClaudeMd(a: ProjectAnalysis): string {
  return renderFull(a, { title: a.name });
}
