import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton } from "@/components/button";
import { ErrorNote } from "@/components/chrome";
import { EmptyState } from "@/components/empty-state";
import { DeltaChip, PriceFigure } from "@/components/price";
import { CardSkeleton, ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { Label, T } from "@/components/text";
import { useToast } from "@/components/toast";
import { WishlistHeader } from "@/components/wishlist-header";
import { useApp } from "@/lib/app-state";
import { retailerName } from "@/lib/format";
import { itemsKey, useItems, useReorder } from "@/lib/hooks";
import { usePrefs } from "@/lib/prefs";
import type { Item } from "@/lib/types";
import { easeOut, useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

const openItem = (item: Item) => router.push({ pathname: "/item/[id]", params: { id: item.id, listId: item.list_id } });

export default function Wishlist() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { list, mode, income, listsLoading, listsError, refetchLists } = useApp();
  const { view } = usePrefs();
  const items = useItems(list?.id);
  const data = useMemo(() => items.data ?? [], [items.data]);
  const total = useMemo(
    () => (items.data ? data.reduce((sum, i) => sum + i.product.current_price_minor, 0) : (list?.total_minor ?? 0)),
    [items.data, data, list],
  );
  const count = items.data ? data.length : (list?.item_count ?? 0);

  const header = <WishlistHeader count={count} total={total} />;
  const refresh = (
    <RefreshControl
      refreshing={items.isRefetching}
      onRefresh={() => void items.refetch()}
      tintColor={c.textMuted}
      colors={[c.text]}
    />
  );
  const padding = { paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 32 };

  if (listsError) {
    return (
      <View style={[padding, { flex: 1 }]}>
        <ErrorNote message="Toki could not load your lists." onRetry={refetchLists} />
      </View>
    );
  }

  const loading = listsLoading || !list || items.isLoading;

  if (view === "priority" && !loading && data.length > 0 && list) {
    return <PriorityList key={list.id} listId={list.id} items={data} header={header} refresh={refresh} padding={padding} />;
  }

  // Pad odd counts so the last card keeps its column width.
  type Cell = Item | { skeleton: number } | null;
  const cells: Cell[] = loading ? Array.from({ length: 6 }, (_, i) => ({ skeleton: i })) : data;
  const grid = cells.length % 2 === 1 ? [...cells, null] : cells;

  return (
    <FlatList<Cell>
      data={grid}
      key={list?.id ?? "loading"}
      numColumns={2}
      keyExtractor={(cell, i) => (cell && "id" in cell ? cell.id : `pad-${i}`)}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={[padding, { gap: 10 }]}
      ListHeaderComponent={header}
      ListEmptyComponent={
        items.isError ? (
          <ErrorNote message="Toki could not load this list." onRetry={() => void items.refetch()} />
        ) : (
          <EmptyState />
        )
      }
      refreshControl={refresh}
      renderItem={({ item: cell, index }) => {
        if (cell === null) return <View style={{ flex: 1 }} />;
        if ("skeleton" in cell) return <CardSkeleton />;
        return <ProductCard item={cell} mode={mode} income={income} index={index} onPress={() => openItem(cell)} />;
      }}
    />
  );
}

/**
 * The priority view: a ranked table with hairline rows (rank, item, price now, change since added).
 * Tap Reorder, then move rows with the arrows; the order is saved half a second after the last move.
 */
function PriorityList({
  listId,
  items,
  header,
  refresh,
  padding,
}: {
  listId: string;
  items: Item[];
  header: React.ReactElement;
  refresh: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
  padding: object;
}) {
  const qc = useQueryClient();
  const notify = useToast();
  const { c } = useTheme();
  const { mode, income } = useApp();
  const reorder = useReorder(listId);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    void Haptics.selectionAsync();
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    qc.setQueryData(
      itemsKey(listId),
      next.map((item, position) => ({ ...item, position })),
    );
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () =>
        reorder.mutate(
          next.map((i) => i.id),
          {
            onError: () =>
              notify({
                status: "error",
                title: "Toki could not save the order",
                description: "The list went back to its saved order.",
              }),
          },
        ),
      500,
    );
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={padding}
      refreshControl={refresh}
      ListHeaderComponent={
        <View>
          {header}
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}
          >
            <T tone="muted" style={{ flex: 1 }}>
              {editing ? "Move the things you want most to the top." : "The top item is the one you want most."}
            </T>
            <Button size="sm" variant={editing ? "primary" : "secondary"} onPress={() => setEditing((e) => !e)}>
              {editing ? "Done" : "Reorder"}
            </Button>
          </View>
          <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border, gap: 12 }}>
            <Label style={{ width: 22 }}>#</Label>
            <Label style={{ flex: 1 }}>Item</Label>
            <Label>Now</Label>
          </View>
        </View>
      }
      renderItem={({ item, index }) => {
        const row = {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        } as const;
        const cells = (
          <>
            <T style={{ width: 22, fontFamily: "GeistMono_500Medium", fontSize: 12 }} tone="faint" tabular>
              {String(index + 1).padStart(2, "0")}
            </T>
            <View style={{ width: 44 }}>
              <ProductImage src={item.product.image_url} aspect={1} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T weight="medium" numberOfLines={1}>
                {item.product.title}
              </T>
              <T size="caption" tone="muted" numberOfLines={1}>
                {retailerName(item.product.retailer, item.product.url)}
              </T>
            </View>
            {editing ? (
              <View style={{ flexDirection: "row" }}>
                <IconButton
                  icon={ChevronUp}
                  label="Move up"
                  onPress={() => move(index, index - 1)}
                  tone={index === 0 ? c.border : c.text}
                />
                <IconButton
                  icon={ChevronDown}
                  label="Move down"
                  onPress={() => move(index, index + 1)}
                  tone={index === items.length - 1 ? c.border : c.text}
                />
              </View>
            ) : (
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <PriceFigure
                  minor={item.product.current_price_minor}
                  currency={item.product.currency}
                  mode={mode}
                  income={income}
                  index={index}
                  size={13}
                />
                {item.stats.change_since_added_minor === 0 ? (
                  <T size="caption" tone="faint">
                    No change
                  </T>
                ) : (
                  <DeltaChip changeMinor={item.stats.change_since_added_minor} currency={item.product.currency} />
                )}
              </View>
            )}
          </>
        );
        return (
          <Animated.View layout={LinearTransition.duration(180).easing(easeOut)}>
            {/* While reordering the row is not a button, so the arrow buttons are not nested inside one. */}
            {editing ? (
              <View style={row}>{cells}</View>
            ) : (
              <Pressable
                onPress={() => openItem(item)}
                onLongPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setEditing(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}. ${item.product.title}`}
                style={({ pressed }) => [row, { backgroundColor: pressed ? c.surfaceSunk : "transparent" }]}
              >
                {cells}
              </Pressable>
            )}
          </Animated.View>
        );
      }}
    />
  );
}
