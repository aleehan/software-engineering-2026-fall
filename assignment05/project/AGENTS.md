# AGENTS.md — Gamekeeper

Operating instructions for any coding agent (Claude Code, Codex, Copilot agent, etc.) working in this
repository. `CLAUDE.md` holds the detailed product rules in Russian and imports this file; when the
two disagree, the **stricter** rule wins and the agent must ask the owner.

## 1. Purpose

Gamekeeper is a Windows 11 desktop app (Electron) that counts competitive CS2 matches and closes
`cs2.exe` once the daily limit is reached. The counter resets every day at 05:00 local time.
Loosening the rules (raise limit, unlock, quit, change FACEIT account) requires a password **and**
a 10-minute delay. The app protects the user from themselves, so any change that weakens a
protection is a product decision, not a refactoring.

## 2. Architecture (where things live)

| Path                                                            | Role                                                                                   | Notes                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/main/index.ts`                                             | Electron entry point: bootstrap, timers, IPC registration, tray, single-instance lock  | Not unit-tested (imports `electron`)             |
| `src/main/core/`                                                | Business logic, **must not import `electron`**                                         | All unit tests live here                         |
| `src/main/core/rules-engine.ts`, `game-day.ts`, `today.ts`      | Limit status (`allowed / grace / blocked`), 05:00 reset                                | Pure functions                                   |
| `src/main/core/enforcer.ts`, `process-controller.ts`            | Closes `cs2.exe` via `tasklist`/`taskkill` behind the `ProcessController` interface    | Never call the real controller in tests          |
| `src/main/core/protection.ts`, `password.ts`                    | Password (scrypt), delayed loosening queue (`pending_changes`)                         | Security-critical                                |
| `src/main/core/match-counter.ts`, `gsi-server.ts`, `games/cs2/` | CS2 Game State Integration: HTTP server on 127.0.0.1, config installer, payload parser |                                                  |
| `src/main/core/faceit/`                                         | FACEIT Data API client and sync                                                        | Network code takes an injectable `fetch`         |
| `src/main/core/db/`, `drizzle/`                                 | Drizzle ORM schema, repositories, SQL migrations                                       |                                                  |
| `src/main/ipc-*.ts`, `src/preload/`, `src/shared/`              | IPC boundary; everything from the renderer is `unknown` and validated                  |                                                  |
| `src/renderer/`                                                 | React UI (Home, Settings, History, Onboarding)                                         |                                                  |
| `scripts/`                                                      | Test runner wrapper, icon renderer, FACEIT probe                                       | `faceit-probe.mjs` needs a real key — do not run |

## 3. Setup

- Node.js 22+ and npm 10+. Install with `npm ci` (uses `package-lock.json`; do not use `npm install`
  unless a dependency change was approved).
- `postinstall` downloads Electron and rebuilds `better-sqlite3` for Electron. Without network access to
  `electronjs.org` the rebuild fails; in that case run `npm ci --ignore-scripts` and build the native
  module for the local Node (`cd node_modules/better-sqlite3 && npx node-gyp rebuild --release --force_build=1`,
  with `npm_config_nodedir` pointing at the local Node install if headers cannot be downloaded). Report
  this deviation in the change summary.

## 4. Safe commands (allowed without asking)

| Command                                                                       | What it does                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm test`                                                                    | Vitest inside Electron-as-Node, in-memory SQLite       |
| `npm test -- --reporter=verbose` / `npm test -- src/main/core/<file>.test.ts` | Same, verbose / single file                            |
| `npm run typecheck`                                                           | `tsc --noEmit` for main and renderer                   |
| `npm run lint`                                                                | ESLint                                                 |
| `npx prettier --check .`                                                      | Formatting check (read-only)                           |
| `npx electron-vite build` / `npm run build`                                   | Compiles to `out/` (no installer, no registry changes) |
| `npm audit`, `git status`, `git diff`, `git log`                              | Read-only inspection                                   |

## 5. Commands that need explicit owner approval

- `npm run dev` / `npm start` — **only** as `GAMEKEEPER_PROFILE=test npm run dev`. Without the profile the
  dev build shares the database, single-instance lock, GSI port and token with the installed app,
  rewrites the CS2 GSI config and can kill the owner's running `cs2.exe`.
- `npm run build:win`, `npm run build:unpack` — the unpacked build registers a Windows autostart entry.
- `npm run db:generate` — creates a new migration; only after a reviewed `schema.ts` change.
- `npm run format` (rewrites files), `npm run icons`.
- Any `npm install <pkg>`, version bump or lockfile change.

## 6. Forbidden actions

1. **No secrets.** Never read, print, copy or commit `.faceit-key`, a real FACEIT API key, the user's
   `gamekeeper.db` or `%APPDATA%\gamekeeper\*`. Use fake keys such as `test-key` in tests.
2. **No production deployment or release.** Do not publish installers, create GitHub releases, push tags
   or upload artifacts.
3. **No destructive commands.** No `rm -rf` outside `out/`/`dist/`, no `git push --force`, no `git reset --hard`
   on shared branches, no `taskkill`, no `reg add/delete`, no editing files in the real Steam/CS2 folder.
   Never stop the installed Gamekeeper instance — it is the user's protection.
4. **No unreviewed dependency changes.** Do not add, remove or upgrade packages, and do not run
   `npm audit fix --force`, without a written justification approved by the owner.
5. **No weakening of protection** without an explicit request: do not remove the password check, shorten
   `LOOSENING_DELAY_MS`, move a "loosening" action to the "tightening" side, or add an `electron` import to `core/`.
6. **Do not edit committed migrations** in `drizzle/`; generate a new one instead.

## 7. Coding conventions

- TypeScript strict; no `any` (parse external data as `unknown` + type guards, see `gsi-payload.ts`).
- Prettier: single quotes, no semicolons, width 100 (`.prettierrc.yaml`).
- Inject time, randomness, processes and network (`now`, `fetchFn`, `ProcessController`) so logic is testable.
- Comments may be in Russian (the owner is learning TypeScript); identifiers in English.
- Keep changes small: one concern per commit, no drive-by reformatting.

## 8. Test expectations

- Every behaviour change in `src/main/core/` comes with a `*.test.ts` next to the code.
- Before handing work back: `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` must pass;
  paste the pass/fail totals. If a check could not be run, say so — never invent output.
- Protection rules must keep their tests green: tightening is immediate and password-free, loosening
  needs the password and the delay (`protection.test.ts`).

## 9. Review gates

- An agent may work only on a separate branch (`agent/<topic>`) or git worktree, never on `main`.
- A human reviews the diff, the test log and the risk notes before merge. Changes touching
  `protection.ts`, `password.ts`, `enforcer.ts`, `process-controller.ts`, `window.ts`, IPC handlers or
  `package.json` always need a human review, even if all checks pass.
- The change summary must list: files changed, commands run with results, tests not executed, open risks.
