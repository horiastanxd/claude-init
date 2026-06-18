# Contributing to claude-init

Thanks for helping out. This project stays small and dependency-light on purpose.

## Setup

```bash
npm install
npm run dev -- --dry-run   # run the CLI from source
npm test                   # vitest
npm run build              # tsc -> dist/
npm run typecheck          # tsc --noEmit
```

## Adding support for a new AI tool

Most tools need a single entry in [`src/generators/registry.ts`](./src/generators/registry.ts):

```ts
{
  id: 'mytool',
  label: 'My Tool',
  tools: 'My Tool (what reads this file)',
  files: [{ path: '.mytool/rules.md', render: (a) => renderRules(a, { title: a.name }) }],
}
```

- Use `renderFull` for reference-style docs (CLAUDE.md, AGENTS.md, GEMINI.md).
- Use `renderRules` for short, imperative editor rules (Cursor, Windsurf, Copilot).
- Add the target to the README "Supported tools" table.
- Add or extend a test in `tests/`.

## Improving detection

Analyzers live in [`src/analyzer/`](./src/analyzer). Each one is independent and pure
where possible. Add a fixture-based test when you add detection logic.

## Conventions

- TypeScript strict mode. No `any` unless unavoidable.
- Keep the runtime dependency list minimal.
- Every change ships with a test. `npm test` must pass.

## Pull requests

1. Fork and branch.
2. Make the change with tests.
3. `npm test && npm run build` must pass.
4. Open a PR describing the change.
