# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.5.0
[0.4.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.4.0
[0.3.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.3.0
[0.2.0]: https://github.com/horiastanxd/claude-init/releases/tag/v0.2.0
[0.1.0]: https://github.com/horiastanxd/claude-init/commits/main
