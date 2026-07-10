# AGENTS.md

## Project overview

This repository contains `eslint-plugin-enforce-call`, an ESLint 9 plugin implemented as native ECMAScript modules.

- Rule implementations: `lib/rules/`
- Plugin entry point and type declarations: `lib/`
- Rule tests: `tests/rules/`
- Supported Node.js version: Node.js 20 or newer

## Package manager

Use **pnpm** for dependency management and scripts. The repository tracks `pnpm-lock.yaml`.

- Install dependencies: `pnpm install`
- Run the test suite: `pnpm test`

Do not use npm or yarn commands unless the user explicitly requests them.

## Validation

After changing rule code or tests, run:

```sh
pnpm test
```

The current test script directly runs `tests/rules/require-call-in-context.test.js` with Node.js. Do not claim tests pass unless this command completes successfully.

When resolving merge conflicts, remove every `<<<<<<<`, `=======`, and `>>>>>>>` marker, preserve compatible coverage from both sides, and then run `pnpm test`.

## Code conventions

- Use native ESM syntax (`import`/`export`).
- Match the existing formatting and naming style.
- Keep changes focused and avoid unrelated refactors.
- Add or update `RuleTester` cases when behavior changes.
- Preserve compatibility with ESLint 9 and Node.js 20+.
- Fix root causes rather than weakening or deleting meaningful tests.
