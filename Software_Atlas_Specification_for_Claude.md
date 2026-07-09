# Software Atlas Specification for Claude

# CRITICAL IMPLEMENTATION REQUIREMENT

**Do NOT build a traditional React Flow diagram.**

This project must **not** look like a node editor, flowchart, or dependency graph.

React Flow is **only the rendering engine** for the canvas.

The user experience must resemble:

- Google Maps
- Figma Infinite Canvas
- Miro
- Modern game world maps

Think of React Flow as the graphics engine—not the product.

---

# Vision

Build a **Software Atlas**: an infinite, zoomable, semantic map of a software project.

Users should feel like they are exploring a living software system rather than reading documentation.

---

# Semantic Zoom (Mandatory)

Zooming is NOT visual scaling.

Every zoom level reveals different information.

Level 0
- Repository
- Frontend
- Backend
- Database
- Infrastructure

Level 1
- Modules

Level 2
- Packages / Services

Level 3
- Classes

Level 4
- Functions

Level 5
- Execution steps

Level 6
- Source code

Never show every node at once.

---

# Infinite Canvas

One continuous canvas.

Do not navigate between pages to inspect code.

The camera moves through the project.

---

# Camera Behavior

Implement smooth:
- Pan
- Zoom
- Fly-to animations
- Focus transitions

Searching or selecting an item should animate the camera to it.

---

# Progressive Disclosure

Only render information appropriate to the current zoom level.

As users zoom in:
- reveal more nodes
- reveal more relationships
- reveal implementation details

As users zoom out:
- simplify automatically

---

# Knowledge Graph

Render a graph built from static analysis.

Nodes:
- Repository
- Folder
- File
- Class
- Function
- API
- Database
- Queue
- External Service

Edges:
- imports
- calls
- depends_on
- queries
- implements
- extends

---

# Modes

Support:
- Architecture
- Request Flow
- Authentication
- Dependency
- Database
- Deployment
- Event Flow

Each mode reuses the same graph with different highlighting.

---

# Animated Request Replay

Animate requests traveling through the graph.

Highlight each node and edge.

Synchronize:
- source code
- AI explanation
- execution path

---

# Journey Mode

Reconstruct the application gradually.

The atlas grows lesson by lesson.

---

# UI

Dark mode first.

Clean.

Minimal.

No clutter.

Large whitespace.

No dense flowcharts.

---

# Technology

Use:
- React Flow (canvas only)
- ELK.js (automatic layout)
- Framer Motion
- Graphology
- Tree-sitter

Do NOT expose React Flow's default editor appearance.

Customize nodes, edges, controls, minimap, and interactions to create a unique product.

---

# Success Criteria

A user should say:

"This feels like Google Maps for software."

They should NOT say:

"This looks like a React Flow diagram."
