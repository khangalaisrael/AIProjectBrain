# Journey — where AI Project Brain stands, and what's next

A handoff document. Everything below is true as of commit `7860a38`, working
tree clean, `main` synced with `origin/main`.

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
| **Chat** | Docked RAG chat over the indexed code, with clickable citations |

### The Atlas (the centrepiece)

- **Architecture mode** — a semantic-zoom map. Zoom in to dive into the node
  under the crosshair, zoom out to surface. Breadcrumbs, Ctrl+K palette,
  fly-to camera, arrow-key navigation, minimap, focus-mode dimming.
- **Request Flow mode** — pick a route handler and *watch a request travel its
  call path*. Play/pause, step, 0.5×/1×/2×. The camera follows the active
  frame; the right panel syncs that step's source lines and an AI explanation
  of why it's called there.
- Built on a real knowledge graph: `repository → system → folder → file → class
  → function`, with `imports` / `calls` / `extends` / `implements` edges.
  Deeper edges **roll up** when you zoom out (a function→function call becomes
  a folder→folder dependency) — that's what makes the zoom semantic.

### Health

- **103 backend tests pass.** `ruff` + `black` clean.
- **Zero frontend tests. No CI.** (See §6.)
- 7 Alembic migrations, apply and roll back cleanly.

---

## 3. Running it

Docker Desktop must be running first, or **indexing fails at the embedding step**.

```bash
docker compose up -d          # Postgres, Redis, Qdrant

cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000

cd frontend
npm run dev                   # http://localhost:3000
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
5. **`/atlas` ships a ~443 kB bundle** because ELK's solver is bundled.
6. **The API doc generator once claimed this project "has no HTTP API"** — it
   only saw function *names*. It now reads the source of route files. If you add
   a new doc type, remember the model can only reason about what you feed it.

---

## 6. What to do next

Ordered by what I'd actually pick up first.

### Tier 1 — stops regressions

- [ ] **CI.** Nothing runs on push. A GitHub Actions workflow doing
      `pytest` + `ruff` + `black --check` for the backend and
      `npm run build` + `lint` + `format:check` for the frontend would have
      caught the dead-CSS-class bug and the `vars()`-on-slots bug immediately.
- [ ] **Frontend tests.** There are none. Start with the pieces that hold
      logic, not markup: `useResizable` (clamping, persistence),
      `lib/api.ts` error handling, the Atlas ancestor-chain walk.

### Tier 2 — finish the spec

- [ ] **Remaining Atlas modes**: Authentication, Dependency, Database, Event
      Flow, Deployment. Each is *filtering and highlighting the same graph* —
      far cheaper than Request Flow was. Suggested first: **Dependency**
      (highlight only `imports` edges, fade the rest).
- [ ] **Journey Mode** — the atlas grows lesson by lesson, tied to the Learn
      course. Needs a mapping from lesson → graph nodes.
- [ ] **Zoom levels L5 (execution steps) and L6 (source)** — L5 is essentially
      Request Flow rendered inside the map; L6 is the details panel's source
      view, promoted onto the canvas.

### Tier 3 — polish and product

- [ ] **Stream chat responses** token-by-token; **persist chat history**.
- [ ] **Lazy-load ELK** to cut the `/atlas` bundle.
- [ ] **Highlight the full active path** in focus mode, not just direct
      neighbours (BFS already computes tiers; extend to a call chain).
- [ ] **Re-index `octocat/Hello-World`** or drop it — it has no code, so it
      produces an empty graph and an empty course.

### Tier 4 — production readiness (nothing exists yet)

- [ ] Rate limiting, audit logs, RBAC — all named in the SRS, none implemented.
- [ ] Dockerfiles for the apps themselves (compose only runs the datastores).
- [ ] A real Celery worker + Redis in the deployed path
      (`CELERY_TASK_ALWAYS_EAGER` is a dev shortcut).
- [ ] Monitoring / Sentry (`SENTRY_DSN` is wired in config but unused).

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
  lib/               api client, hooks, zustand stores, useResizable
```

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
