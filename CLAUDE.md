---
description: Repository guidance for the Things MCP server.
globs: "src/**/*.ts,test/**/*.ts,README.md,package.json"
alwaysApply: false
---

# Things MCP Server Guidelines

This repository implements an MCP server that maps tool calls to the Things URL scheme.

## Core focus

- Preserve 1:1 behavior with the official Things URL documentation.
- Keep URL construction pure and testable (`src/url.ts`).
- Keep tool schemas and parameter mapping explicit (`src/tools.ts`).
- Keep docs aligned with implementation (`README.md`).

## MCP and Things behavior

- Tool names should stay stable (`add-todo`, `update-todo`, `show`, etc.).
- Use camelCase input names in tool schemas and map to Things kebab-case URL params.
- Do not silently drop supported Things parameters.
- For commands that require `auth-token`, fail fast with a clear `THINGS_AUTH_TOKEN` error.
- For commands with required mutually dependent inputs (for example `show` requiring `id` or `query`), validate and return a clear error.
- Prefer x-callback behavior when available and preserve callback fields returned by Things.

## Bun workflow

Use Bun for all local workflows.

- Install: `bun install`
- Dev: `bun run dev`
- Test: `bun test`
- Build: `bun run build`

## Testing expectations

- Add or update tests for every behavior change.
- Keep unit tests focused on URL generation and callback parsing.
- Use `bun:test` only.
- Before finishing work, run:

```bash
bun test
bun run build
```

## Documentation expectations

When tool parameters or behavior changes:

- Update `README.md` tool descriptions and parameter lists.
- Keep examples and caveats (xcall, auth token requirements) accurate.
