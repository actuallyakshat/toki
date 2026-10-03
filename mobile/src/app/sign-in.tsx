import { Link } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ServerField } from "@/components/server-field";
import { T } from "@/components/text";
import { errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function SignIn() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [origin, setOrigin] = useState(session.origin);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await session.signIn({ email: email.trim(), password, origin });
    } catch (e) {
      setError(errorMessage(e, "Toki could not sign you in. Try again."));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back."
      lead="Your wishlist, with every price as hours of your work."
      footer={
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <T tone="muted">New to Toki?</T>
            <Link href="/sign-up" replace>
              <T weight="medium" tone="highlight">
                Create an account
              </T>
            </Link>
          </View>
          <ServerField value={origin} onChange={setOrigin} />
        </View>
      }
    >
      <Input
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        reserveErrorLine
      />
      <Input
        ref={passwordRef}
        label="Password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        error={error}
        reserveErrorLine
      />
      <Button block size="lg" onPress={submit} loading={busy} trailingIcon={ArrowRight} style={{ marginTop: 8 }}>
        Sign in
      </Button>
    </AuthShell>
  );
}
