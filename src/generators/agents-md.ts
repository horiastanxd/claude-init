import type { ProjectAnalysis } from '../types.js';
import { renderFull } from './render.js';

/**
 * AGENTS.md - the cross-tool standard read by OpenAI Codex, Jules, Amp, Zed,
 * Devin and a growing list of agents. Same content, agent-instruction framing.
 */
export function generateAgentsMd(a: ProjectAnalysis): string {
  return renderFull(a, {
    title: 'AGENTS.md',
    intro: `Instructions for AI coding agents working in **${a.name}**.`,
  });
}
