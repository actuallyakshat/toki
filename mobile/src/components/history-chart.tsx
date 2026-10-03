import { useMemo, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { formatDayMonth, formatMoney } from "@/lib/format";
import { useHistory } from "@/lib/hooks";
import type { Item, PricePoint } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import { T } from "./text";

const HEIGHT = 180;
const PAD = { top: 16, bottom: 22, left: 4, right: 4 };

interface Point {
  t: number;
  price: number;
}

/** The chart needs ascending, unique timestamps and positive prices (same rules as the website). */
function toPoints(points: PricePoint[]): Point[] {
  const sorted = [...points].filter((p) => p.price_minor > 0).sort((a, b) => Date.parse(a.checked_at) - Date.parse(b.checked_at));
  const out: Point[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const p of sorted) {
    const t = Date.parse(p.checked_at);
    if (!Number.isFinite(t) || t <= last) continue;
    last = t;
    out.push({ t, price: p.price_minor });
  }
  return out;
}

/**
 * Price history: a step line of every check, a dashed jade line at the target, and a finger-scrub
 * readout. Hairlines and ink only; colour is reserved for the target and the lowest point.
 */
export function HistoryChart({ item }: { item: Item }) {
  const { c } = useTheme();
  const { data, isLoading, isError } = useHistory(item.id);
  const points = useMemo(() => toPoints(data ?? []), [data]);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const currency = item.product.currency;
  const target = item.target_price_minor;

  const geo = useMemo(() => {
    if (points.length === 0 || width === 0) return null;
    // A single check still draws a flat line across the chart.
    const series = points.length === 1 ? [points[0], { t: points[0].t + 1, price: points[0].price }] : points;
    const prices = series.map((p) => p.price).concat(target ? [target] : []);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (min === max) {
      min *= 0.95;
      max *= 1.05;
    }
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;
    const t0 = series[0].t;
    const t1 = series[series.length - 1].t;
    const w = width - PAD.left - PAD.right;
    const h = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * w;
    const y = (p: number) => PAD.top + (1 - (p - min) / (max - min)) * h;

    let line = "";
    series.forEach((p, i) => {
      if (i === 0) line += `M${x(p.t)},${y(p.price)}`;
      else line += `H${x(p.t)}V${y(p.price)}`;
    });
    const last = series[series.length - 1];
    line += `H${x(last.t)}`;
    const area = `${line}V${PAD.top + h}H${x(t0)}Z`;
    const lowest = series.reduce((lo, p) => (p.price < lo.price ? p : lo), series[0]);
    return { series, line, area, x, y, lowest, bottom: PAD.top + h };
  }, [points, width, target]);

  if (isLoading) {
    return <View style={{ height: HEIGHT, borderRadius: radius.image, backgroundColor: c.surfaceSunk }} />;
  }
  if (isError || points.length === 0) {
    return (
      <View style={{ padding: 16, borderRadius: radius.image, backgroundColor: c.surfaceSunk }}>
        <T tone="muted">
          {isError
            ? "Toki could not load the price history. Close this sheet and open it again."
            : "No price history yet. The chart fills in as the extension checks this price."}
        </T>
      </View>
    );
  }

  const scrub = (e: GestureResponderEvent) => {
    if (!geo) return;
    const fx = e.nativeEvent.locationX;
    let best = 0;
    geo.series.forEach((p, i) => {
      if (Math.abs(geo.x(p.t) - fx) < Math.abs(geo.x(geo.series[best].t) - fx)) best = i;
    });
    setActive(Math.min(best, points.length - 1));
  };

  const shown = active !== null ? points[active] : points[points.length - 1];

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <T size="lead" weight="medium" tabular>
          {formatMoney(shown.price, currency)}
        </T>
        <T size="caption" tone="muted">
          {active !== null
            ? formatDayMonth(new Date(shown.t).toISOString())
            : `${points.length} ${points.length === 1 ? "check" : "checks"}`}
        </T>
      </View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        // Let the sheet's scroll view take over a vertical swipe that starts on the chart.
        onResponderTerminationRequest={() => true}
        onResponderGrant={scrub}
        onResponderMove={scrub}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
        accessible
        accessibilityLabel={`Price history, ${points.length} checks. Lowest ${formatMoney(Math.min(...points.map((p) => p.price)), currency)}.`}
        style={{ height: HEIGHT }}
      >
        {geo && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.text} stopOpacity={0.08} />
                <Stop offset="1" stopColor={c.text} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={geo.bottom} y2={geo.bottom} stroke={c.border} strokeWidth={1} />
            <Path d={geo.area} fill="url(#fill)" />
            <Path d={geo.line} stroke={c.text} strokeWidth={1.75} fill="none" strokeLinejoin="round" />
            {target ? (
              <Line
                x1={0}
                x2={width}
                y1={geo.y(target)}
                y2={geo.y(target)}
                stroke={c.down}
                strokeWidth={1.25}
                strokeDasharray="4 4"
              />
            ) : null}
            <Circle cx={geo.x(geo.lowest.t)} cy={geo.y(geo.lowest.price)} r={3.5} fill={c.down} />
            {active !== null && (
              <>
                <Line
                  x1={geo.x(points[active].t)}
                  x2={geo.x(points[active].t)}
                  y1={PAD.top - 6}
                  y2={geo.bottom}
                  stroke={c.textFaint}
                  strokeWidth={1}
                />
                <Circle
                  cx={geo.x(points[active].t)}
                  cy={geo.y(points[active].price)}
                  r={4.5}
                  fill={c.surface}
                  stroke={c.text}
                  strokeWidth={1.75}
                />
              </>
            )}
          </Svg>
        )}
        <View
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between" }}
        >
          <T size="caption" tone="faint">
            {formatDayMonth(new Date(points[0].t).toISOString())}
          </T>
          {target ? (
            <T size="caption" tone="down">
              Target {formatMoney(target, currency)}
            </T>
          ) : null}
          <T size="caption" tone="faint">
            {formatDayMonth(new Date(points[points.length - 1].t).toISOString())}
          </T>
        </View>
      </View>
    </View>
  );
}
