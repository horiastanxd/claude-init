import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Build the real dist artifact once so e2e tests exercise the shipped binary. */
export default function setup(): void {
  const root = resolve(import.meta.dirname, '..');
  execSync('npm run build', { cwd: root, stdio: 'ignore' });
}
