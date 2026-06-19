import type { ProjectAnalysis } from './types.js';

/** Produces a completion from a system + user prompt. Injected so the network call is testable. */
export type CompleteFn = (system: string, user: string) => Promise<string>;

export interface EnrichOptions {
  model: string;
  apiKey: string;
}

const SYSTEM_PROMPT =
  'You write a single concise sentence describing what a software project does, for a ' +
  'README-style context file. Output only the sentence: no preamble, no markdown, no quotes, ' +
  'present tense, third person.';

function buildEnrichPrompt(a: ProjectAnalysis): string {
  const { techStack: t } = a;
  const stack = [t.language, t.framework, t.runtime, t.database, t.testing]
    .filter(Boolean)
    .join(', ');
  const lines = [
    `Project name: ${a.name}`,
    `Stack: ${stack}`,
    a.description ? `Existing description: ${a.description}` : '',
    'File tree:',
    a.structure.tree,
  ].filter(Boolean);
  return lines.join('\n');
}

/** Collapse a model reply to a single trimmed sentence. */
function toOneSentence(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  const end = clean.search(/[.!?](\s|$)/);
  return end === -1 ? clean : clean.slice(0, end + 1);
}

/**
 * Enrich the project description with an LLM. Pure given `complete` - the network
 * dependency is injected, so this is fully testable without hitting the API.
 */
export async function enrichAnalysis(
  analysis: ProjectAnalysis,
  complete: CompleteFn,
): Promise<ProjectAnalysis> {
  const reply = (await complete(SYSTEM_PROMPT, buildEnrichPrompt(analysis))).trim();
  if (!reply) return analysis;
  return { ...analysis, description: toOneSentence(reply) };
}

/**
 * Build a completer backed by the official Anthropic SDK. The SDK is loaded
 * dynamically and is NOT a dependency of this package - enrichment is opt-in, so
 * default installs stay network-free. Install it with `npm install @anthropic-ai/sdk`.
 */
export async function createAnthropicCompleter(opts: EnrichOptions): Promise<CompleteFn> {
  const specifier = '@anthropic-ai/sdk';
  let mod: { default: new (config: { apiKey: string }) => AnthropicClient };
  try {
    mod = await import(specifier);
  } catch {
    throw new Error(
      'Enrichment needs the Anthropic SDK. Install it with: npm install @anthropic-ai/sdk',
    );
  }
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: opts.apiKey });

  return async (system, user) => {
    const message = await client.messages.create({
      model: opts.model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const block = message.content.find((b) => b.type === 'text');
    return block?.text ?? '';
  };
}

// Minimal structural typing for the slice of the Anthropic SDK we use (see its docs).
interface AnthropicClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: 'user'; content: string }>;
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}
