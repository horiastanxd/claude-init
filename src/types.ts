export interface ProjectAnalysis {
  name: string;
  description: string;
  techStack: TechStack;
  structure: ProjectStructure;
  commands: ProjectCommands;
  tests: TestInfo;
  envVars: EnvVar[];
  codePatterns: CodePatterns;
  gitInfo: GitInfo;
}

export interface TechStack {
  language: string;
  framework: string | null;
  runtime: string | null;
  packageManager: string;
  database: string | null;
  testing: string | null;
  buildTool: string | null;
  ci?: string | null;
  extraLibraries: string[];
}

export interface ProjectStructure {
  tree: string;
  entryPoints: string[];
  configFiles: string[];
  srcDir: string | null;
  testDir: string | null;
}

export interface ProjectCommands {
  install: string | null;
  dev: string | null;
  build: string | null;
  test: string | null;
  lint: string | null;
  format: string | null;
  extra: Record<string, string>;
}

export interface TestInfo {
  framework: string | null;
  command: string | null;
  coverage: boolean;
  testDir: string | null;
}

export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  example: string | null;
}

export interface CodePatterns {
  strict: boolean;
  linter: string | null;
  formatter: string | null;
  commitConvention: string | null;
  importStyle: string | null;
}

export interface GitInfo {
  hasGit: boolean;
  remoteName: string | null;
  defaultBranch: string | null;
  topAuthors: string[];
  hotFiles: string[];
}

/** A target id (see the generator registry) or the special "all". */
export type TargetFile = string;

export interface GeneratorOptions {
  outputDir: string;
  targets: TargetFile[];
  overwrite: boolean;
  minimal: boolean;
}

export interface GenerateResult {
  written: string[];
  skipped: string[];
}

export type CheckStatus = 'ok' | 'stale' | 'missing';

export interface CheckEntry {
  path: string;
  status: CheckStatus;
}

export interface CheckResult {
  entries: CheckEntry[];
  drifted: boolean;
}
