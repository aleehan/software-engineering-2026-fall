# AGENTS.md

## Project
Smart Campus room availability checker (React + TypeScript + Vite). Fictional sample data only.

## Structure
- src/lib/availability.ts: pure booking rules (checkAvailability and helpers)
- src/lib/availability.test.ts: Vitest regression tests T01–T20
- src/data/sampleRooms.ts: fictional room and booking fixtures
- src/lib/inputValidation.ts and src/lib/inputValidation.test.ts: pure input-completion check and its tests
- src/App.tsx, src/components/*: UI

## Constraints
- Preserve AC1–AC6: reject start >= end and past requests; reject durations longer than 120 minutes; reject a blocked room; reject overlaps but allow bookings touching only at endpoints; do not mutate booking data; keep clear desktop/mobile feedback.
- No backend, database, Bolt Database/Supabase, login or booking creation.
- Do not change the UI layout or user-facing messages.
- Sample fixtures contain fictional rooms only (no real campus data).
- No secrets, API keys, or credentials may be committed or referenced in code.
- No external deployments, hosting, or publishing steps are permitted.

## Engineering rules
- Prefer pure functions and minimal changes; use at most 2 justified patterns.
- No Singleton, Factory, Repository or class hierarchies without a concrete need.
- Do not mutate booking fixtures; keep responsive UI feedback.
- Do not weaken or delete existing test assertions.

## Commands
- Run tests: npx vitest run
- Type check: npm run typecheck
- Lint: npm run lint
- Dev server: npm run dev
- Build: npm run build

## Verification
- Run existing tests and add focused regression tests.
- Tests must pass before any change is proposed for acceptance.
- Report changed files, rationale and test evidence. Only report test results from real output.
- Human review and approval are required before merging or publishing.