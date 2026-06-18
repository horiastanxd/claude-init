import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export const CLI = resolve(import.meta.dirname, '..', 'dist', 'cli.js');

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the built CLI binary with args; never uses a shell. */
export function runCli(args: string[], cwd?: string): Promise<CliResult> {
  return new Promise((res) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => res({ code: code ?? 0, stdout, stderr }));
  });
}
