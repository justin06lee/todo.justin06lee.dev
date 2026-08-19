<div align="center">

<img src="assets/todo.svg" alt="todo" width="330" />

# todo.justin06lee.dev

**Categories, tasks, and notes — a public reference list only the owner can edit.**<br>
*The simplest possible notion-shaped thing.*

</div>

---

Two surfaces for people (plus an [admin API](#admin-api) for scripts):

- **`/` — the board.** Categories, each with a color from the house palette,
  each holding a flat list of tasks. The owner adds, checks off, renames
  inline, recolors, clears the completed, deletes; everyone else gets the same
  board read-only. It is deliberately a *list you reference*, not a kanban —
  order is creation order and stays put.
- **`/notes` — the notes.** Named pages of markdown, like a doc without the
  ceremony. For the owner each note opens in a split-pane editor (chrome's
  `editor` + `prose`) with two-way scroll sync — the body saves explicitly
  with the save button or cmd/ctrl+s, the title commits on blur. For everyone
  else a public note is a rendered read-only page.

**Public read, owner write.** The site is readable without signing in;
`ADMIN_KEY` unlocks editing and the private items. Categories (tasks inherit
their category) and notes each carry an `is_public` flag — public by default,
private as the per-item opt-out (a checkbox on the new-category form, a menu
item on existing categories, a switch in the note editor). Private rows are
filtered in SQL and never leave the database for an anonymous request, and a
private note answers 404, not 403, so its url doesn't leak that it exists.
Every mutating server action still re-checks the session itself (a layout gate
has never been a boundary; see the sibling repos).

## Stack

The house seven: bun, Next.js (App Router) + React, TypeScript, Tailwind v4,
Turso/libSQL with raw SQL, motion, and [chrome](https://chrome.justin06lee.dev)
components vendored via the CLI. Dark-only, square corners, lowercase.

Data lives in the **shared Turso instance**, namespaced `todo_`:
`todo_categories`, `todo_tasks`, `todo_notes`, `todo_sessions`,
`todo_login_attempts`. The schema is bootstrapped by an idempotent, memoized
`initDb()` on the first request of a cold start — which means **running the
app migrates the database, `next dev` included**. With no `TURSO_DATABASE_URL`
the app opens `file:.data/todo.db` instead, so a fresh clone runs with no
environment at all; point the variable at `file:./scratch.db` when you want a
throwaway.

Two inherited quirks worth knowing:

- **No foreign keys are enforced** (libsql never enables the pragma), so
  deleting a category deletes its tasks in the same `db.batch`, and creating a
  task is a single `INSERT … WHERE EXISTS` so it can't orphan itself under a
  concurrent category delete.
- **Category colors are the calendar's fixed 8-hex palette** (`lib/colors.ts`),
  validated server-side — the one place this site spends color.

## Auth

Auth exists for writing, not reading. The shape is `hours.justin06lee.dev`'s,
verbatim: `ADMIN_KEY` compared with a constant-time digest compare, DB-backed
sessions (sha256 of the token, never the token), httpOnly cookie, and a harsh
per-IP limiter — 10 attempts per 15 minutes, then a 24-hour lockout. Sessions
are per-site even though the password is shared. **Never add a retry loop
around login.**

## Admin API

Everything the owner can do in the UI is also reachable over HTTP at
`/api/*`, for scripted callers (the MCP server that drives this site). Same
code underneath: the routes call the same `lib/` writers as the server
actions, enforce the same limits, and make the same `revalidatePath` calls —
a mutation through the API never leaves a page serving stale data. The
differences are wire-shaped, and deliberate:

- **JSON always.** Errors come back as `{error}` with a real status code; an
  unauthenticated call gets `401 {"error":"Unauthorized"}`, never a redirect.
- **Truthful 404s.** The server actions are blind-success on missing ids (an
  UPDATE of zero rows is not an error the UI can act on); the API checks
  existence first and says not found.
- **Same auth, same cookie.** `POST /api/auth` exchanges the password for the
  exact `admin_session` cookie the login form sets, behind the same rate
  limiter — the retry-loop warning above applies to this route too.

| route | body | notes |
|---|---|---|
| `POST /api/auth` | `{password}` | 200 sets the session cookie; 401 wrong, 429 rate-limited, 413 oversized, 503 no `ADMIN_KEY` |
| `GET /api/auth` | — | 200 with a live session, else 401 |
| `DELETE /api/auth` | — | sign out; always 200 |
| `GET /api/board` | — | full board, private included, tasks nested per category |
| `POST /api/categories` | `{name, color, isPublic?}` | 201; 409 on a duplicate name |
| `PATCH /api/categories/:id` | `{name?, color?, isPublic?}` | 404 missing; 409 renaming onto a taken name |
| `DELETE /api/categories/:id` | — | app-level cascade; reports `deletedTasks` |
| `POST /api/categories/:id/clear-done` | — | reports `cleared` |
| `POST /api/tasks` | `{categoryId, title}` | 201; 404 when the category is gone |
| `PATCH /api/tasks/:id` | `{title?, done?}` | |
| `DELETE /api/tasks/:id` | — | |
| `GET /api/notes` | — | list, private included, bodies excluded |
| `POST /api/notes` | `{title?, content?, isPublic?}` | 201; defaults `untitled` / empty / public |
| `GET /api/notes/:id` | — | the full note, body included |
| `PATCH /api/notes/:id` | `{title?, content?, isPublic?}` | |
| `DELETE /api/notes/:id` | — | |

Everything past `/api/auth` is owner-only — the anonymous read surface is the
site itself, not the API. Ids are `crypto.randomUUID()` shapes; anything else
is a 400 before it reaches a query.

## Development

```bash
bun install
bun run dev        # http://localhost:3000 — uses file:.data/todo.db without env
```

Environment (`.env.example` has the names; all optional locally):

| variable | purpose |
|---|---|
| `TURSO_DATABASE_URL` | the shared Turso instance; unset → local sqlite file |
| `TURSO_AUTH_TOKEN` | its token |
| `ADMIN_KEY` | the shared master password; unset → login disabled, site still runs |

Scripts: `bun run dev`, `bun run build`, `bun run start`, `bun run lint`,
`bun run typecheck`, `bun run test` (vitest — the pure modules `lib/validate.ts`
and `lib/format-time.ts` keep their tests beside them, free of DB or env
coupling so the parts that decide correctness are testable alone).

Deploys on Vercel, default settings.
