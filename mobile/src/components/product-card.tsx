import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { faviconUrl, formatDayMonth, isCooling, retailerName, type Income } from "@/lib/format";
import type { Mode } from "@/lib/prefs";
import type { Item } from "@/lib/types";
import { easeOut, useTheme } from "@/theme/theme";
import { duration, radius, space } from "@/theme/tokens";
import { DeltaChip, PriceFigure } from "./price";
import { ProductImage } from "./product-image";
import { T } from "./text";

interface Props {
  item: Item;
  mode: Mode;
  income: Income | null;
  index: number;
  onPress?: () => void;
  onLongPress?: () => void;
  footer?: ReactNode;
}

/**
 * The wishlist card: a 4:3 image inset 10px in a 6px card ringed by a hairline (no shadows), retailer
 * favicon and name, a two-line title, and the price on the bottom edge with a delta chip when it moved.
 */
export function ProductCard({ item, mode, income, index, onPress, onLongPress, footer }: Props) {
  const { c } = useTheme();
  const { product } = item;
  const favicon = faviconUrl(product.url);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const pressed = useSharedValue(0);
  const lift = useAnimatedStyle(() => ({
    borderColor: interpolateColor(pressed.value, [0, 1], [c.border, c.textFaint]),
    transform: [{ scale: 1 - pressed.value * 0.015 }],
  }));

  const body = (
    <Animated.View
      style={[
        {
          flex: 1,
          padding: space.cardInset,
          borderRadius: radius.card,
          borderWidth: 1,
          backgroundColor: c.surface,
        },
        lift,
      ]}
    >
      <ProductImage src={product.image_url} />
      <View style={{ flex: 1, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {favicon && !faviconFailed ? (
            <Image
              source={{ uri: favicon }}
              onError={() => setFaviconFailed(true)}
              style={{ width: 13, height: 13, borderRadius: 2 }}
            />
          ) : null}
          <T size="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {retailerName(product.retailer, product.url)}
          </T>
        </View>
        {/* Titles reserve two lines so every card in a row ends at the same height. */}
        <T weight="medium" numberOfLines={2} style={{ marginTop: 4, minHeight: 38 }}>
          {product.title}
        </T>
        <View style={{ marginTop: "auto", paddingTop: 8, gap: 6 }}>
          <PriceFigure
            minor={product.current_price_minor}
            currency={product.currency}
            mode={mode}
            income={income}
            index={index}
          />
          <DeltaChip changeMinor={item.stats.change_since_added_minor} currency={product.currency} />
        </View>
        {!product.in_stock && (
          <T size="caption" tone="up" style={{ marginTop: 6 }}>
            Out of stock
          </T>
        )}
        {isCooling(item.cooling_until) && (
          <T size="caption" tone="muted" style={{ marginTop: 6 }}>
            Cooling off until {formatDayMonth(item.cooling_until)}
          </T>
        )}
        {footer && <View style={{ marginTop: 10 }}>{footer}</View>}
      </View>
    </Animated.View>
  );

  return (
    <Animated.View entering={FadeIn.duration(duration.base)} style={{ flex: 1 }}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={product.title}
          onPressIn={() => pressed.set(withTiming(1, { duration: duration.fast, easing: easeOut }))}
          onPressOut={() => pressed.set(withTiming(0, { duration: duration.base, easing: easeOut }))}
          style={{ flex: 1 }}
        >
          {body}
        </Pressable>
      ) : (
        // Cards without an action (Bought) hold their own buttons, which must not sit inside another button.
        body
      )}
    </Animated.View>
  );
}

/** Same footprint as a card while the list loads. */
export function CardSkeleton() {
  const { c } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: space.cardInset,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ aspectRatio: 4 / 3, borderRadius: radius.image, backgroundColor: c.surfaceSunk }} />
      <View style={{ marginTop: 14, height: 10, width: "60%", borderRadius: 99, backgroundColor: c.surfaceSunk }} />
      <View style={{ marginTop: 10, height: 12, width: "85%", borderRadius: 99, backgroundColor: c.surfaceSunk }} />
      <View style={{ marginTop: 14, height: 14, width: "40%", borderRadius: 99, backgroundColor: c.surfaceSunk }} />
    </View>
  );
}
