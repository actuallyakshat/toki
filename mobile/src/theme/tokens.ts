/**
 * Toki design tokens for React Native. Values mirror `design/tokens.css`; do not fork them.
 * After Synara: warm paper and warm charcoal, hairlines, ink buttons, no shadows. Purple from zeron.sh.
 */

export type Scheme = "light" | "dark";

export interface Palette {
  bg: string;
  raise: string;
  surface: string;
  surfaceSunk: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderSoft: string;
  /** Primary buttons are ink; the time mode swaps this for purple (see `timeAccent`). */
  accent: string;
  accentContrast: string;
  highlight: string;
  purple: string;
  marigold: string;
  down: string;
  up: string;
  downWash: string;
  upWash: string;
  focus: string;
}

const purple = "#8b5cf6";

export const palettes: Record<Scheme, Palette> = {
  light: {
    bg: "#f5f4f2",
    raise: "#e8e6e2",
    surface: "#fbfaf8",
    surfaceSunk: "rgba(20, 20, 19, 0.06)",
    text: "#141413",
    textMuted: "#5b5955",
    textFaint: "#66635e",
    border: "rgba(20, 20, 19, 0.12)",
    borderSoft: "rgba(20, 20, 19, 0.07)",
    accent: "#1c1917",
    accentContrast: "#fafaf9",
    highlight: "#5b34b8",
    purple,
    marigold: "#f2a900",
    down: "#2e8540",
    up: "#c8372d",
    downWash: "rgba(46, 133, 64, 0.12)",
    upWash: "rgba(200, 55, 45, 0.12)",
    focus: purple,
  },
  // Warm graphite, a step lighter than Synara so it never reads as black.
  dark: {
    bg: "#1c1b1a",
    raise: "#262523",
    surface: "#232220",
    surfaceSunk: "rgba(245, 244, 242, 0.08)",
    text: "#f5f4f2",
    textMuted: "#aaa8a3",
    textFaint: "#97948e",
    border: "rgba(245, 244, 242, 0.12)",
    borderSoft: "rgba(245, 244, 242, 0.07)",
    accent: "#fafaf9",
    accentContrast: "#121110",
    highlight: "#b79df9",
    purple,
    marigold: "#f2a900",
    down: "#78bc82",
    up: "#ef7770",
    downWash: "rgba(120, 188, 130, 0.14)",
    upWash: "rgba(239, 119, 112, 0.14)",
    focus: purple,
  },
};

/** Time mode: the accent becomes zeron.sh purple in either theme. */
export const timeAccent = { accent: purple, accentContrast: "#ffffff" };

/** Crisp: pills only for buttons; controls 8px, cards 6px, images and chips 4px, photo frames 12px. */
export const radius = {
  button: 999,
  control: 8,
  card: 6,
  frame: 12,
  chip: 4,
  image: 4,
} as const;

/** Geist for everything readable, Geist Mono only for small uppercase eyebrows. */
export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_500Medium",
} as const;

/** App scale (px): 12 / 13 (body) / 15 / 17 / 22 / 32 / 46. */
export const type = {
  caption: 12,
  body: 13,
  lead: 15,
  price: 17,
  title: 22,
  display: 32,
  hero: 46,
} as const;

/** Quick everywhere except the time toggle. */
export const duration = { fast: 120, base: 180, slow: 420 } as const;

export const space = { gutter: 16, cardInset: 10 } as const;
