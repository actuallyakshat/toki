import { useEffect, useState } from 'react';
import { Loader } from '@/components/motion/loader';
import { CaptureCard } from '@/components/toki/CaptureCard';
import { SignInForm } from '@/components/toki/SignInForm';
import { TrackingCard } from '@/components/toki/TrackingCard';
import { TrackingStatus } from '@/components/toki/TrackingStatus';
import { api, ApiError } from '@/utils/api';
import { authItem, settingsItem } from '@/utils/storage';
import { captureActiveTab, type TabCapture } from '@/utils/page-capture';
import type { Profile, WishList } from '@/utils/types';
import { useStorageItem } from '@/utils/use-item';
import { useTrackingStatus } from '@/utils/use-tracking';

interface Loaded {
  tab: TabCapture | null;
  lists: WishList[];
  profile: Profile | null;
}

export default function App() {
  const auth = useStorageItem(authItem);
  const settings = useStorageItem(settingsItem);
  const tracking = useTrackingStatus();

  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState('');
  const token = auth?.token;

  useEffect(() => {
    if (!token) {
      setData(undefined);
      return;
    }
    let live = true;
    setError('');
    Promise.all([captureActiveTab(), api.lists(), api.me()])
      .then(([tab, lists, me]) => live && setData({ tab, lists, profile: me.profile }))
      .catch((e) => {
        if (live && !(e instanceof ApiError && e.status === 401)) {
          setError(e instanceof ApiError ? e.message : 'Toki could not load. Try again.');
        }
      });
    return () => {
      live = false;
    };
  }, [token]);

  if (auth === undefined || !settings) return <Shell>{null}</Shell>;
  if (!auth) {
    return (
      <Shell>
        <SignInForm />
      </Shell>
    );
  }

  return (
    <Shell>
      {tracking && !tracking.enabled && <TrackingCard />}

      {error ? (
        <Message>{error}</Message>
      ) : !data ? (
        <div className="grid h-40 place-items-center">
          <Loader variant="dots" size={28} label="Reading this page" />
        </div>
      ) : !data.tab ? (
        <Message>Open a product page, then press the Toki icon.</Message>
      ) : (
        <CaptureCard
          key={data.tab.url}
          tab={data.tab}
          lists={data.lists}
          profile={data.profile}
          webOrigin={settings.webOrigin}
        />
      )}

      <footer className="flex flex-col gap-2 px-1">
        {tracking && <TrackingStatus status={tracking} />}
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span className="truncate">{auth.user.email}</span>
          <span className="flex shrink-0 gap-3">
            <FooterButton onClick={() => chrome.runtime.openOptionsPage()}>Settings</FooterButton>
            <FooterButton onClick={() => authItem.setValue(null)}>Sign out</FooterButton>
          </span>
        </div>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-40 w-[380px] flex-col gap-3 bg-background p-3">{children}</main>;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 rounded-[var(--radius-card)] bg-card p-5 text-[13px] shadow-[var(--shadow-card)]">{children}</p>
  );
}

function FooterButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      {children}
    </button>
  );
}
