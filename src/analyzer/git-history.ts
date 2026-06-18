import { simpleGit } from 'simple-git';
import type { GitInfo } from '../types.js';

const NONE: GitInfo = {
  hasGit: false,
  remoteName: null,
  defaultBranch: null,
  topAuthors: [],
  hotFiles: [],
};

export async function analyzeGit(projectDir: string): Promise<GitInfo> {
  const git = simpleGit(projectDir);

  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) return { ...NONE };

  const [remotes, branch, authorLog, fileLog] = await Promise.all([
    git.getRemotes(true).catch(() => []),
    git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'main'),
    git.raw(['log', '--format=%an', '--no-merges', '-200']).catch(() => ''),
    git.raw(['log', '--name-only', '--format=', '--no-merges', '-500']).catch(() => ''),
  ]);

  return {
    hasGit: true,
    remoteName: remotes[0]?.refs?.fetch ?? remotes[0]?.name ?? null,
    defaultBranch: branch.trim() || 'main',
    topAuthors: topCounts(authorLog, 3),
    hotFiles: topCounts(fileLog, 5),
  };
}

function topCounts(log: string, limit: number): string[] {
  const counts: Record<string, number> = {};
  for (const line of log.split('\n')) {
    const key = line.trim();
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([k]) => k);
}
