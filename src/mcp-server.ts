import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { analyzeProject } from './analyzer/index.js';
import { generateAll, checkAll } from './generators/index.js';
import { TARGET_IDS } from './generators/registry.js';
import { getVersion } from './version.js';

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'claude-init', version: getVersion() },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'analyze_project',
        description:
          'Analyze a repository (tech stack, commands, structure, env vars, git) and return structured JSON.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute path to the project directory' },
          },
          required: ['path'],
        },
      },
      {
        name: 'generate_context_files',
        description:
          'Generate AI context files (CLAUDE.md, AGENTS.md, Cursor/Windsurf/Cline rules, GEMINI.md, Copilot, and more) for a repository.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute path to the project directory' },
            targets: {
              type: 'array',
              items: { type: 'string', enum: [...TARGET_IDS, 'all'] },
              description: 'Which targets to generate (default: all)',
            },
            outputDir: { type: 'string', description: 'Output directory (default: the project path)' },
            overwrite: { type: 'boolean', description: 'Overwrite existing files (default: false)' },
          },
          required: ['path'],
        },
      },
      {
        name: 'check_context_files',
        description:
          'Check whether the existing AI context files match the current repository. Reports per-file ok/stale/missing.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute path to the project directory' },
            targets: {
              type: 'array',
              items: { type: 'string', enum: [...TARGET_IDS, 'all'] },
            },
            outputDir: { type: 'string', description: 'Directory holding the files (default: the project path)' },
          },
          required: ['path'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;
    const path = String(args.path);

    if (name === 'analyze_project') {
      const analysis = await analyzeProject(path);
      return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
    }

    if (name === 'generate_context_files') {
      const analysis = await analyzeProject(path);
      const { written, skipped } = await generateAll(analysis, {
        outputDir: (args.outputDir as string) ?? path,
        targets: (args.targets as string[]) ?? ['all'],
        overwrite: args.overwrite === true,
        minimal: false,
      });
      const lines = [
        written.length
          ? `Generated:\n${written.map((f) => `  + ${f}`).join('\n')}`
          : 'No files generated.',
        skipped.length ? `\nSkipped (already exist):\n${skipped.map((f) => `  - ${f}`).join('\n')}` : '',
      ].filter(Boolean);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    if (name === 'check_context_files') {
      const analysis = await analyzeProject(path);
      const { entries, drifted } = await checkAll(
        analysis,
        (args.outputDir as string) ?? path,
        (args.targets as string[]) ?? ['all'],
      );
      const body = entries.map((e) => `  ${e.status.padEnd(7)} ${e.path}`).join('\n');
      return {
        content: [
          { type: 'text', text: `${body}\n\n${drifted ? 'Drift detected.' : 'All up to date.'}` },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
