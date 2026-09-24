# Backend v2 — Contributor Rules

These rules apply to every change under `backend/`, whoever or whatever writes
it. Read this file and [`SPEC.md`](./SPEC.md) fully before starting a phase.

## 1. Boundaries

- Work only inside `backend/`. Do not modify `frontend/`, `relayer/`,
  `server/`, `evm/`, `solana/`, `solana_old/` or `cosmwasm/`. Read them freely:
  For chain logic, `evm/` (the ERC-2535 diamond: `evm/CLAUDE.md`,
  `evm/src/interfaces/`, `evm/src/types/CbTypes.sol`, `evm/abi/`) defines the
  EVM contract interface, and `relayer/src/` is the reference for processing
  patterns (loops, cursors, job queue, VAA / attestation fetching, Solana).
- Implement exactly the phase you were given. Do not start work that belongs
  to another phase, even if it looks small.
- Do not edit `docs/SPEC.md` or other phase files. If the spec is wrong,
  ambiguous or impossible, choose the most conservative option, implement it,
  and list it under **Spec questions** in your handoff note (§2).
- Only phases 1 and 1b edit `prisma/schema.prisma` and `prisma/migrations/`
  unless the phase file says otherwise.

## 2. Git

Everything is merged **locally**; there are no GitHub pull requests.

- Before the first commit, check the author identity is the repository owner:
  `git config user.name` → `Obum`, `git config user.email` → `obuumm@gmail.com`
  (set them with `git config` if not). Check `git log --format='%an <%ae>' -1`
  after committing.
- Work in your own git worktree on the branch named in your phase file,
  created from the latest `main`:
  `git worktree add ../chainbills-<phase> -b <branch> main`
  (the reviewer usually creates it for you). Never commit on `main` directly.
- Commit on your branch only. Do not merge, rebase or push `main`, and never
  rewrite history that someone else may have based work on.
- When done, stop and hand over a **handoff note** as your final message:
  - **Summary**: what the branch adds.
  - **How to verify**: exact commands.
  - **Env changes**: new / changed variables, or "none".
  - **Spec questions**: ambiguities and the choice you made, or "none".
- The reviewer reviews the branch, asks for fixes on the same branch, and
  merges it into `main` with `git merge --no-ff <branch>` (merge commit
  subject: `merge(backend): <phase title>`), then pushes `main`.

### Commit messages

- Conventional Commits: `feat(backend): …`, `fix(backend): …`, `docs(backend): …`,
  `test(backend): …`, `chore(backend): …`.
- Describe what the code adds or does, in the present tense, forward-looking:
  `feat(backend): add SIWE nonce and session endpoints`.
- Do **not** mention: AI, assistants, agents, sessions, Claude, models,
  "tests pass/done", or history ("changed X from Y", "refactored old", "fixed previous").
- Do **not** add trailers: no `Co-Authored-By`, no `Claude-Session`, no links
  to chat sessions.
- Small, coherent commits are preferred over one giant commit.

## 3. Code quality

- TypeScript `strict`. No `any` unless unavoidable, and then with a comment
  saying why. No `@ts-ignore`.
- No `process.env` outside `src/config/`.
- Every file starts with a header comment block in the style of
  `relayer/src/*.ts`: what the file is for, and the key invariants.
- Every exported class, function and non-trivial private function has JSDoc
  explaining **why** it exists and any non-obvious behaviour (edge cases,
  ordering, idempotency, security reasoning). Do not narrate obvious code.
- Every Prisma model and non-obvious field has a `///` doc comment.
- Every DTO / response field has `@ApiProperty({ description, example })`.
- Errors are typed Nest exceptions with clear messages; never leak secrets,
  stack traces or email addresses to clients.
- Log with the injected pino logger and structured fields, never `console.log`.

## 4. Documentation (same branch as the code)

- `backend/CLAUDE.md`: keep the module map, invariants and commands current
  for everything your phase adds.
- `backend/.env.example` and `backend/docs/ENV.md`: every env var you add or
  change, with description, default, format, which roles need it and where to
  obtain the value.
- A module with non-trivial behaviour gets a short `README.md` in its folder
  if its header comments cannot carry the explanation alone.

## 5. Tests and checks

Before pushing, all of these must succeed from `backend/`:

```bash
corepack enable      # once per machine; pnpm version comes from package.json
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm test:cov        # unit tests + enforced coverage thresholds
pnpm prisma validate
pnpm test:e2e        # when the phase has e2e tests (needs: docker compose up -d postgres)
```

Tooling: Node.js 24 (`.nvmrc`), pnpm only (never npm or yarn; never commit a
`package-lock.json`), Vitest for all tests. New dependencies are added with
`pnpm add` at an exact version; a dependency that needs an install script
must be approved in `pnpm-workspace.yaml#allowBuilds` with a comment saying why.

Add the tests your phase file lists, plus whatever else keeps coverage above
the thresholds in `vitest.config.ts` (lines / functions / statements ≥ 90 %,
branches ≥ 85 %). Every service, guard, controller, processor loop and
helper you add ships with unit tests covering its success paths, error paths
and edge cases. Never lower a threshold or add coverage exclusions. Tests must
not depend on live RPCs, live email providers or network access beyond the
local Postgres.

## 6. Definition of done

- Every acceptance criterion in the phase file is met.
- All checks in §5 pass locally.
- Docs in §4 are updated.
- Commits follow §2 and the branch has no merge commits from `main` unless
  the reviewer asked for one.
- The handoff note (§2) is your final message.
