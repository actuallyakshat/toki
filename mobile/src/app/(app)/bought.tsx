import { router } from "expo-router";
import { useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { CardSkeleton, ProductCard } from "@/components/product-card";
import { Label, T } from "@/components/text";
import { useApp } from "@/lib/app-state";
import { formatDate, formatMoney } from "@/lib/format";
import { useBoughtItems, useStats, useUpdateItem } from "@/lib/hooks";
import type { Item } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { radius, space } from "@/theme/tokens";

/** A strip of figures split by hairlines, then the same uniform card grid as the wishlist. */
export default function Bought() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { lists, mode, income, currency } = useApp();
  const stats = useStats();
  const bought = useBoughtItems(lists);
  const update = useUpdateItem();

  type Cell = Item | { skeleton: number } | null;
  const cells = useMemo<Cell[]>(() => {
    const base: Cell[] = bought.loading ? Array.from({ length: 4 }, (_, i) => ({ skeleton: i })) : bought.items;
    return base.length % 2 === 1 ? [...base, null] : base;
  }, [bought.loading, bought.items]);

  const cur = stats.data?.currency ?? currency;

  const header = (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      <T size="title" weight="medium" accessibilityRole="header">
        Bought
      </T>
      <View style={{ marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border }}>
        <Figure
          label="Money not spent"
          value={formatMoney(stats.data?.removed_value_minor ?? 0, cur)}
          hint="The price of everything you took off your wishlist."
        />
        <View style={{ height: 1, backgroundColor: c.border }} />
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: c.border }}>
            <Figure label="Saved by drops" value={formatMoney(stats.data?.saved_by_drops_minor ?? 0, cur)} tone="down" />
          </View>
          <View style={{ flex: 1, paddingLeft: 16 }}>
            <Figure label="Things bought" value={bought.loading ? "–" : String(bought.items.length)} />
          </View>
        </View>
      </View>
      <T size="lead" weight="medium" style={{ marginTop: 32 }}>
        Things you bought
      </T>
    </View>
  );

  return (
    <FlatList<Cell>
      data={cells}
      numColumns={2}
      keyExtractor={(cell, i) => (cell && "id" in cell ? cell.id : `pad-${i}`)}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32, gap: 10 }}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={bought.refetching || stats.isRefetching}
          onRefresh={() => {
            void bought.refetch();
            void stats.refetch();
          }}
          tintColor={c.textMuted}
          colors={[c.text]}
        />
      }
      ListEmptyComponent={
        <View
          style={{
            alignItems: "center",
            gap: 12,
            paddingVertical: 48,
            paddingHorizontal: 24,
            borderRadius: radius.card,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: c.border,
          }}
        >
          <T tone="muted" align="center">
            Nothing here yet. When you press Mark as bought on an item, it moves to this page.
          </T>
          <T weight="medium" tone="highlight" onPress={() => router.navigate("/")} accessibilityRole="link">
            Go to your wishlist
          </T>
        </View>
      }
      renderItem={({ item: cell, index }) => {
        if (cell === null) return <View style={{ flex: 1 }} />;
        if ("skeleton" in cell) return <CardSkeleton />;
        return (
          <ProductCard
            item={cell}
            mode={mode}
            income={income}
            index={index}
            footer={
              <View style={{ gap: 8 }}>
                <T size="caption" tone="muted">
                  {cell.bought_at ? `Bought on ${formatDate(cell.bought_at)}` : "Purchase date not recorded"}
                </T>
                <Button size="sm" variant="secondary" onPress={() => update.mutate({ id: cell.id, patch: { status: "wanted" } })}>
                  Back to wishlist
                </Button>
              </View>
            }
          />
        );
      }}
    />
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "down" }) {
  return (
    <View style={{ paddingVertical: 16 }}>
      <Label>{label}</Label>
      <T
        tabular
        tone={tone}
        style={{ fontSize: 28, lineHeight: 34, marginTop: 10, fontFamily: "Geist_500Medium", letterSpacing: -0.8 }}
      >
        {value}
      </T>
      {hint ? (
        <T size="caption" tone="muted" style={{ marginTop: 4 }}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}
