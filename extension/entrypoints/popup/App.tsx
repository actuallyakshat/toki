import { useEffect, useState } from 'react';
import { Loader } from '@/components/motion/loader';
import { CaptureCard } from '@/components/toki/CaptureCard';
import { SignInForm } from '@/components/toki/SignInForm';
import { TrackingCard } from '@/components/toki/TrackingCard';
import { TrackingStatus } from '@/components/toki/TrackingStatus';
import { api, ApiError } from '@/utils/api';
import { retailerFor } from '@/utils/extract';
import { readCachedPage, readCachedSaved, writeCachedSaved } from '@/utils/page-cache';
import { activeWebTab, captureTab, type TabCapture } from '@/utils/page-capture';
import { authItem, isTokiUrl, popupCacheItem, settingsItem } from '@/utils/storage';
import type { Profile, SavedItem, WishList } from '@/utils/types';
import { useStorageItem } from '@/utils/use-item';
import { useTrackingStatus } from '@/utils/use-tracking';

interface Account {
  lists: WishList[];
  profile: Profile | null;
}

export default function App() {
  const auth = useStorageItem(authItem);
  const settings = useStorageItem(settingsItem);
  const tracking = useTrackingStatus();

  const [account, setAccount] = useState<Account>();
  /** Undefined while loading, null when the tab is not a web page. */
  const [page, setPage] = useState<TabCapture | null>();
  /** The user's items for this page's product; undefined until known. */
  const [saved, setSaved] = useState<SavedItem[]>();
  /** The popup's own read of the page finished. Until then the shown copy may be from a previous product. */
  const [pageRead, setPageRead] = useState(false);
  const [addAnyway, setAddAnyway] = useState(false);
  const [onToki, setOnToki] = useState(false);
  const [error, setError] = useState('');
  const token = auth?.token;
  const userId = auth?.user.id;
  // Settings load with auth; until then the page effect waits so it can skip Toki's own pages.
  const loaded = settings !== undefined;

  // Lists and profile: the last ones at once, then fresh ones from the server.
  useEffect(() => {
    if (!token || !userId) {
      setAccount(undefined);
      return;
    }
    let live = true;
    let shown = false;
    setError('');
    void popupCacheItem.getValue().then((cache) => {
      if (!live || cache?.userId !== userId) return;
      shown = true;
      setAccount((current) => current ?? { lists: cache.lists, profile: cache.profile });
    });
    Promise.all([api.lists(), api.me()])
      .then(([lists, me]) => {
        if (!live) return;
        shown = true;
        setAccount({ lists, profile: me.profile });
        void popupCacheItem.setValue({ userId, lists, profile: me.profile });
      })
      .catch((e) => {
        // With cached lists the popup still works; adding reports its own error.
        if (live && !shown && !(e instanceof ApiError && e.status === 401)) {
          setError(e instanceof ApiError ? e.message : 'Toki could not load. Try again.');
        }
      });
    return () => {
      live = false;
    };
  }, [token, userId]);

  // The page: the copy read as it loaded, then a fresh read, since prices can render late.
  useEffect(() => {
    if (!token || !loaded) {
      setPage(undefined);
      setSaved(undefined);
      setPageRead(false);
      return;
    }
    let live = true;
    void (async () => {
      const tab = await activeWebTab();
      if (!live) return;
      if (!tab) {
        setPage(null);
        return;
      }
      if (isTokiUrl(tab.url, await settingsItem.getValue())) {
        if (live) setOnToki(true);
        return;
      }

      void readCachedSaved(tab.url).then((items) => live && items && setSaved((current) => current ?? items));
      api
        .lookupItems(tab.url)
        .then((items) => {
          if (!live) return;
          setSaved(items);
          void writeCachedSaved(tab.url, items);
        })
        // Without the lookup the popup offers Add; the server returns the existing item if there is one.
        .catch(() => live && setSaved((current) => current ?? []));

      const cached = await readCachedPage(tab.id, tab.url);
      if (!live) return;
      if (cached) setPage((current) => current ?? { url: tab.url, title: cached.title, result: cached.result });
      const fresh = await captureTab(tab);
      if (!live) return;
      // A failed read (the page navigated, or blocks scripts) keeps what the prefetch found.
      setPage((current) => (fresh.result === null && current?.result ? current : fresh));
      setPageRead(true);
    })();
    return () => {
      live = false;
    };
  }, [token, loaded]);

  if (auth === undefined || !settings) return <Shell>{null}</Shell>;
  if (!auth) {
    return (
      <Shell>
        <SignInForm />
      </Shell>
    );
  }

  function savedChanged(items: SavedItem[]) {
    setSaved(items);
    if (page) void writeCachedSaved(page.url, items);
  }

  return (
    <Shell>
      {tracking && !tracking.enabled && <TrackingCard />}

      {onToki ? (
        <Message>This is Toki. Open a product in a store, then press the Toki icon to add it.</Message>
      ) : error ? (
        <Message>{error}</Message>
      ) : page === undefined || !account ? (
        <div className="grid h-40 place-items-center">
          <Loader variant="dots" size={28} label="Reading this page" />
        </div>
      ) : page === null ? (
        <Message>Open a product page, then press the Toki icon.</Message>
      ) : page.result?.listing && !addAnyway ? (
        <ListingMessage
          // Known stores' list pages are not products: the server cannot track them.
          onAddAnyway={retailerFor(page.url) === 'generic' ? () => setAddAnyway(true) : undefined}
        />
      ) : (
        <CaptureCard
          key={page.url}
          tab={page}
          lists={account.lists}
          profile={account.profile}
          webOrigin={settings.webOrigin}
          saved={saved}
          pageRead={pageRead}
          onSavedChange={savedChanged}
        />
      )}

      <footer className="flex flex-col gap-2 border-t border-border pt-3">
        {tracking && <TrackingStatus status={tracking} />}
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span className="truncate">{auth.user.email}</span>
          <span className="flex shrink-0 gap-3">
            <FooterButton onClick={() => chrome.runtime.openOptionsPage()}>Settings</FooterButton>
            <FooterButton
              onClick={() => {
                void popupCacheItem.setValue(null);
                void authItem.setValue(null);
              }}
            >
              Sign out
            </FooterButton>
          </span>
        </div>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-40 w-[380px] flex-col gap-4 bg-background p-4">{children}</main>;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 py-6 text-center text-[13px] text-muted-foreground">{children}</p>
  );
}

function ListingMessage({ onAddAnyway }: { onAddAnyway?: () => void }) {
  return (
    <section className="flex flex-col gap-2 py-4 text-[13px]">
      <p className="m-0 font-medium">This page shows many products.</p>
      <p className="m-0 text-muted-foreground">Open the product you want, then press the Toki icon.</p>
      {onAddAnyway && (
        <button
          type="button"
          onClick={onAddAnyway}
          className="cursor-pointer self-start border-0 bg-transparent p-0 text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Add this page anyway
        </button>
      )}
    </section>
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
