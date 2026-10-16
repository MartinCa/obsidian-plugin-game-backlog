# Agent instructions

Guidance for AI coding agents (and humans) working in this repository.

## Git hooks

Local hooks are installed automatically by `pnpm install` (the `prepare` script runs `lefthook install` — idempotent, safe to re-run).

**AI agents**: do not install the lefthook binary yourself — it is included in the OpenCode image. If `lefthook` is not on PATH, report this to the user and ask whether to install it.

Hooks come from the shared `MartinCa/lefthook-configs` fragments pinned at `v2.1.0` in `lefthook.yml`. `remotes:` configs merge _over_ `lefthook.yml`, so this repo's adaptation lives in `lefthook-local.yml` (the one layer that overrides remotes): it overrides the shared `format-ts` command with `pnpm exec prettier` and skips the fragment's `lint-ts` command — this repo has no ESLint setup (no `eslint` dependency, no `eslint.config.js`), Prettier only. The `format-ts` glob is extended to TS/TSX so the staged autofix covers the same file set as `pnpm run format:check`.

- **pre-commit** — Prettier `--write` on staged TS/TSX/JS/JSON/CSS/MD, re-staging fixed files; `lefthook-shared.yml` secret-scans the staged diff with `betterleaks` (blocks the commit on a leak) and audits staged `.github/workflows/*` files with `zizmor` (blocks on a finding).
- **commit-msg** — `commit-msg.yml` enforces Conventional Commits, e.g. `feat: ...`, `fix(api): ...`.

No **pre-push** hooks are adopted: v2.1.0's `pre-push-ts.yml` fragment gates pushes on the test suite (`pnpm test`), but this repo has no `test` script (and no standalone `typecheck` script) in `package.json`, so consuming it would fail every push. Type-checking is covered by `pnpm run build` (`tsc -noEmit -skipLibCheck`) in CI. If a test suite is ever added, consume `pre-push-ts.yml` in `lefthook-local.yml`.

These hooks are the **only** enforcement of the Prettier autofix, the secret scan, and Conventional-Commits checks. CI runs `pnpm format:check` (Prettier check), `pnpm exec tsc --noEmit --skipLibCheck`, and the esbuild build as blocking gates, and uploads a zizmor SARIF report to code scanning — a non-blocking SARIF upload, not a merge gate. CI does not run Prettier `--write`, `betterleaks`, or commit-msg validation itself. Do not bypass the hooks.

Two hook tools must be on `PATH`: `betterleaks` (secret scan, install per its project README) and `zizmor` (workflow audit, install from zizmor.sh). If a tool is missing, `LEFTHOOK=0 git commit` skips the hooks entirely — a pragmatic escape hatch for restricted setups, not a way to dodge the gates.

`lefthook-local.yml` is **intentionally checked in** as this repo's team-wide override: in a stock lefthook setup that file is the personal, gitignored override layer, but here it is the one layer that merges _over_ the shared `remotes:` fragments and it carries the repo-wide Prettier adaptation (`pnpm exec prettier` + extended glob). It is not a personal override layer in this repo; do not use it for private changes. Keep dependencies on pnpm — commit `pnpm-lock.yaml` (CI installs with `pnpm install --frozen-lockfile`); never reintroduce `package-lock.json` or npm.

## Dependencies

`@codemirror/state` and `@codemirror/view` devDeps must be bumped in lockstep with the `obsidian` package, which pins them as exact peerDependencies — Renovate will not bump them together. When `obsidian` releases a new version, update these two versions to match its exact peer pins.
