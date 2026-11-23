# Contributing to QFabric

Thanks for your interest in QFabric. The goal is to make high-quality interactive
quantum education content easy to create, and contributing to the engine should
be easy too. This guide gets you from clone to pull request.

## Ways to contribute

- **Write lessons.** Write markdown with `:::` directives; no JavaScript needed.
  The example lesson in [`examples/`](./examples) shows the syntax.
- **Improve a component.** Fix a bug or add an option to an existing component.
- **Add a component.** See the [roadmap](./README.md#roadmap) and open an issue to
  discuss the design before starting.
- **Docs, examples and tests** are always welcome.

## Repository layout

```
packages/
  core/           qfabric: web components and quantum math engine
  remark-plugin/  @qfabric/remark-plugin: turns :::directive blocks into <qf-*> tags
  astro/          @qfabric/astro: Astro integration
examples/         sample Astro site exercising the components
scripts/          README asset generation
```

## Getting started

Requires Node 22+ and pnpm 10+ (`corepack enable` picks the right version).

```bash
pnpm install
pnpm build                            # build all packages
pnpm test                             # unit and component tests
pnpm --filter @qfabric/examples dev   # live example site
```

## Checks

`pnpm verify` runs everything CI runs, in the same order. Each step also has its
own command:

| Command | What it checks |
| --- | --- |
| `pnpm lint` | Biome lint and formatting. `pnpm format` fixes formatting. |
| `pnpm typecheck` | TypeScript, for sources and tests. |
| `pnpm test:coverage` | Vitest with coverage. Each package has coverage floors that CI enforces. |
| `pnpm check:packages` | The packed npm tarballs, with [publint](https://publint.dev) and [Are the Types Wrong?](https://arethetypeswrong.github.io). |
| `pnpm smoke` | Builds the example site and checks its output: directives became components, rows close correctly, nothing loads from third parties. |

Component tests run in jsdom (see `packages/core/src/base/qf-state-element.test.ts`).

## Project conventions

- **Language:** TypeScript, strict mode, ES2022.
- **Components:** Lit 3 with TC39 **standard** decorators. Never enable
  `experimentalDecorators`.
- **Formatting and linting:** Biome. Run `pnpm format` before committing.
- **Physics correctness comes first.** Any change to the math engine needs tests
  that check it against known textbook results.
- **Security:** never use `innerHTML` or `unsafeHTML` with directive, state or
  event data. YAML is parsed only with `JSON_SCHEMA`. See [SECURITY.md](./SECURITY.md).
- **Accessibility:** keep screen-reader descriptions and reduced-motion support
  working, and give any new interaction a keyboard path.
- **Workflows:** pin every GitHub Action to a full commit SHA, with the version
  in a comment (`uses: owner/action@<sha> # v1.2.3`). The organization rejects
  unpinned actions, and new third-party actions also need a maintainer to allow
  them.
- **Design:** style components through the `--qf-*` tokens in
  `packages/core/styles/tokens.css`, never hard-coded colours. Keep it flat: no
  glows or gradients. The logo mark keeps its original cyan and violet. In a lockup
  without a tagline, the wordmark's cap height equals the mesh height (see the
  comment in `assets/logo.svg`).

## Pull requests

1. Fork the repository and branch from `main`.
2. Make your change with tests, and check that `pnpm verify` passes.
3. Add a changeset describing the change: `pnpm changeset`. Pick `patch` for
   fixes and `minor` for new features while QFabric is pre-1.0.
4. Open a pull request and describe what changed and why.

CI runs lint, typecheck, tests on Node 22 and 24, package checks, the smoke
test, CodeQL and a dependency review. A pull request that changes a published
package without a changeset fails the "Changeset present" check.

## Releases

Releases are automated with [Changesets](https://github.com/changesets/changesets).
Each package keeps its history in its own `CHANGELOG.md`.

1. Merged changesets collect in a "chore: version packages" pull request, which
   bumps versions and writes the changelogs.
2. Merging that pull request publishes the changed packages to npm with
   provenance, tags the release and creates GitHub releases.

Only maintainers merge release pull requests.

## Code of conduct

Participation is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
Apache License 2.0.
