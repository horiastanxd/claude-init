# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0]

### Added
- Wider framework detection: Astro, Angular and Gatsby (JS/TS); Spring Boot
  (Java, Maven and Gradle); Rails and Sinatra (Ruby); Laravel and Symfony (PHP).
- `requirements.txt` now contributes framework (FastAPI/Django/Flask) and pytest
  detection, matching what `pyproject.toml` already provided.
- Test-runner detection for the new ecosystems: RSpec/Minitest (Ruby) and
  PHPUnit/Pest (PHP).

## [0.8.0]

### Added
- Opt-in `--enrich` flag: uses an LLM to rewrite the project description into one concise
  sentence. Off by default - the tool stays 100% local unless you ask for it. Needs
  `ANTHROPIC_API_KEY` and the Anthropic SDK (`npm install @anthropic-ai/sdk`, not a
  dependency of this package); if either is missing, generation continues without
  enrichment. Model is configurable with `--enrich-model` (default `claude-opus-4-8`).

## [0.7.0]

### Added
- `check --recurse` verifies each workspace package too, exiting non-zero if any
  package has drifted. The MCP `generate_context_files` and `check_context_files`
  tools gained a matching `recurse` option, so monorepo generation and checking work
  over MCP as well.

## [0.6.0]

### Added
- Monorepo support via `--recurse`. Reads workspaces from `package.json`
  (`workspaces`, array or `{ packages: [] }` form) or `pnpm-workspace.yaml`, then
  generates context files in the root and in each workspace package, analyzing every
  package independently.

## [0.5.0]

### Added
- Build and test command detection for Java, Ruby and PHP projects:
  - `pom.xml` -> `mvn package` / `mvn test`
  - `build.gradle` / `build.gradle.kts` -> `./gradlew build` / `./gradlew test`
  - `Gemfile` -> `bundle install` / `bundle exec rake`
  - `composer.json` -> `composer install`, `composer test` / `composer lint`, plus
    other composer scripts as extra commands

## [0.4.0]

### Added
- Three more rules-based targets, each writing the tool's native project-rules file:
  - `continue` -> `.continue/rules/project.md`
  - `kilocode` -> `.kilocode/rules/project.md`
  - `trae` -> `.trae/rules/project_rules.md`
- Brings the supported tool count to 13.

## [0.3.0]

### Added
- Command detection from GitHub Actions workflows. `.github/workflows/*.yml` `run`
  steps (inline and block scalar) are parsed for recognised runner commands, split on
  `&&` / `;`, with dependency installs skipped and the net-new commands deduped against
  everything already detected.

## [0.2.0]

### Added
- Task-runner command detection: `Makefile`, `justfile` and `Taskfile` targets are
  surfaced as extra commands. Multi-target Make lines (`clean distclean:`) capture every
  target; justfile recipe parameters are not mistaken for recipes.

### Fixed
- The Commands section now renders runner-only repositories (e.g. a Make-based C or Go
  project with no `package.json`) instead of coming up empty.

## [0.1.0]

### Added
- Initial release. Scans a repository once and generates AI context files for Claude
  Code, AGENTS.md, Cursor, Windsurf, Cline, Copilot, Gemini CLI, Aider, JetBrains Junie
  and Warp. Runs as a CLI or an MCP server. 100% local - no API key, no network.

[0.9.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.9.0
[0.8.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.8.0
[0.7.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.7.0
[0.6.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.6.0
[0.5.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.5.0
[0.4.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.4.0
[0.3.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.3.0
[0.2.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.2.0
[0.1.0]: https://github.com/horiastanxd/claude-init/commits/main
