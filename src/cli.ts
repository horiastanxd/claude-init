#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeProject } from './analyzer/index.js';
import { generateAll, checkAll } from './generators/index.js';
import { generateWorkspacePackages, checkWorkspacePackages } from './generate-recursive.js';
import { TARGETS, TARGET_IDS, invalidTargets } from './generators/registry.js';
import { getVersion } from './version.js';

function parseTargets(raw: string): string[] {
  const parts = raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const bad = invalidTargets(parts);
  if (bad.length) {
    throw new Error(`Unknown target(s): ${bad.join(', ')}. Valid: ${TARGET_IDS.join(', ')}, all`);
  }
  return parts;
}

async function runGenerate(
  dir: string | undefined,
  opts: { targets: string; output: string; overwrite: boolean; dryRun: boolean; recurse: boolean },
): Promise<void> {
  const projectDir = resolve(dir ?? '.');
  const targets = parseTargets(opts.targets);

  const spinner = ora(`Analyzing ${projectDir}`).start();
  let analysis;
  try {
    analysis = await analyzeProject(projectDir);
  } catch (err) {
    spinner.fail(`Analysis failed: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  spinner.succeed(
    `Analyzed ${chalk.bold(analysis.name)} ` +
      chalk.dim(
        `(${analysis.techStack.language}${analysis.techStack.framework ? `, ${analysis.techStack.framework}` : ''})`,
      ),
  );

  if (opts.dryRun) {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }

  const { written, skipped } = await generateAll(analysis, {
    outputDir: resolve(opts.output),
    targets,
    overwrite: opts.overwrite,
    minimal: false,
  });

  for (const f of written) console.log(chalk.green('  +'), f);
  for (const f of skipped) {
    console.log(chalk.yellow('  -'), `${f} ${chalk.dim('(exists, use --overwrite)')}`);
  }

  let total = written.length;
  if (opts.recurse) {
    for (const pkg of await generateWorkspacePackages(projectDir, { targets, overwrite: opts.overwrite })) {
      console.log(chalk.bold(`\n${pkg.rel}/`));
      for (const f of pkg.written) console.log(chalk.green('  +'), f);
      for (const f of pkg.skipped) console.log(chalk.yellow('  -'), `${f} ${chalk.dim('(exists)')}`);
      total += pkg.written.length;
    }
  }

  if (!total && skipped.length) {
    console.log(chalk.yellow('\nNothing written. Re-run with --overwrite to replace existing files.'));
  } else {
    console.log(chalk.bold(`\nDone. ${total} file(s) generated.`));
  }
}

async function runCheck(
  dir: string | undefined,
  opts: { targets: string; output: string; recurse: boolean },
): Promise<void> {
  const projectDir = resolve(dir ?? '.');
  const targets = parseTargets(opts.targets);
  const printEntry = (e: { status: string; path: string }) => {
    const mark =
      e.status === 'ok'
        ? chalk.green('  ok     ')
        : e.status === 'stale'
          ? chalk.yellow('  stale  ')
          : chalk.red('  missing');
    console.log(mark, e.path);
  };

  const analysis = await analyzeProject(projectDir);
  const { entries, drifted } = await checkAll(analysis, resolve(opts.output), targets);
  entries.forEach(printEntry);

  let anyDrift = drifted;
  if (opts.recurse) {
    for (const pkg of await checkWorkspacePackages(projectDir, targets)) {
      console.log(chalk.bold(`\n${pkg.rel}/`));
      pkg.entries.forEach(printEntry);
      anyDrift = anyDrift || pkg.drifted;
    }
  }

  if (anyDrift) {
    console.log(chalk.red('\nContext files are out of date. Run `claude-init --overwrite` to refresh.'));
    process.exitCode = 1;
  } else {
    console.log(chalk.green('\nAll context files are up to date.'));
  }
}

function runList(): void {
  console.log(chalk.bold('Supported targets:\n'));
  const width = Math.max(...TARGETS.map((t) => t.id.length));
  for (const t of TARGETS) {
    console.log(`  ${chalk.cyan(t.id.padEnd(width))}  ${t.files.map((f) => f.path).join(', ')}`);
    console.log(`  ${' '.repeat(width)}  ${chalk.dim(t.tools)}`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--mcp')) {
    const { startMcpServer } = await import('./mcp-server.js');
    await startMcpServer();
    return;
  }

  const program = new Command();
  program
    .name('claude-init')
    .description(
      'Auto-generate AI context files (CLAUDE.md, AGENTS.md, .cursor/rules, GEMINI.md, Copilot, and more)',
    )
    .version(getVersion());

  program
    .command('generate', { isDefault: true })
    .alias('g')
    .description('Analyze a repository and generate AI context files')
    .argument('[dir]', 'project directory', '.')
    .option('-t, --targets <list>', `comma-separated (${TARGET_IDS.join(',')},all)`, 'all')
    .option('-o, --output <dir>', 'output directory', '.')
    .option('--overwrite', 'overwrite existing files', false)
    .option('--dry-run', 'print the analysis as JSON without writing files', false)
    .option('--recurse', 'also generate into each workspace package (monorepo)', false)
    .action(runGenerate);

  program
    .command('check')
    .description('Verify generated files match the current repo (exit 1 on drift; for CI / pre-commit)')
    .argument('[dir]', 'project directory', '.')
    .option('-t, --targets <list>', `comma-separated (${TARGET_IDS.join(',')},all)`, 'all')
    .option('-o, --output <dir>', 'output directory', '.')
    .option('--recurse', 'also check each workspace package (monorepo)', false)
    .action(runCheck);

  program.command('list').description('List supported targets and their output paths').action(runList);

  program
    .command('mcp')
    .description('Run as an MCP server over stdio')
    .action(async () => {
      const { startMcpServer } = await import('./mcp-server.js');
      await startMcpServer();
    });

  await program.parseAsync();
}

main().catch((err) => {
  console.error(chalk.red(`Error: ${(err as Error).message}`));
  process.exit(1);
});
