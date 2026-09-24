# Backend v2 — Contributor Rules

These rules apply to every change under `backend/`, whoever or whatever writes
it. Read this file and [`SPEC.md`](./SPEC.md) fully before starting a phase.

## 1. Boundaries

- Work only inside `backend/`. Do not modify `frontend/`, `relayer/`,
  `server/`, `evm/`, `solana/`, `solana_old/` or `cosmwasm/`. Read them freely:
  `relayer/src/` is the reference implementation for all chain logic.
- Implement exactly the phase you were given. Do not start work that belongs
  to another phase, even if it looks small.
- Do not edit `docs/SPEC.md` or other phase files. If the spec is wrong,
  ambiguous or impossible, choose the most conservative option, implement it,
  and list it under **Spec questions** in the PR description.
- Only phase 1 edits `prisma/schema.prisma` and `prisma/migrations/` unless the
  phase file says otherwise.

## 2. Git

- Before the first commit, set the repository author identity (the container
  default must not be used):
  `git config user.name "Obum" && git config user.email "obuumm@gmail.com"`.
  Check with `git log --format='%an <%ae>' -1` after committing.
- Start from the latest `backend-v2`:
  `git fetch origin backend-v2 && git checkout -B <your-branch> origin/backend-v2`.
- Push only to the branch named in your phase file.
- Open one pull request from that branch into **`backend-v2`** (never `main`).
- Never force-push to `backend-v2` or rewrite its history.

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

### Pull request description

- Title in the same style as a commit subject.
- Body sections: **Summary** (what the PR adds), **How to verify** (exact
  commands), **Env changes** (new/changed vars, or "none"), **Spec questions**
  (or "none").
- No "Generated with …" footer, no session links, no mention of AI or agents.
- Do not post PR comments or reviews unless replying to a review comment.

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

## 4. Documentation (same PR as the code)

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
npm run lint
npm run build
npm test
npx prisma validate
npm run test:e2e   # when the phase has e2e tests (needs: docker compose up -d postgres)
```

Add the tests your phase file lists. Tests must not depend on live RPCs,
live email providers or network access beyond the local Postgres.

## 6. Definition of done

- Every acceptance criterion in the phase file is met.
- All checks in §5 pass locally.
- Docs in §4 are updated.
- Commits and PR follow §2.
- The PR into `backend-v2` is open.
