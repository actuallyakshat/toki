import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { fonts, type } from "@/theme/tokens";

type Size = keyof typeof type;
type Weight = "regular" | "medium" | "semibold";
export type Tone = "default" | "muted" | "faint" | "down" | "up" | "highlight" | "accent" | "contrast";

export interface TProps extends TextProps {
  size?: Size;
  weight?: Weight;
  tone?: Tone;
  /** Tabular figures for prices and times. */
  tabular?: boolean;
  align?: TextStyle["textAlign"];
}

/** Headings (17px and up) get Toki's -0.035em tracking; body copy keeps normal tracking. */
function tracking(px: number) {
  return px >= 17 ? -0.035 * px : 0;
}

export function useToneColor(tone: Tone): string {
  const { c, accent, accentContrast } = useTheme();
  switch (tone) {
    case "muted":
      return c.textMuted;
    case "faint":
      return c.textFaint;
    case "down":
      return c.down;
    case "up":
      return c.up;
    case "highlight":
      return c.highlight;
    case "accent":
      return accent;
    case "contrast":
      return accentContrast;
    default:
      return c.text;
  }
}

export function T({ size = "body", weight = "regular", tone = "default", tabular, align, style, ...props }: TProps) {
  const color = useToneColor(tone);
  const px = type[size];
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: px,
          lineHeight: Math.round(px * (px >= 22 ? 1.2 : 1.45)),
          letterSpacing: tracking(px),
          color,
          textAlign: align,
          fontVariant: tabular ? ["tabular-nums"] : undefined,
        },
        style,
      ]}
    />
  );
}

/** The mono eyebrow: Geist Mono, 11px, uppercase, 0.12em tracking. */
export function Label({ style, tone = "faint", ...props }: TextProps & { tone?: Tone }) {
  const color = useToneColor(tone);
  return (
    <Text
      {...props}
      style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 11 * 0.12, textTransform: "uppercase", color }, style]}
    />
  );
}
