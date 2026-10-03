import { router, useLocalSearchParams } from "expo-router";
import { Share2, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Hairline, SheetHeader } from "@/components/chrome";
import { Input } from "@/components/input";
import { iconComponent, SUGGESTED_ICONS } from "@/components/list-icon";
import { T } from "@/components/text";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { appUrl } from "@/lib/config";
import { useCreateList, useDeleteList, useUpdateList } from "@/lib/hooks";
import { DEFAULT_LIST_ICON, iconKey, iconValue } from "@/lib/list-icon-value";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

/** New list (no id) or edit list: name, icon, link sharing and delete. */
export default function ListEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const notify = useToast();
  const { origin } = useSession();
  const { lists, setListId } = useApp();
  const existing = lists.find((l) => l.id === id);
  const create = useCreateList();
  const update = useUpdateList();
  const remove = useDeleteList();

  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.emoji ?? DEFAULT_LIST_ICON);
  const [error, setError] = useState<string>();
  const shared = existing?.visibility === "link";
  const shareLink = existing ? `${appUrl(origin)}/s/${existing.share_slug}` : "";

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the list a name.");
      return;
    }
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, name: trimmed, emoji: icon });
        notify({ status: "success", title: "List saved", description: trimmed });
      } else {
        const list = await create.mutateAsync({ name: trimmed, emoji: icon });
        setListId(list.id);
        notify({ status: "success", title: "List created", description: trimmed });
      }
      router.back();
    } catch (e) {
      setError(errorMessage(e, "Toki could not save this list. Try again."));
    }
  }

  async function setShared(next: boolean) {
    if (!existing) return;
    try {
      await update.mutateAsync({ id: existing.id, visibility: next ? "link" : "private" });
      if (next)
        notify({
          status: "success",
          title: "Anyone with the link can see this list",
          description: "Notes and targets stay private.",
        });
    } catch (e) {
      notify({ status: "error", title: "Toki could not change sharing", description: errorMessage(e, "Try again.") });
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert(`Delete ${existing.name}?`, "Its items are deleted too. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete list",
        style: "destructive",
        onPress: async () => {
          try {
            await remove.mutateAsync(existing.id);
            const fallback = lists.find((l) => l.id !== existing.id);
            if (fallback) setListId(fallback.id);
            notify({ status: "success", title: "List deleted", description: existing.name });
            router.back();
          } catch (e) {
            notify({ status: "error", title: "Toki could not delete this list", description: errorMessage(e, "Try again.") });
          }
        },
      },
    ]);
  }

  const selectedKey = iconKey(icon);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === "android" ? insets.top + 16 : 20,
          paddingBottom: insets.bottom + 32,
          gap: 20,
        }}
      >
        <View>
          <SheetHeader title={existing ? "Edit list" : "New list"} />
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            error={error}
            reserveErrorLine
            autoFocus={!existing}
            maxLength={60}
          />
        </View>

        <View>
          <T size="caption" tone="muted" style={{ marginBottom: 8 }}>
            Icon
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {SUGGESTED_ICONS.map((key) => {
              const Icon = iconComponent(key);
              if (!Icon) return null;
              const selected = selectedKey === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setIcon(iconValue(key))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={key.replace(/-/g, " ")}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: radius.control,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: selected ? c.text : "transparent",
                    backgroundColor: pressed || selected ? c.surfaceSunk : "transparent",
                  })}
                >
                  <Icon size={18} color={selected ? c.text : c.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button block size="lg" onPress={save} loading={create.isPending || (update.isPending && !update.variables?.visibility)}>
          {existing ? "Save list" : "Create list"}
        </Button>

        {existing && (
          <View style={{ gap: 4 }}>
            <Hairline />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 16 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size="lead" weight="medium">
                  Share by link
                </T>
                <T tone="muted">Anyone with the link sees the items and prices. Notes and targets stay private.</T>
              </View>
              <Switch
                value={shared}
                onValueChange={setShared}
                trackColor={{ true: c.purple, false: c.raise }}
                thumbColor="#ffffff"
                ios_backgroundColor={c.raise}
                accessibilityLabel="Share by link"
              />
            </View>
            {shared && (
              <Button variant="secondary" icon={Share2} onPress={() => void Share.share({ message: shareLink, url: shareLink })}>
                Send the link
              </Button>
            )}
            <Hairline style={{ marginTop: 16 }} />
            <Button
              variant="danger"
              icon={Trash2}
              onPress={confirmDelete}
              style={{ alignSelf: "flex-start", marginTop: 12 }}
              disabled={lists.length <= 1}
            >
              Delete list
            </Button>
            {lists.length <= 1 && (
              <T size="caption" tone="faint">
                You cannot delete your last list.
              </T>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
