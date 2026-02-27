# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React + TypeScript renderer (UI components, hooks, API/query wrappers, schemas, i18n, and shared utilities).
- `src-tauri/src/`: Rust backend for Tauri commands, services, SQLite access, deep links, and proxy logic.
- `tests/`: Vitest suites (`components/`, `hooks/`, `integration/`, `utils/`) plus shared setup and MSW mocks in `tests/msw/`.
- `assets/` and `src/assets/`: static images/icons; `docs/`: product and usage docs; `scripts/`: helper scripts.

## Build, Test, and Development Commands
- `pnpm install --frozen-lockfile`: install dependencies exactly as locked.
- `pnpm dev`: run the full Tauri app (frontend + backend) in development mode.
- `pnpm dev:renderer`: run only the Vite renderer for fast UI iteration.
- `pnpm build`: produce production Tauri bundles.
- `pnpm typecheck`: run TypeScript checks (`tsc --noEmit`).
- `pnpm test:unit`: run frontend unit/integration tests with Vitest.
- `pnpm format:check` / `pnpm format`: verify or apply Prettier formatting.
- Backend verification (from `src-tauri/`): `cargo check --all-features`, `cargo test`.

## Coding Style & Naming Conventions
- Follow Prettier defaults (2-space indentation, semicolons, double quotes in TS/TSX).
- Use `@/` imports for renderer code rooted at `src/`.
- React components: `PascalCase.tsx`; hooks: `useSomething.ts`; utilities/types: descriptive `camelCase` exports.
- Rust modules/files use `snake_case`; structs/enums use `CamelCase`; keep command handlers thin and push logic into `services/`.

## Testing Guidelines
- Frameworks: Vitest + Testing Library + JSDOM, with MSW for network/Tauri mocking.
- Name tests `*.test.ts` or `*.test.tsx` and mirror source domains (for example, `src/components/...` -> `tests/components/...`).
- Add or update MSW handlers when API behavior changes.
- No hard coverage gate is enforced; run `pnpm test:unit -- --coverage` for risky changes and maintain/improve coverage in touched areas.

## Commit & Pull Request Guidelines
- Use Conventional Commits seen in history: `feat:`, `fix(scope):`, `docs:`, `chore:`.
- Keep commits focused and explain user-visible impact.
- PRs should include: concise description, test steps/results, linked issue (if any), and screenshots/GIFs for UI changes.
- Call out migrations, config format changes, or proxy behavior changes explicitly.

## Security & Configuration Tips
- Never commit API keys, tokens, or local config snapshots.
- Validate both app manifests when versioning releases: `package.json` and `src-tauri/Cargo.toml`.
