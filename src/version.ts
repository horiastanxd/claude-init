import { createRequire } from 'node:module';

/** Read the package version at runtime so it never drifts from package.json. */
export function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
