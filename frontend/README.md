# AI Project Brain — Frontend

Next.js (App Router) + TypeScript + Tailwind CSS v4, dark-first, following the
[UI/UX Specification](../docs/specs/AI_Project_Brain_UI_UX_Specification.md).

## Structure

```
app/
  layout.tsx          Root layout (dark-first, providers)
  page.tsx            Redirects to /dashboard
  (app)/
    layout.tsx        App shell: collapsible sidebar + top nav (max-w 1400px)
    <page>/page.tsx   The 9 primary pages (placeholders with empty states)
components/
  layout/             Sidebar, top nav, page header
  ui/                 shadcn-style primitives (button, card, empty-state)
  providers.tsx       TanStack Query provider
lib/
  api.ts              Typed fetch client → backend /api/v1
  nav.ts              Sidebar navigation config
  utils.ts            cn() class-name helper
```

Included but not yet wired into features (ready for later phases): Framer Motion
(subtle transitions), Zustand, React Hook Form + Zod. Diagrams (React Flow,
Mermaid) and tables/charts are added when those features land.

## Develop

```bash
npm install
npm run dev            # http://localhost:3000 → /dashboard

npm run lint           # ESLint
npm run format:check   # Prettier
npm run build          # production build
```

Set `NEXT_PUBLIC_API_BASE_URL` (see root `.env.example`) to point at the backend.
