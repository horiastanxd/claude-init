# @horiastanxd/claude-init

One command generates AI context files - CLAUDE.md, AGENTS.md, Cursor/Windsurf/Cline rules, GEMINI.md, Copilot, Aider, Junie, Warp - for any repository. CLI + MCP server, 100% local.

## Stack
- Language: TypeScript
- Runtime: Node.js
- Package manager: npm
- Testing: Vitest

## Commands
```bash
npm install    # install
npm run dev    # dev
npm run build  # build
npm run test   # test
```

Other scripts:
- `npm run mcp`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run typecheck`

## Project structure
```
src/
  analyzer/
    code-patterns.ts
    commands.ts
    env-vars.ts
    git-history.ts
    index.ts
    project-structure.ts
    tech-stack.ts
  generators/
    agents-md.ts
    claude-md.ts
    copilot-instructions.ts
    cursor-rules.ts
    gemini-md.ts
    index.ts
    registry.ts
    render.ts
    sections.ts
  cli.ts
  index.ts
  mcp-server.ts
  types.ts
  utils.ts
  version.ts
tests/
  analyzer.test.ts
  check.test.ts
  cli.e2e.test.ts
  coverage-gaps.test.ts
  detection-matrix.test.ts
  env-vars.test.ts
  exports.test.ts
  fallbacks.mock.test.ts
  generators.test.ts
  git.test.ts
  global-setup.ts
  helpers.ts
  mcp.e2e.test.ts
  render.test.ts
  structure-patterns.test.ts
  tech-stack.test.ts
CONTRIBUTING.md
LICENSE
package-lock.json
package.json
README.md
tsconfig.json
vitest.config.ts
```

## Code conventions
- TypeScript strict mode is enabled - keep full type safety, avoid `any`.
- Import style: relative.

## Testing
Framework: Vitest.

```bash
npm run test
```
