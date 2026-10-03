import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, ClipboardPaste, Link2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { SheetHeader, Well } from "@/components/chrome";
import { Input } from "@/components/input";
import { ProductImage } from "@/components/product-image";
import { T } from "@/components/text";
import { useToast } from "@/components/toast";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { formatMoney, retailerName } from "@/lib/format";
import { useAddItem } from "@/lib/hooks";
import { parseMinor } from "@/lib/money-input";
import type { Capture } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

type Step = "paste" | "preview" | "manual";

/** Pulls the first link out of text shared or copied from a shopping app ("Check this out! https://…"). */
function findUrl(text: string): string | null {
  return /https?:\/\/[^\s<>"]+/i.exec(text)?.[0] ?? null;
}

export default function AddItem() {
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("paste");
  const [url, setUrl] = useState(params.url ? (findUrl(params.url) ?? params.url) : "");
  const [capture, setCapture] = useState<Capture | null>(null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === "android" ? insets.top + 16 : 20,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {step === "paste" && (
          <PasteStep
            url={url}
            setUrl={setUrl}
            autoRead={Boolean(params.url)}
            onRead={(c) => {
              setCapture(c);
              setStep("preview");
            }}
            onManual={() => setStep("manual")}
          />
        )}
        {step === "preview" && capture && <PreviewStep capture={capture} onBack={() => setStep("paste")} />}
        {step === "manual" && <ManualStep url={url} onBack={() => setStep("paste")} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasteStep({
  url,
  setUrl,
  autoRead,
  onRead,
  onManual,
}: {
  url: string;
  setUrl: (v: string) => void;
  autoRead: boolean;
  onRead: (c: Capture) => void;
  onManual: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const started = useRef(false);

  async function read(value = url) {
    const link = findUrl(value) ?? value.trim();
    if (!/^https?:\/\//i.test(link)) {
      setError("Paste a full product link that starts with https://.");
      return;
    }
    setUrl(link);
    setLoading(true);
    setError(undefined);
    try {
      const { capture } = await api.extract(link);
      onRead(capture);
    } catch (e) {
      setLoading(false);
      if (e instanceof ApiError && e.code === "extract_failed") {
        onManual();
        return;
      }
      setError(errorMessage(e, "Toki could not read that link. Try again."));
    }
  }

  // A link that arrived with the screen (toki://add?url=…) is read straight away.
  useEffect(() => {
    if (autoRead && !started.current) {
      started.current = true;
      void read();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRead]);

  async function paste() {
    const text = await Clipboard.getStringAsync();
    const link = findUrl(text);
    if (!link) {
      setError("Your clipboard has no link. Copy the product link from the store app first.");
      return;
    }
    setUrl(link);
    void read(link);
  }

  return (
    <View>
      <SheetHeader title="Add an item" hint="Paste a product link from any store." />
      <View style={{ gap: 12 }}>
        <Input
          label="Product link"
          autoFocus={!autoRead}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          placeholder="https://www.amazon.in/dp/…"
          leftIcon={Link2}
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={() => void read()}
          error={error}
          reserveErrorLine
          right={<PasteChip onPress={paste} />}
        />
        <Button block size="lg" onPress={() => void read()} loading={loading} trailingIcon={ArrowRight}>
          {loading ? "Reading the page" : "Read the page"}
        </Button>
        <T size="caption" tone="faint" style={{ marginTop: 4 }}>
          In a store app, tap Share, then Copy link, and paste it here.
        </T>
      </View>
    </View>
  );
}

function PasteChip({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Paste from clipboard"
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: radius.chip,
        backgroundColor: pressed ? c.border : c.surfaceSunk,
      })}
    >
      <ClipboardPaste size={14} color={c.textMuted} />
      <T size="caption" weight="medium" tone="muted">
        Paste
      </T>
    </Pressable>
  );
}

function useFinish() {
  const notify = useToast();
  return (title: string) => {
    notify({ status: "success", title: "Added to Toki", description: title });
    router.back();
  };
}

function PreviewStep({ capture, onBack }: { capture: Capture; onBack: () => void }) {
  const { list } = useApp();
  const add = useAddItem();
  const finish = useFinish();
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string>();

  async function submit() {
    const targetMinor = target.trim() ? parseMinor(target) : undefined;
    if (target.trim() && !targetMinor) {
      setError("Enter the price you want to pay, for example 11999.");
      return;
    }
    try {
      const item = await add.mutateAsync({
        url: capture.source_url,
        list_id: list?.id,
        capture,
        target_price_minor: targetMinor ?? undefined,
      });
      finish(item.product.title);
    } catch (e) {
      setError(errorMessage(e, "Toki could not add this item. Try again."));
    }
  }

  return (
    <View>
      <SheetHeader title="Add to your wishlist" hint={list ? `Saving to ${list.name}` : undefined} />
      <Well style={{ flexDirection: "row", gap: 12, padding: 10 }}>
        <View style={{ width: 96 }}>
          <ProductImage src={capture.image_url} aspect={1} />
        </View>
        <View style={{ flex: 1, paddingVertical: 4 }}>
          <T size="caption" tone="muted">
            {retailerName(capture.retailer, capture.source_url)}
          </T>
          <T weight="medium" numberOfLines={3} style={{ marginTop: 2 }}>
            {capture.title}
          </T>
          <T size="price" weight="semibold" tabular style={{ marginTop: 6 }}>
            {formatMoney(capture.price_minor, capture.currency)}
          </T>
        </View>
      </Well>
      <View style={{ marginTop: 16 }}>
        <Input
          label="Target price, optional"
          keyboardType="number-pad"
          placeholder="Email me when it drops to"
          value={target}
          onChangeText={setTarget}
          error={error}
          reserveErrorLine
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button variant="ghost" size="lg" onPress={onBack}>
          Use another link
        </Button>
        <Button block size="lg" onPress={submit} loading={add.isPending} style={{ flex: 1 }}>
          Add to Toki
        </Button>
      </View>
    </View>
  );
}

function ManualStep({ url, onBack }: { url: string; onBack: () => void }) {
  const { list } = useApp();
  const add = useAddItem();
  const finish = useFinish();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState<{ title?: string; price?: string; form?: string }>({});

  async function submit() {
    const minor = parseMinor(price);
    const next = {
      title: title.trim() ? undefined : "Enter the product name.",
      price: minor ? undefined : "Enter the price in rupees, for example 12999.",
    };
    setErrors(next);
    if (next.title || !minor) return;
    const link = url.trim();
    try {
      const item = await add.mutateAsync({
        url: link,
        list_id: list?.id,
        capture: {
          source_url: link,
          title: title.trim(),
          image_url: "",
          price_minor: minor,
          currency: "INR",
          original_price_minor: null,
          in_stock: true,
          retailer: "generic",
        },
      });
      finish(item.product.title);
    } catch (e) {
      setErrors({ form: errorMessage(e, "Toki could not add this item. Try again.") });
    }
  }

  return (
    <View>
      <SheetHeader title="Enter the details" hint="Toki could not read a price on this page. Enter it below." />
      <View style={{ gap: 4 }}>
        <Input label="Product name" value={title} onChangeText={setTitle} error={errors.title} reserveErrorLine autoFocus />
        <Input
          label="Price (₹)"
          keyboardType="number-pad"
          value={price}
          onChangeText={setPrice}
          error={errors.price}
          reserveErrorLine
        />
      </View>
      {errors.form ? (
        <T size="caption" tone="up" style={{ marginBottom: 8 }}>
          {errors.form}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button variant="ghost" size="lg" onPress={onBack}>
          Use another link
        </Button>
        <Button block size="lg" onPress={submit} loading={add.isPending} style={{ flex: 1 }}>
          Add to Toki
        </Button>
      </View>
    </View>
  );
}
