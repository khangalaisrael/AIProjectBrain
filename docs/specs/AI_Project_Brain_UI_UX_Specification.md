# AI Project Brain - UI/UX Design Specification

## Design Philosophy

Build a premium developer experience inspired by: - Linear - GitHub -
Vercel - Raycast - Notion - Stripe Dashboard - Cursor IDE

The application should feel like a professional engineering tool rather
than an AI chatbot.

## Visual Style

-   Dark mode first, light mode supported.
-   Minimal, spacious, modern.
-   Neutral colors (Slate, Zinc, Gray).
-   One accent color (Blue, Indigo or Emerald).
-   Avoid AI-themed gradients and flashy effects.

## Typography

Fonts: - Geist - Inter

Clear visual hierarchy: - Page titles - Section headings - Card
headings - Body text - Captions

## Icons

Use Lucide React icons only.

## Components

Use shadcn/ui for all reusable components unless there is a compelling
reason not to.

## Layout

Maximum width: \~1400px

Layout: - Collapsible sidebar - Top navigation - Main content - Optional
right information panel

## Sidebar

Sections: - Dashboard - Repositories - Overview - Learn - Code
Explorer - Flow Explorer - Developer Thinking - Documentation - Settings

## Dashboard

Show: - Recent repositories - Continue learning - Documentation -
Activity - Statistics

## Overview

Present: - Project summary - Technologies - Architecture - Learning
time - Difficulty - Features

## Learn Mode

Three-column layout: - Lesson navigation - Lesson content - Key concepts
/ reading time

Generate structured lessons instead of summaries.

## Code Explorer

Three-column layout: - Repository tree - Code viewer - AI explanation
panel

Explain files, classes, and functions without requiring chat.

## Flow Explorer

Interactive diagrams with: - Zoom - Pan - Clickable nodes - Highlighted
request paths

## Developer Thinking

For every important design decision show: - Decision - Reason -
Trade-offs - Alternatives

## Documentation

Tabs: - README - API - Architecture - Classes - Folders

Support Markdown and PDF export.

## Search

Global search (Ctrl+K).

Search across: - Files - Functions - Lessons - Documentation -
Repositories - Chats

## AI Chat

Chat is a secondary feature. It should appear as a docked panel or
slide-over instead of dominating the interface.

## Animations

Use subtle animations only: - Fade - Slide - Expand - Hover elevation

## Accessibility

Target WCAG 2.1 AA.

Support: - Keyboard navigation - Screen readers - Visible focus states

## Empty States

Always provide guidance and suggested actions.

## Loading States

Prefer skeleton loaders over spinners.

# Additional Engineering Requirements

## Frontend

-   Next.js
-   TypeScript
-   Tailwind CSS

## UI Components

-   shadcn/ui

## Icons

-   Lucide React

## Animations

-   Framer Motion Use only subtle animations.

## Diagrams

Use: - React Flow for interactive architecture diagrams. - Mermaid for
generated documentation diagrams.

## State Management

Use: - TanStack Query for server state. - Zustand for lightweight client
state.

Avoid unnecessary global state.

## Forms

Use: - React Hook Form - Zod validation

## Data Tables

Use TanStack Table.

## Charts

Use Recharts only when visualizations are required.

## Design Rules for Claude

-   Never generate cluttered dashboards.
-   Prioritize whitespace.
-   Prefer cards over large text blocks.
-   Keep AI explanations contextual instead of chat-first.
-   Use responsive layouts.
-   Ensure consistent spacing.
-   Reuse components instead of duplicating UI.
-   Build accessible components.
-   Keep color usage minimal.
-   Every page should clearly answer:
    1.  Where am I?
    2.  What can I do?
    3.  What should I do next?

The final result should resemble a polished developer platform rather
than a generic AI application.
