# Software Atlas Design Language v2

## Vision

Software Atlas should not feel like a graph editor.

It should feel like a premium operating system for exploring software.

Users should immediately think:
- "This feels beautiful."
- "This feels intuitive."
- "I've never explored code like this before."

Never let users think:
- "This is React Flow."
- "This is another node graph."
- "This looks like a UML diagram."

**React Flow is only the rendering engine.**
The design language must be entirely custom.

---

# Design DNA

## Linear
Use:
- Excellent spacing
- Minimal interface
- Premium typography
- Elegant cards
- Smooth transitions

## Figma
Use:
- Infinite canvas
- Spatial navigation
- Smooth pan
- Camera movement
- Object focus

## Apple
Use:
- Premium typography
- Restrained color palette
- Refined animations
- Generous whitespace

## Notion
Use:
- Clear information hierarchy
- Readable documentation
- Simple layouts

## Google Maps
Copy the navigation philosophy:
- Semantic exploration
- Progressive disclosure
- Camera fly animations
- Minimap
- Breadcrumb awareness

Do NOT copy the visual design.

---

# Software Cards (Not Nodes)

Never use default React Flow nodes.

Everything is a Software Card.

Each card contains:
- Icon
- Title
- Type
- One-line description
- Minimal metadata

Cards should be readable in under two seconds.

---

# Card Design

- 18–20px radius
- Thin border
- Soft shadow
- Spacious padding
- Subtle hover lift
- Gentle selection glow

No harsh effects.

---

# Connections

- Thin curved lines
- Animated only when useful
- Fade unrelated edges
- Highlight the active path

Avoid spider-web graphs.

---

# Focus Mode

Selected card: 100%
Connected cards: 70%
Nearby cards: 40%
Everything else: 20%

The interface should naturally guide attention.

---

# Navigation

Use semantic drill-down instead of relying on mouse-wheel zoom.

Repository
→ Subsystem
→ Module
→ Class
→ Function
→ Execution
→ Code

Include:
- Breadcrumbs
- Ctrl+K search
- Fly-to camera
- Keyboard navigation
- Optional minimap

---

# Context Panel

Keep details off the canvas.

Display:
- AI explanation
- Documentation
- Dependencies
- Related files
- Metrics
- Source preview

---

# Motion

Use Framer Motion.

Animations:
- Camera fly
- Fade
- Expand
- Collapse
- Edge flow
- Card lift

Animations should communicate structure.

---

# Color

Dark-first.

Primary:
- Slate
- Zinc
- Neutral Gray

Accent:
- Blue or Indigo

Use color sparingly.

---

# Claude Rules

1. React Flow is only the rendering engine.
2. Build custom card components.
3. Never resemble a traditional node editor.
4. Prioritize whitespace.
5. Build an experience that feels like exploring software.
6. Blend the polish of Linear, the navigation of Figma, the clarity of Notion, the refinement of Apple, and the exploration philosophy of Google Maps.

---

# Success Criteria

Users should say:
"This feels like a premium Software Atlas."

They should never say:
"This looks like a React Flow diagram."
