import { router, useLocalSearchParams } from "expo-router";
import { Check, ExternalLink, RefreshCw, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Hairline, SheetHeader, Well } from "@/components/chrome";
import { HistoryChart } from "@/components/history-chart";
import { Input } from "@/components/input";
import { DeltaChip, PriceFigure } from "@/components/price";
import { ProductImage } from "@/components/product-image";
import { T } from "@/components/text";
import { useToast } from "@/components/toast";
import { errorMessage, type ItemPatch } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { formatDayMonth, formatMoney, isCooling, retailerName, timeAgo } from "@/lib/format";
import { useItems, useRefreshItem, useUpdateItem } from "@/lib/hooks";
import { minorToInput, parseMinor } from "@/lib/money-input";
import type { AlertRule, Item } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

const COOLING_DAYS = 30;

export default function ItemScreen() {
  const { id, listId } = useLocalSearchParams<{ id: string; listId: string }>();
  const items = useItems(listId);
  const item = items.data?.find((i) => i.id === id);
  const insets = useSafeAreaInsets();

  if (!item) {
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: Platform.OS === "android" ? insets.top + 16 : 20 }}>
        <SheetHeader
          title={items.isLoading ? "Loading" : "This item is gone"}
          hint={items.isLoading ? undefined : "It may have been bought or removed."}
        />
      </View>
    );
  }
  return <DetailBody key={item.id} item={item} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T size="caption" tone="muted">
        {label}
      </T>
      <T size="lead" weight="medium" tabular style={{ marginTop: 2 }}>
        {value}
      </T>
    </View>
  );
}

function checkLine(item: Item): string {
  const { last_check_status: status, last_checked_at: at } = item.product;
  if (status === "failed") return "The last check failed. Toki will try again.";
  if (!at || status === "pending") return "Toki has not checked this price yet.";
  return `Checked ${timeAgo(at)}`;
}

const RULES: { type: AlertRule["type"]; label: string }[] = [
  { type: "any_drop", label: "The price drops at all" },
  { type: "below_target", label: "The price reaches my target" },
  { type: "percent_drop", label: "The price falls by a percentage" },
];

function DetailBody({ item }: { item: Item }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { mode, income } = useApp();
  const update = useUpdateItem();
  const refresh = useRefreshItem();
  const notify = useToast();
  const { product } = item;
  const currency = product.currency;
  const cooling = isCooling(item.cooling_until) ? item.cooling_until : null;

  const [target, setTarget] = useState(minorToInput(item.target_price_minor));
  const [targetError, setTargetError] = useState<string>();
  const [note, setNote] = useState(item.note);
  const [percent, setPercent] = useState(String(item.alert_rule.type === "percent_drop" ? item.alert_rule.percent : 10));

  const patch = (body: ItemPatch, onSuccess?: () => void) =>
    update.mutate(
      { id: item.id, patch: body },
      {
        onSuccess,
        onError: (e) =>
          notify({ status: "error", title: "Toki could not save that change", description: errorMessage(e, "Try again.") }),
      },
    );

  const saveTarget = () => {
    const trimmed = target.trim();
    if (!trimmed) {
      setTargetError(undefined);
      if (item.target_price_minor)
        patch({ target_price_minor: null }, () =>
          notify({ status: "success", title: "Target removed", description: product.title }),
        );
      return;
    }
    const minor = parseMinor(trimmed);
    if (!minor) {
      setTargetError("Enter the price you want to pay, for example 11999.");
      return;
    }
    setTargetError(undefined);
    patch({ target_price_minor: minor }, () =>
      notify({ status: "success", title: "Target saved", description: `${formatMoney(minor, currency)} for ${product.title}` }),
    );
  };

  const setRule = (type: AlertRule["type"]) =>
    patch({ alert_rule: type === "percent_drop" ? { type, percent: Math.round(Number(percent)) || 10 } : { type } });

  const waitThirtyDays = () => {
    if (cooling) {
      patch({ cooling_until: null }, () => notify({ status: "success", title: "Waiting stopped", description: product.title }));
      return;
    }
    const until = new Date(Date.now() + COOLING_DAYS * 86_400_000).toISOString();
    patch({ cooling_until: until }, () =>
      notify({ status: "success", title: "Waiting 30 days", description: `Cooling off until ${formatDayMonth(until)}` }),
    );
  };

  const leave = (status: "bought" | "removed") => {
    const title = status === "bought" ? "Marked as bought" : "Removed from Toki";
    // The sheet closes right away, so use the promise: per-call mutate callbacks skip unmounted screens.
    update
      .mutateAsync({ id: item.id, patch: { status } })
      .then(() =>
        notify({
          status: "success",
          title,
          description: product.title,
          action: { label: "Undo", onPress: () => update.mutate({ id: item.id, patch: { status: "wanted" } }) },
        }),
      )
      .catch((e) =>
        notify({ status: "error", title: "Toki could not save that change", description: errorMessage(e, "Try again.") }),
      );
    router.back();
  };

  const queueRefresh = () =>
    refresh.mutate(item.id, {
      onSuccess: () =>
        notify({
          status: "info",
          title: "Price check queued",
          description: "Toki will check this price on the next run of your extension.",
        }),
      onError: (e) =>
        notify({
          status: "error",
          title: "Toki could not queue the check",
          description: errorMessage(e, "Try again in a minute."),
        }),
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === "android" ? insets.top + 16 : 20,
          paddingBottom: insets.bottom + 40,
          gap: 24,
        }}
      >
        <View>
          <SheetHeader title={retailerName(product.retailer, product.url)} />
          <ProductImage src={product.image_url} fit="contain" aspect={4 / 3} accessibilityLabel={product.title} />
        </View>

        <View>
          <T size="price" weight="semibold">
            {product.title}
          </T>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
            <PriceFigure minor={product.current_price_minor} currency={currency} mode={mode} income={income} size={32} />
            <View>
              <DeltaChip changeMinor={item.stats.change_since_added_minor} currency={currency} />
            </View>
          </View>
          {!product.in_stock && (
            <T tone="up" style={{ marginTop: 8 }}>
              Out of stock right now.
            </T>
          )}
          {cooling && (
            <T tone="muted" style={{ marginTop: 8 }}>
              Cooling off until {formatDayMonth(cooling)}.
            </T>
          )}
          <T size="caption" tone="muted" style={{ marginTop: 8 }}>
            {checkLine(item)}
          </T>
        </View>

        <Well style={{ flexDirection: "row", gap: 12 }}>
          <Stat label="Lowest" value={formatMoney(item.stats.lowest_minor, currency)} />
          <Stat label="Highest" value={formatMoney(item.stats.highest_minor, currency)} />
          <Stat label="Added at" value={formatMoney(item.added_price_minor, currency)} />
        </Well>

        <View>
          <T size="lead" weight="semibold" style={{ marginBottom: 8 }} accessibilityRole="header">
            Price history
          </T>
          <HistoryChart item={item} />
        </View>

        <View style={{ gap: 12 }}>
          <T size="lead" weight="semibold" accessibilityRole="header">
            Price alerts
          </T>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Target price (₹)"
                keyboardType="number-pad"
                returnKeyType="done"
                value={target}
                onChangeText={setTarget}
                onSubmitEditing={saveTarget}
                error={targetError}
                reserveErrorLine
              />
            </View>
            <Button variant="secondary" onPress={saveTarget} style={{ marginTop: 22 }} size="md">
              Save target
            </Button>
          </View>
          <View>
            <T size="caption" tone="muted" style={{ marginBottom: 6 }}>
              Email me when
            </T>
            <View
              accessibilityRole="radiogroup"
              style={{ borderRadius: radius.control, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}
            >
              {RULES.map((rule, i) => {
                const selected = item.alert_rule.type === rule.type;
                return (
                  <Pressable
                    key={rule.type}
                    onPress={() => !selected && setRule(rule.type)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 12,
                      minHeight: 46,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                      backgroundColor: pressed ? c.surfaceSunk : c.surface,
                    })}
                  >
                    <T style={{ flex: 1 }} weight={selected ? "medium" : "regular"}>
                      {rule.label}
                    </T>
                    {selected && <Check size={16} color={c.text} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
          {item.alert_rule.type === "percent_drop" && (
            <Input
              label="Percent below the price you added it at"
              keyboardType="number-pad"
              value={percent}
              onChangeText={setPercent}
              onBlur={() => {
                const n = Math.round(Number(percent));
                if (n >= 1 && n <= 99 && !(item.alert_rule.type === "percent_drop" && item.alert_rule.percent === n)) {
                  patch({ alert_rule: { type: "percent_drop", percent: n } });
                }
              }}
            />
          )}
        </View>

        <Input
          label="Note"
          value={note}
          onChangeText={setNote}
          onBlur={() => note !== item.note && patch({ note })}
          placeholder="Why you want it, or what to compare"
          maxLength={500}
          multiline
        />

        <View style={{ gap: 10 }}>
          <Hairline style={{ marginBottom: 10 }} />
          <Button size="lg" onPress={() => leave("bought")}>
            Mark as bought
          </Button>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button variant="secondary" onPress={waitThirtyDays}>
              {cooling ? "Stop waiting" : "Wait 30 days"}
            </Button>
            <Button variant="secondary" icon={RefreshCw} onPress={queueRefresh} loading={refresh.isPending}>
              Refresh price
            </Button>
            <Button variant="secondary" icon={ExternalLink} onPress={() => void Linking.openURL(product.url)}>
              Open in store
            </Button>
            <Button variant="danger" icon={Trash2} onPress={() => leave("removed")}>
              Remove
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
