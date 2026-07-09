# AI Project Brain

> Turn any GitHub repository into an interactive software engineering course.

AI Project Brain analyzes a codebase and teaches it — explaining *what* the
software does, *why* it exists, its architecture, and the engineering decisions
behind it, using a Tree-sitter → embeddings → vector-search → RAG pipeline.

This repository currently contains the **project scaffold**: a runnable,
standards-compliant skeleton with tooling and structure in place, but **no
feature logic yet**. See [`docs/specs/`](docs/specs/) for the full product and
engineering specifications that drive the roadmap.

## Stack

| Layer         | Technology                                                    |
| ------------- | ------------------------------------------------------------- |
| Frontend      | Next.js (App Router), TypeScript, Tailwind, shadcn/ui         |
| Backend       | FastAPI, SQLAlchemy, Pydantic (Clean Architecture)            |
| Database      | PostgreSQL                                                     |
| Cache / Queue | Redis, Celery                                                 |
| Vector DB     | Qdrant                                                         |
| Parser        | Tree-sitter                                                   |
| Auth          | GitHub OAuth                                                  |

## Repository layout

```
.
├── backend/        FastAPI service — domain / application / infrastructure / presentation
├── frontend/       Next.js app — dashboard, learn, code explorer, flow explorer, docs …
├── docs/specs/     Product & engineering specifications (SRS, UI/UX, Constitution, …)
├── docker-compose.yml   Local Postgres + Redis + Qdrant
├── .env.example    Environment template — copy to `.env`
└── README.md
```

## Getting started

### Prerequisites

- **Node.js** ≥ 20 and npm
- **Python** ≥ 3.11
- **Docker Desktop** (for the Postgres / Redis / Qdrant dev services)

### 1. Configure environment

```bash
cp .env.example .env
# edit .env and fill in secrets as needed
```

### 2. Start backing services

```bash
docker compose up -d      # Postgres, Redis, Qdrant
docker compose ps         # confirm all healthy
```

### 3. Run the backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate     |  macOS/Linux:  source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
# → http://localhost:8000/api/v1/health  should return {"status":"ok"}
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000  (redirects to /dashboard)
```

## Quality gates

Every contribution must pass linting, formatting, and tests, per the
[Engineering Constitution](docs/specs/AI_Project_Brain_Engineering_Constitution.md).

```bash
# Backend
cd backend && ruff check . && black --check . && pytest

# Frontend
cd frontend && npm run lint && npm run build
```

## Roadmap

- **Phase 1 – Foundation:** GitHub OAuth, repository import, cloning, parsing, database.
- **Phase 2 – Knowledge Engine:** embeddings, vector search, RAG.
- **Phase 3 – Learning Platform:** overview, learn mode, code explorer, documentation.
- **Phase 4 – Advanced:** flow explorer, developer thinking.
- **Phase 5 – Future:** VS Code extension, AI software architect, git assistant.
