import { useState } from 'react';
import { Button } from '@/components/motion/button';
import { Input } from '@/components/motion/input';
import { Loader } from '@/components/motion/loader';
import { api, ApiError } from '@/utils/api';
import { authItem, settingsItem } from '@/utils/storage';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.signIn(email.trim(), password);
      await authItem.setValue({ token, user });
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'invalid_credentials'
          ? 'That email and password do not match. Check them and try again.'
          : e instanceof ApiError
            ? e.message
            : 'Toki could not sign you in. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    const { webOrigin } = await settingsItem.getValue();
    await chrome.tabs.create({ url: `${webOrigin}/signup` });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 py-2"
    >
      <div>
        <h1 className="figure m-0 text-[22px] font-semibold leading-tight">Sign in to Toki</h1>
        <p className="m-0 mt-1 text-[12px] text-muted-foreground">
          Save products from any store and watch their prices.
        </p>
      </div>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        classNames={{ field: 'rounded-[var(--radius-control)]' }}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={error || undefined}
        classNames={{ field: 'rounded-[var(--radius-control)]' }}
      />
      <Button type="submit" size="lg" disabled={busy} className="w-full rounded-[var(--radius-control)]">
        {busy ? <Loader variant="spinner" size={18} label="Signing in" className="text-primary-foreground" /> : null}
        Sign in
      </Button>
      <button
        type="button"
        onClick={createAccount}
        className="cursor-pointer self-center border-0 bg-transparent p-0 text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Create an account
      </button>
    </form>
  );
}
