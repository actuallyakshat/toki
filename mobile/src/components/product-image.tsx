import { Image } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

interface Props {
  src: string | null | undefined;
  /** Width / height. Wishlist cards use 4:3. */
  aspect?: number;
  /** "cover" crops to fill (cards); "contain" shows the whole product (detail). */
  fit?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Product photo on a sunk tile with the 4px image radius. Products are the colour on the page. */
export function ProductImage({ src, aspect = 4 / 3, fit = "cover", style, accessibilityLabel }: Props) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;

  return (
    <View
      style={[
        {
          aspectRatio: aspect,
          borderRadius: radius.image,
          overflow: "hidden",
          // Retailer photos sit on white; keep that white behind "contain" images so the edges disappear.
          backgroundColor: fit === "contain" && show ? "#ffffff" : c.surfaceSunk,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {show ? (
        <Image
          source={{ uri: src! }}
          contentFit={fit}
          transition={180}
          onError={() => setFailed(true)}
          accessibilityLabel={accessibilityLabel}
          accessible={Boolean(accessibilityLabel)}
          style={{ width: "100%", height: "100%" }}
          recyclingKey={src!}
        />
      ) : (
        <ImageOff size={20} color={c.textFaint} />
      )}
    </View>
  );
}
