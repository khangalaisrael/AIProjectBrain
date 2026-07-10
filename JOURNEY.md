# Journey — where AI Project Brain stands, and what's next

A handoff document. Everything below is true as of the Tier-1 work (CI + the
first frontend tests) landing on `main`.

---

## 1. What this is

Turns any GitHub repository into an interactive software-engineering course.
Import a repo → it's cloned, parsed with Tree-sitter, embedded into Qdrant, and
a knowledge graph is built. You can then read a generated course, browse the
code with AI explanations, ask questions over RAG, and explore a zoomable map of
the system.

Built from the specs in [`docs/specs/`](docs/specs/) plus
`Software_Atlas_Specification_for_Claude.md` and
`Software_Atlas_Design_Language_v2.md`.

**Stack:** FastAPI + SQLAlchemy + Alembic (Clean Architecture: `domain /
application / infrastructure / presentation`) · Next.js 15 App Router +
TypeScript + Tailwind v4 · Qdrant · Celery · OpenAI (`gpt-4o`,
`text-embedding-3-small`) · Tree-sitter · React Flow + ELK.

---

## 2. What works today

Every sidebar page is real. Nothing is a placeholder.

| Page | What it does |
| --- | --- |
| **Dashboard** | Recent repositories and their indexing status |
| **Repositories** | Import your own repos *or search & import any public repo*; live status badges |
| **Overview** | LLM summary: stack, difficulty, learning time, architecture, folder map |
| **Learn** | Auto-generated 8–11 lesson course in logical build order |
| **Code Explorer** | File tree → syntax-highlighted source → functions + on-demand AI explanation |
| **Atlas** | Zoomable knowledge-graph map (see below) |
| **Developer Thinking** | Inferred engineering decisions with reason / trade-offs / alternatives |
| **Documentation** | Generated README / API / Architecture / Folders, with copy + `.md` export |
| **Chat** | Docked RAG chat over the indexed code, streamed token by token, with clickable citations and a thread that survives reload |

### The Atlas (the centrepiece)

- **Architecture mode** — a semantic-zoom map. Zoom in to dive into the node
  under the crosshair, zoom out to surface. Breadcrumbs, Ctrl+K palette,
  fly-to camera, arrow-key navigation, minimap, focus-mode dimming.
- **Request Flow mode** — pick a route handler and *watch a request travel its
  call path*. Play/pause, step, 0.5×/1×/2×. The camera follows the active
  frame; the right panel syncs that step's source lines and an AI explanation
  of why it's called there.
- **Dependency mode** — the same map with `imports` lit and everything else
  faded, so you can see what a module actually depends on. Where a scope has no
  imports at all (the repository root, whose halves talk over HTTP) the mode
  stands down rather than greying out the map.
- **Database mode** — lights ORM model classes and every folder that contains
  one. Needs a re-index for repositories imported before it existed.
- Built on a real knowledge graph: `repository → system → folder → file → class
  → function`, with `imports` / `calls` / `extends` / `implements` edges.
  Deeper edges **roll up** when you zoom out (a function→function call becomes
  a folder→folder dependency) — that's what makes the zoom semantic.

### Health

- **125 backend tests pass.** `ruff` + `black` clean.
- **88 frontend tests pass** (Vitest + Testing Library), covering `use-resizable`,
  the `apiFetch` client and its SSE stream, the Atlas graph helpers, and the ELK
  layout functions.
- **CI runs both suites on every push and pull request** —
  [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
- 7 Alembic migrations, apply and roll back cleanly.

---

## 3. Running it

Docker Desktop must be running first, or **indexing fails at the embedding step**.

```bash
docker compose up -d          # Postgres, Redis, Qdrant

# ...or run the whole stack in containers, with a real Celery worker:
docker compose --profile apps up -d --build

cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000

cd frontend
npm run dev                   # http://localhost:3000
npm test                      # watch mode; `npm run test:run` for one shot
```

**Windows quirks on this machine**
- Use the `py` launcher; bare `python` is a Store alias. The venv interpreter is
  `backend/.venv/Scripts/python.exe`.
- **Never run `npm run build` while `npm run dev` is running** — it clobbers the
  dev server's `.next` and every route starts 404ing. Stop the dev server first.
- Killing a background server with the task runner sometimes leaves the port
  held. If a restart fails to bind, kill the PID on the port explicitly.

**Local dev shortcuts already configured in `.env`**
- `DATABASE_URL=sqlite:///./dev.db` — no Postgres needed to try things.
- `CELERY_TASK_ALWAYS_EAGER=true` — indexing runs inline; no Redis worker needed.
  (Import blocks for ~10–20s while it clones, parses, and embeds.)

---

## 4. Secrets

`.env` is gitignored and holds all of them. `.env.example` documents each one.

- `TOKEN_ENCRYPTION_KEY` — Fernet key. **GitHub access tokens are encrypted at
  rest.** Lose this key and every user must sign in again.
- `OPENAI_API_KEY`, `GITHUB_OAUTH_CLIENT_ID` / `_SECRET`, `JWT_SECRET`.

Both the OpenAI key and the GitHub client secret were rotated on 2026-07-10.
Rotating the client secret does **not** invalidate already-issued user tokens.

---

## 5. Honest limitations

Read these before trusting the graph or the replay.

1. **Call and import edges are name-based heuristics.** No type inference. When
   a name is ambiguous (two functions share it) the edge is **skipped, never
   guessed** — there's a test enforcing this. The graph *under-reports* rather
   than lying. This is why `_owned_repo`, defined in seven modules, has no
   incoming call edges.
2. **Request Flow is a static call trace, not a runtime profile.** No
   conditionals, loops, or dynamic dispatch. A real request may touch functions
   the replay doesn't show. Depth is capped at 6, steps at 40.
3. **Level 0 of the Atlas has no edges** for this repo — backend and frontend
   genuinely don't import each other, they talk over HTTP. Correct data, sparse
   map at world zoom.
4. **A repo imported before the Atlas existed has no graph** and shows the
   "no map yet" empty state. Re-index it to fix.
5. **The Atlas still downloads ELK's ~440 kB solver**, just not as part of the
   route bundle — it now loads on first layout. Deferred, not eliminated.
6. **The API doc generator once claimed this project "has no HTTP API"** — it
   only saw function *names*. It now reads the source of route files. If you add
   a new doc type, remember the model can only reason about what you feed it.

---

## 6. What to do next

Ordered by what I'd actually pick up first.

### Tier 1 — stops regressions ✅ done

- [x] **CI.** `.github/workflows/ci.yml` runs `ruff` + `black --check` + `pytest`
      for the backend and `lint` + `format:check` + `test:run` + `build` for the
      frontend, on every push and PR.
- [x] **Frontend tests.** Vitest + jsdom. 37 tests over the pieces that hold
      logic, not markup: `lib/use-resizable.ts`, `lib/api.ts`, and the Atlas
      ancestor-chain walk (extracted to `lib/atlas-graph.ts` to make it testable).

  **If you add backend tests, note:** CI must export a `TOKEN_ENCRYPTION_KEY`.
  `Settings` defaults it to `""` and `crypto._cipher()` raises on an empty key,
  so the `user` / `auth_headers` fixtures — which write an encrypted access
  token — take down ~60 tests without it. Locally the gitignored `.env` hides
  this. The workflow hardcodes a throwaway Fernet key; it protects nothing.

### Tier 2 — finish the spec

- [x] **Dependency mode.** `AtlasCanvas` takes an `emphasisKinds` prop; the mode
      lights `imports` and fades the rest. Roll-up preserves edge kind, so it
      works at every zoom.

- [x] **Database mode.** The first mode that needed new *graph data*.
      `graph_builder` flags ORM model classes with `meta.has_models` and
      propagates the flag to every ancestor, so the database layer survives
      zooming out. `AtlasCanvas` gained `emphasisMeta` for modes about what a
      node *is* rather than how it connects.

- [ ] **The last three modes still need graph data that does not exist.** An
      earlier version of this doc claimed each mode was "just filtering and
      highlighting the same graph." That was only true of Dependency. The graph
      has exactly three edge kinds — `imports`, `calls`, `extends` — and node
      kinds `repository / system / folder / file / class / function / external`.
      Nothing marks a route, an event emitter, a deployment target, or an auth
      boundary.

      So each remaining mode is a **`graph_builder` feature first**:
      Authentication needs auth middleware/decorator detection; Event Flow needs
      emitter/subscriber edges; Deployment needs to parse compose/Dockerfiles.
      Once the data exists, the frontend side really is one entry in `EMPHASIS`
      or `EMPHASIS_META` in `app/(app)/atlas/page.tsx`. Follow the Database
      mode: detect precisely, flag the node, propagate to ancestors.

      **Anything already indexed predates the flag** and shows the mode's
      stand-down notice until it is re-indexed.
- [ ] **Journey Mode** — the atlas grows lesson by lesson, tied to the Learn
      course. Needs a mapping from lesson → graph nodes.
- [ ] **Zoom levels L5 (execution steps) and L6 (source)** — L5 is essentially
      Request Flow rendered inside the map; L6 is the details panel's source
      view, promoted onto the canvas.

### Tier 3 — polish and product

- [x] **Streamed chat + persisted history.** `POST /chat/stream` serves the
      answer as server-sent events (tokens first, citations last); a
      `chat_messages` table keyed by *(repository, user)* keeps the thread. The
      question is stored before the first token, so a stream that dies mid-answer
      still leaves the thread coherent. SSE framing lives in `lib/sse.ts` —
      `fetch` splits bytes wherever it likes.
- [x] **Lazy-load ELK.** `/atlas` first load went 802 kB → 371 kB (route JS
      444 kB → 12.4 kB). ELK now arrives in its own chunk on first layout.
- [x] **Focus mode lights the whole chain**, following edge direction: what the
      selection reaches downstream plus what reaches it upstream. It lights
      *fewer* nodes than the old two-hop undirected walk, because dropping
      siblings beats reaching further.
- [ ] **Re-index `octocat/Hello-World`** or drop it — it has no code, so it
      produces an empty graph and an empty course.

### Tier 4 — production readiness

- [x] **Dockerfiles + a real Celery worker.** `docker compose up -d` still
      starts only the datastores; `docker compose --profile apps up -d --build`
      brings up the whole stack with a Redis-backed worker.

      This uncovered a bug eager mode was hiding: nothing imported
      `app.infrastructure.tasks` except `repository_service`, lazily, inside the
      web process. **A worker started the documented way registered zero tasks**
      and would have answered `index_repository` with `NotRegistered`. Celery's
      `include=` fixes it; a test asserts a bare worker can see the task.

- [ ] Rate limiting, audit logs, RBAC — all named in the SRS, none implemented.
      These are security surfaces; they want a spec, not a guess.
- [ ] Monitoring / Sentry (`SENTRY_DSN` is wired in config but unused).
- [ ] The compose `apps` profile is a *deployable shape*, not a deployment: no
      TLS, no secrets manager, no healthcheck on the app containers.

---

## 7. Map of the code

```
backend/app/
  domain/          entities + enums (NodeKind, EdgeKind, ImportStatus, DocType)
  application/     use cases — one service per feature:
                     indexing, embedding, chat (RAG), explorer, overview,
                     course, thinking, docs, graph_builder, graph, flow
  infrastructure/  db (models, repositories), github client, openai clients,
                   qdrant store, tree_sitter parser, celery tasks
  presentation/    FastAPI routers under /api/v1, schemas, dependencies
  core/            config, logging, security (JWT), crypto (Fernet)

frontend/
  app/(app)/       one folder per sidebar page
  components/atlas/  the map: canvas, nodes, edges, layout, panels, flow replay
  components/chat/   docked RAG chat + markdown renderer
  lib/               api client, hooks, zustand stores, use-resizable,
                     atlas-graph (pure graph helpers), *.test.ts
```

Tests live next to the code they cover (`lib/api.ts` → `lib/api.test.ts`) and are
excluded from `tsconfig.json` so `next build` doesn't type-check them.

**Patterns worth following.** Every generated feature (Overview, Learn,
Thinking, Docs) uses the same shape: a service builds context from the indexed
data, calls the LLM, caches the result in its own table, and exposes
`GET` (cached) + `POST` (regenerate). Copy that shape for anything new.
Ownership is always checked with a local `_owned_repo` helper.

---

## 8. Where things live

- Repo: <https://github.com/khangalaisrael/AIProjectBrain>
- Specs: [`docs/specs/`](docs/specs/), plus the two Atlas markdown files at root.
- Indexed locally right now: `khangalaisrael/AIProjectBrain` (599 graph nodes),
  `psf/requests` (925 nodes), `MadsLorentzen/ai-job-search`,
  `khangalaisrael/cpt-explorer`, `octocat/Hello-World` (empty — no code).
