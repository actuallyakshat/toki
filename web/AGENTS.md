<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI components — use beUI (https://beui.dev)

All UI work in `web/` (and `extension/` where applicable) MUST reuse beUI components. Do not invent custom motion widgets that beUI already has.

- Docs for agents: https://beui.dev/docs/ai-agents
- Catalogue (JSON): https://beui.dev/r — pick the closest `slug` / `items[].name`
- Detail: `https://beui.dev/r/{slug}` (files, deps, source) or raw `https://beui.dev/r/{slug}/raw`
- Design mapping for this repo: see `DESIGN.md` → "beUI component map" for which slug to use per feature.

Install (per app, from `web/` or `extension/`):

```sh
pnpm dlx shadcn@latest add https://beui.dev/r/<slug>.json
# e.g. pnpm dlx shadcn@latest add https://beui.dev/r/morphing-modal.json
# or: npx shadcn@latest add @beui/<slug>
```

Rules:
1. Fetch the live registry first (`/r`), then the component detail (`/r/{slug}`) before installing — slugs change; never guess file paths.
2. Components are self-contained — write `entry.files[].path` as given, install `entry.dependencies` (already present: `motion`, `lucide-react`, `tailwind-merge`, Tailwind 4, React 19).
3. Components use shadcn semantic color utilities and inherit this repo's theme from `design/tokens.css` — do not add beUI-specific color variables.
4. Respect `prefers-reduced-motion` (beUI does; keep it).
