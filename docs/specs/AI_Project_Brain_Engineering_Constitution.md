# AI Project Brain - Engineering Constitution

## Purpose

This document defines mandatory engineering standards. Every
contribution, whether written by a human or an AI assistant, must follow
these rules.

# Core Principles

-   Build for maintainability before speed.
-   Prefer clarity over cleverness.
-   Follow Clean Architecture.
-   Apply SOLID principles.
-   Keep modules loosely coupled and highly cohesive.
-   Design for scalability from the beginning.
-   Security is built in, not added later.
-   Every feature must be testable.

# Project Structure

Organize backend using:

-   domain
-   application
-   infrastructure
-   presentation

Business logic must never live in controllers or UI components.

# Naming Conventions

-   Use descriptive names.
-   Avoid abbreviations.
-   Functions should describe actions.
-   Classes should represent concepts.
-   Files should have one primary responsibility.

# Code Quality

Every pull request must: - Pass linting - Pass formatting - Pass unit
tests - Pass integration tests - Include documentation where appropriate

Avoid: - Duplicate logic - Dead code - Large functions - God classes -
Circular dependencies

# API Standards

-   RESTful endpoints
-   Version APIs
-   Validate all input
-   Return consistent error responses
-   Use pagination where appropriate

# Security

-   Never hardcode secrets.
-   Use environment variables.
-   Enforce HTTPS.
-   Validate authorization on every protected endpoint.
-   Sanitize and validate all user input.
-   Apply rate limiting.
-   Log security-relevant events.

# Database

-   Use migrations only.
-   Add indexes intentionally.
-   Use transactions where required.
-   Preserve referential integrity.
-   Avoid N+1 queries.

# AI Standards

-   Use Retrieval-Augmented Generation.
-   Ground responses in retrieved code.
-   Cite relevant files internally.
-   Never fabricate project details.
-   Separate prompt construction from business logic.

# Frontend Standards

Use: - Next.js - TypeScript - Tailwind CSS - shadcn/ui - Lucide React

Keep components: - Small - Reusable - Accessible - Composable

# State Management

-   TanStack Query for server state.
-   Zustand for client state.
-   Avoid unnecessary global state.

# Accessibility

Meet WCAG 2.1 AA: - Keyboard navigation - Visible focus states -
Semantic HTML - Sufficient color contrast

# Performance

-   Lazy-load large modules.
-   Cache expensive operations.
-   Run long tasks in background workers.
-   Optimize database queries.
-   Measure before optimizing.

# Observability

Implement: - Structured logging - Error monitoring - Metrics - Request
tracing

# Testing

Minimum expectations: - Unit tests for business logic - Integration
tests for services - End-to-end tests for critical user flows

Do not merge code that reduces test reliability.

# Git Workflow

-   Feature branches
-   Small pull requests
-   Meaningful commit messages
-   Code review before merge
-   Protect the main branch

# Documentation

Every significant feature must include: - Architecture notes - API
updates - User-facing documentation (if applicable) - Architecture
Decision Records (ADRs) for major technical decisions

# Definition of Done

A task is complete only when: - Requirements are met - Tests pass -
Documentation is updated - Security considerations are addressed -
Performance is acceptable - Code review feedback is resolved

# Rule for AI Coding Assistants

When generating code: 1. Prefer maintainability over brevity. 2. Follow
existing project architecture. 3. Reuse existing abstractions. 4. Do not
introduce unnecessary dependencies. 5. Explain major architectural
decisions in comments or documentation when requested. 6. Never
sacrifice security for convenience. 7. Generate production-quality code,
not prototype code.

## Final Principle

Every engineering decision should answer: - Is it maintainable? - Is it
scalable? - Is it secure? - Is it testable? - Is it understandable by a
new engineer in six months? If the answer is no, redesign before
implementing.
