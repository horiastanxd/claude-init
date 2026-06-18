import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

export async function readJson<T = Record<string, unknown>>(path: string): Promise<T | null> {
  const raw = await readText(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const PM_LOCKFILES = [
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
] as const;

export async function detectPackageManager(dir: string): Promise<string> {
  for (const [lockfile, pm] of PM_LOCKFILES) {
    if (await pathExists(join(dir, lockfile))) return pm;
  }
  return 'npm';
}
