# Toki — design system

Read this with `design/tokens.css`. Both UI apps (web, extension) use the same tokens.

## Idea

Toki (時) means "time". The product's one memorable moment is the **time toggle**:
every price on screen rolls, digit by digit, from rupees to hours of work
("₹1,29,999" → "86 h 40 min"), and the accent shifts from ink to purple (zeron.sh `#8b5cf6`), like
light moving across a sundial. Spend boldness there. Keep everything else quiet,
precise, and image-led: the products are the colour on the page.

The visual language follows [Synara](https://trysynara.com), with ProUI's (https://pro-ui.dev)
restraint: warm paper and warm charcoal, ink pill buttons, Geist with small mono eyebrows,
hairline-divided grids instead of cards with shadows, and modest headline sizes. Product
screenshots sit on a photo backdrop (`web/public/landing/lisbon.jpg`, Unsplash) whose
gets a halftone filter (`HalftonePhoto`, ported from monocode). Colour comes from that photo,
product images and the time toggle.

## Palette

Light is the base. The theme follows the browser (`prefers-color-scheme`) until the user picks
one with the beUI Theme Toggle; the choice is stored under `toki.theme`.

| Name | Light | Dark | Use |
|---|---|---|---|
| Porcelain | `#f5f4f2` | `#1c1b1a` | page background, panels laid on the photo |
| Paper | `#fbfaf8` | `#232220` | cards, popovers |
| Raise | `#e8e6e2` | `#262523` | elevated blocks, dark-mode wash over the photo |
| Sunk | ink 6% | ink 8% | hover rows, store tiles, image placeholders |
| Ink | `#141413` | `#f5f4f2` | text |
| Ink soft | `#5b5955` | `#aaa8a3` | body copy, secondary text |
| Ink faint | `#66635e` | `#97948e` | eyebrows, captions, nav links |
| Line | ink 12% | ink 12% | hairlines and grid dividers |
| Accent | `#1c1917` | `#fafaf9` | primary buttons (ink pill), segment indicators |
| Purple | `#8b5cf6` | `#8b5cf6` | time mode accent (white text on it), focus ring — from zeron.sh |
| Link | `#5b34b8` | `#b79df9` | links, showcase kickers, selection (zeron.sh deep / light purple) |
| Marigold | `#f2a900` | `#f2a900` | warnings only |
| Jade | `#2e8540` | `#78bc82` | price down |
| Kumkum | `#c8372d` | `#ef7770` | price up, destructive, errors |

## Type

- **Geist** for everything readable; **Geist Mono** for the `.label` eyebrow (11px, uppercase,
  0.12em tracking) and the showcase kicker (10px, link colour, "01 / time view"). Never for prose,
  buttons or prices.
- Headings are medium (500) with -0.035em tracking. One scale for the landing page:
  hero h1 24/32px, section h2 26/32px, showcase h3 22/24px, grid-cell title 15px, closing h2 32/48px.
  Body copy 15/16px at 1.7 line height; grid-cell copy 13–13.5px; captions 11–12px.
- App scale (px): 12 / 13 (body) / 15 / 17 / 22 / 32 / 46. Prices and times use weight 500 and
  `font-variant-numeric: tabular-nums`. Inputs stay at 16px on touch devices so iOS does not zoom.
- Buttons that move you forward carry a lucide `ArrowRight`; external links carry `ArrowUpRight`.

## Layout

```
┌────┬──────────────────────────────────────────────────────┐
│ ●  │  Wishlist ✨            [₹ ⇄ ⏱]   ⌘K   (+ Add)       │
│ ●  │  ₹3,45,000 across 8 things                           │
│ ●  ├──────────────────────────────────────────────────────┤
│    │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ ◐  │ │ image  │ │ image  │ │        │ │ image  │          │
│    │ │        │ │        │ │ image  │ │        │          │
│    │ │title   │ │title   │ │        │ │title   │          │
│    │ │₹12,999 │ │₹4,500  │ │title   │ │₹899    │          │
│    │ │▼ ₹500  │ │        │ │₹79,900 │ │▲ ₹50   │          │
│    │ └────────┘ └────────┘ └────────┘ └────────┘          │
└────┴──────────────────────────────────────────────────────┘
```

- Left: a narrow icon rail (beUI Animated Sidebar folded to rail) — lists, bought, settings.
- Uniform grid of product cards. Every image box is 4:3 and cropped to fill.
  Left-aligned text. Card: image (radius-image) inset 10px inside the card (radius-card).
- Card shows: image, retailer favicon + name (muted, 12px), title (2 lines max), price
  (Geist 500, 17px), and a delta chip only when the price changed since added (jade ▼ / kumkum ▲).
- Click a card → detail opens in a beUI Morphing Modal / Drawer: big image, price history
  (beUI Price Target Fan with target line), target price input, alert rule, note,
  "Wait 30 days" (cooling-off), "Mark bought", "Remove", "Open in store".
- Empty states give one direction: "Paste a product link, or install the extension and press Add on any store."

## Shape and depth

- Radii: buttons are pills (`--radius-button`); everything else is crisp: inputs and controls 8px,
  cards 6px, images and chips 4px, segment indicators inside a control 4px, photo frames 12px.
- No shadows. Surfaces separate with 1px hairlines (`--shadow-card` is a 1px ring). Sections are
  separated by a full-width top border. Feature lists are hairline grids whose cells tint on hover.
- Wishlist cards are a uniform grid: every image box is 4:3 (cropped to fill), titles reserve two
  lines, prices sit on the bottom edge, so every card in a row has the same height.
- The priority view is a full-width ranked table, not a column of cards: hairline rows with rank,
  item, price now, change since added, and lowest and target on wide screens. Use the width.
- Icons are monochrome lucide icons everywhere, including list icons (stored as `i:<key>` in the
  list's `emoji` field as `i:<lucide-name>`; any of lucide's ~1,800 icons, picked from a searchable,
  virtualised grid and loaded per icon on demand; see `web/src/components/shared/list-icon.tsx`). No colour emoji in the UI;
  lists made before this keep their emoji (in colour) until the owner picks an icon in Edit list.
- The sidebar shows Lists and Library on every page; inside settings it swaps to the grouped
  settings nav (Account, Prices, Browser) with Back at the bottom, after monocode.
- App pages use the full width; no page is a narrow column of cards. Settings are full-width rows
  (title and hint on the left, controls on the right, hairline between rows). Bought opens with a
  full-width strip of figures split by hairlines, then the same uniform card grid as the wishlist.
- The landing hero sits on the photo edge to edge; the photo carries a halftone filter and
  fades into the page under the demo.

## Motion

- Motion answers actions: add, open, reorder, toggle, toast. No scroll-triggered fade-ins on every card.
- Everything else is 120–180 ms on `cubic-bezier(0.22, 1, 0.36, 1)`: quick, no drift.
- One orchestrated moment: the time toggle (beUI Number Animation, rolling digits, staggered 25 ms per card,
  `--accent` transition 420 ms).
- New item: card springs into the grid from the add button (layout animation).
- Respect `prefers-reduced-motion` (tokens collapse durations; beUI components honour it).

## beUI component map (https://beui.dev — MIT)

Install per app: `pnpm dlx shadcn@latest add https://beui.dev/r/<slug>.json`
(or fetch `https://beui.dev/r/<slug>` JSON and write the files). Do not invent widgets that beUI already has.

| Feature | beUI slug |
|---|---|
| Currency ⇄ time figures | `number` (Number Animation) |
| Wishlist grid | plain CSS grid (uniform cards) |
| Card hover on landing only | `tilt-card` |
| Price history chart | `price-target-fan` |
| Priority reorder (list view) | `sortable-stack` |
| ⌘K palette | `command-palette` |
| Add / edit dialogs | `morphing-modal`, `drawer` |
| Toasts | `animated-toast-stack` |
| Theme switch | `theme-toggle` |
| Currency/time switch, view switch | `tabs` (segment) or `switch` |
| Inputs, selects | `input`, `select`, `button` |
| Landing photo backdrop | none — `HalftonePhoto` (`web/src/components/landing/halftone-photo.tsx`), photo by Svetlana Gumerova on Unsplash |
| Landing section rail | `preview-rail` (`LandingRail`, fixed to the right edge on large screens) |
| Loading | `loader` |
| Navigation rail | `animated-sidebar` |
| Sign-up form | `signup-form` |
| 404 | `not-found` |

## Copy

Plain, specific, active. "Add to Toki", "Save target", "Mark as bought", "Price dropped to ₹12,499".
Errors say what happened and what to do: "Toki could not read a price on this page. Enter it below."
