# AI Project Brain - Product & Engineering Specification

> Vision: Turn any GitHub repository into an interactive software
> engineering course.

## 1. Product Vision

This platform is **not** another AI chat over code. Its primary goal is
to **teach** a software project.

Users should leave understanding: - what the software does - why it
exists - architecture - technologies - developer decisions -
request/data flow - every important file - every important function

Think: GitHub + Interactive Course + AI Software Mentor.

## 2. Core Experience

### Repository Import

-   GitHub OAuth
-   Select repository
-   Clone repository
-   Store metadata
-   Queue indexing job

### Overview

Display: - Project summary - Technologies - Estimated learning time -
Difficulty - Architecture style - Folder map - Main features

### Learn Mode

Generate a structured course automatically.

Example modules: 1. Business problem 2. Tech stack 3. Architecture 4.
Folder structure 5. Backend 6. Database 7. Authentication 8. APIs 9.
Frontend 10. Deployment 11. Summary

The AI should reconstruct a logical build order instead of summarizing
the finished code.

### Code Explorer

For every file provide: - Purpose - Responsibilities - Dependencies -
Imports - Exports - Related files - Patterns - Functions

For every function: - Signature - Inputs - Outputs - Line-by-line
explanation - Business purpose - Side effects - Complexity - Related
concepts

### Flow Explorer

Automatically generate interactive flows:

User → Frontend → API → Controller → Service → Repository → Database →
Response

Every node clickable.

### Developer Thinking

Instead of only describing code, infer engineering intent.

Examples: - Why Repository pattern? - Why JWT? - Why dependency
injection? - Why caching? - Why this database?

### Documentation

Generate: - README - Architecture docs - API docs - Folder docs - Class
docs

## 3. Recommended Architecture

Frontend: - Next.js - TypeScript - Tailwind - shadcn/ui

Backend: - FastAPI - SQLAlchemy - Pydantic - Dependency Injection

Database: - PostgreSQL

Cache: - Redis

Queue: - Celery

Vector DB: - Qdrant

Parser: - Tree-sitter

Authentication: - GitHub OAuth

AI: - LLM behind backend service only

CI: - GitHub Actions

Container: - Docker

Monitoring: - Sentry

## 4. Clean Architecture

src/ - domain - application - infrastructure - presentation

Avoid putting business logic into controllers.

## 5. Backend Services

Repository Service AI Service Embedding Service Documentation Service
Course Generator Flow Generator Authentication Service

Each service should have a single responsibility.

## 6. Pipeline

Repository Imported → Clone → Parse AST → Build dependency graph → Chunk
code → Generate embeddings → Store vectors → Build project graph →
Generate course → Generate documentation → Ready

## 7. Database Design

Users Repositories Files Functions Embeddings Lessons Chats
GeneratedDocs Flows

## 8. AI

Use Retrieval Augmented Generation.

Never send the whole repository.

Pipeline: Question → Search vector DB → Retrieve relevant files → Build
prompt → LLM → Cite files used

## 9. Security

-   OAuth only
-   Validate GitHub webhook payloads
-   Rate limiting
-   Input validation
-   Secrets in environment variables
-   RBAC
-   Audit logs

## 10. Quality

Testing: - Unit - Integration - End-to-end

Formatting: - Black - Ruff - ESLint - Prettier

## 11. Future

-   VS Code extension
-   AI Software Architect
-   AI Git Assistant
-   AI Refactoring
-   Architecture diagrams
-   Multi-language support
