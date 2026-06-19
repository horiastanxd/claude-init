import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI } from './helpers.js';

interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: unknown;
}

class McpClient {
  private proc: ChildProcessWithoutNullStreams;
  private buf = '';
  private pending = new Map<number, (r: JsonRpcResponse) => void>();

  constructor() {
    this.proc = spawn(process.execPath, [CLI, '--mcp']);
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      let idx: number;
      while ((idx = this.buf.indexOf('\n')) !== -1) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          const cb = this.pending.get(msg.id);
          if (cb) {
            this.pending.delete(msg.id);
            cb(msg);
          }
        } catch {
          /* ignore non-JSON */
        }
      }
    });
  }

  send(id: number, method: string, params: unknown): Promise<JsonRpcResponse> {
    return new Promise((res) => {
      this.pending.set(id, res);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  notify(method: string, params: unknown): void {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  kill(): void {
    this.proc.kill();
  }
}

let dir: string;
let client: McpClient;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cinit-mcp-'));
  await writeFile(join(dir, 'Cargo.toml'), '[package]\nname="m"\n[dependencies]\naxum="0.7"\n', 'utf-8');
  client = new McpClient();
  await client.send(0, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1' },
  });
  client.notify('notifications/initialized', {});
});

afterEach(async () => {
  client.kill();
  await rm(dir, { recursive: true, force: true });
});

describe('MCP server e2e', () => {
  it('lists the three tools', async () => {
    const r = await client.send(1, 'tools/list', {});
    const names = (r.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['analyze_project', 'generate_context_files', 'check_context_files']),
    );
  });

  it('analyze_project returns parsed analysis', async () => {
    const r = await client.send(2, 'tools/call', {
      name: 'analyze_project',
      arguments: { path: dir },
    });
    const text = (r.result as { content: Array<{ text: string }> }).content[0]!.text;
    const analysis = JSON.parse(text);
    expect(analysis.techStack.language).toBe('Rust');
    expect(analysis.techStack.framework).toBe('Axum');
  });

  it('generate_context_files writes files', async () => {
    const r = await client.send(3, 'tools/call', {
      name: 'generate_context_files',
      arguments: { path: dir, targets: ['claude', 'agents'], overwrite: true },
    });
    const text = (r.result as { content: Array<{ text: string }> }).content[0]!.text;
    expect(text).toContain('CLAUDE.md');
    expect(text).toContain('AGENTS.md');
  });

  it('generate_context_files with recurse writes into workspace packages', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'mono', workspaces: ['packages/*'] }),
      'utf-8',
    );
    await mkdir(join(dir, 'packages', 'lib'), { recursive: true });
    await writeFile(join(dir, 'packages', 'lib', 'package.json'), JSON.stringify({ name: 'lib' }), 'utf-8');
    const r = await client.send(7, 'tools/call', {
      name: 'generate_context_files',
      arguments: { path: dir, targets: ['claude'], overwrite: true, recurse: true },
    });
    const text = (r.result as { content: Array<{ text: string }> }).content[0]!.text;
    expect(text).toContain(join('packages', 'lib', 'CLAUDE.md'));
  });

  it('check_context_files reports drift then up to date', async () => {
    const before = await client.send(4, 'tools/call', {
      name: 'check_context_files',
      arguments: { path: dir, targets: ['claude'] },
    });
    expect((before.result as { content: Array<{ text: string }> }).content[0]!.text).toContain(
      'Drift detected',
    );

    await client.send(5, 'tools/call', {
      name: 'generate_context_files',
      arguments: { path: dir, targets: ['claude'], overwrite: true },
    });

    const after = await client.send(6, 'tools/call', {
      name: 'check_context_files',
      arguments: { path: dir, targets: ['claude'] },
    });
    expect((after.result as { content: Array<{ text: string }> }).content[0]!.text).toContain(
      'up to date',
    );
  });
});
