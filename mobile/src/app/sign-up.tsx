import { Link } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ServerField } from "@/components/server-field";
import { T } from "@/components/text";
import { ApiError, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function SignUp() {
  const session = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [origin, setOrigin] = useState(session.origin);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    const next = {
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : "Enter a valid email address.",
      password: password.length >= 8 && password.length <= 72 ? undefined : "Password must be 8 to 72 characters.",
    };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await session.signUp({ name: name.trim(), email: email.trim(), password, origin });
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.code === "email_taken") setErrors({ email: e.message });
      else setErrors({ form: errorMessage(e, "Toki could not create your account. Try again.") });
    }
  }

  return (
    <AuthShell
      title="Start a wishlist."
      lead="Save things from any store, get an email when the price drops, and see what each one costs in hours."
      footer={
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <T tone="muted">Already have an account?</T>
            <Link href="/sign-in" replace>
              <T weight="medium" tone="highlight">
                Sign in
              </T>
            </Link>
          </View>
          <ServerField value={origin} onChange={setOrigin} />
        </View>
      }
    >
      <Input
        label="Name"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        value={name}
        onChangeText={setName}
        onSubmitEditing={() => emailRef.current?.focus()}
        reserveErrorLine
      />
      <Input
        ref={emailRef}
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={errors.email}
        reserveErrorLine
      />
      <Input
        ref={passwordRef}
        label="Password"
        hint={errors.password ? undefined : "At least 8 characters."}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        error={errors.password}
      />
      {errors.form ? (
        <T size="caption" tone="up" style={{ marginTop: 8 }}>
          {errors.form}
        </T>
      ) : null}
      <Button block size="lg" onPress={submit} loading={busy} trailingIcon={ArrowRight} style={{ marginTop: 16 }}>
        Create account
      </Button>
    </AuthShell>
  );
}
