import { useEffect, useState } from 'react';
import { Button } from '@/components/motion/button';
import { Input } from '@/components/motion/input';
import { Switch } from '@/components/motion/switch';
import { trackingSentence } from '@/components/toki/TrackingStatus';
import { authItem, normaliseOrigin, settingsItem } from '@/utils/storage';
import { disableTracking, enableTracking } from '@/utils/tracking';
import { useStorageItem } from '@/utils/use-item';
import { useTrackingStatus } from '@/utils/use-tracking';

const fieldShape = { field: 'rounded-[var(--radius-control)]' };

export default function App() {
  const auth = useStorageItem(authItem);
  const settings = useStorageItem(settingsItem);
  const tracking = useTrackingStatus();

  const [apiOrigin, setApiOrigin] = useState('');
  const [webOrigin, setWebOrigin] = useState('');
  const [message, setMessage] = useState<{ text: string; bad?: boolean }>();
  const [trackingError, setTrackingError] = useState('');

  useEffect(() => {
    if (!settings) return;
    setApiOrigin(settings.apiOrigin);
    setWebOrigin(settings.webOrigin);
  }, [settings]);

  async function toggleTracking(on: boolean) {
    setTrackingError('');
    if (!on) return disableTracking();
    if (!(await enableTracking())) {
      setTrackingError('Chrome did not grant access, so tracking is still off. Turn it on again and choose Allow.');
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const api = normaliseOrigin(apiOrigin);
    const web = normaliseOrigin(webOrigin);
    if (!api || !web) {
      setMessage({ text: 'Enter each address in full, for example http://localhost:8080.', bad: true });
      return;
    }
    // A server other than the built-in one needs its own host access.
    const granted = await chrome.permissions.request({ origins: [`${api}/*`] });
    if (!granted) {
      setMessage({ text: 'Chrome did not grant access to that API address, so nothing was saved.', bad: true });
      return;
    }
    await settingsItem.setValue({ apiOrigin: api, webOrigin: web });
    setMessage({ text: 'Saved.' });
  }

  if (!settings || !tracking) return null;

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-5 px-4 py-10">
      <h1 className="figure m-0 text-[32px] font-semibold leading-none">Toki settings</h1>

      <Card title="Price tracking">
        <div className="flex items-start justify-between gap-4">
          <p className="m-0 text-[13px]">
            Check prices from this browser about once an hour. Toki opens only the pages on your wishlist, with your
            browser session, so stores that block servers still return a price.
          </p>
          <Switch
            checked={tracking.enabled}
            onCheckedChange={(on) => void toggleTracking(on)}
            ariaLabel="Price tracking"
          />
        </div>
        <p className="m-0 text-[12px] text-muted-foreground">{trackingSentence(tracking)}</p>
        {trackingError && (
          <p role="alert" className="m-0 text-[12px] text-destructive">
            {trackingError}
          </p>
        )}
      </Card>

      <Card title="Account">
        {auth ? (
          <div className="flex items-center justify-between gap-4">
            <p className="m-0 text-[13px]">
              Signed in as <strong className="font-medium">{auth.user.email}</strong>
            </p>
            <Button variant="outline" size="sm" onClick={() => authItem.setValue(null)}>
              Sign out
            </Button>
          </div>
        ) : (
          <p className="m-0 text-[13px] text-muted-foreground">Not signed in. Open the Toki icon in the toolbar to sign in.</p>
        )}
      </Card>

      <form onSubmit={save}>
        <Card title="Addresses">
          <Input label="API address" value={apiOrigin} onChange={setApiOrigin} classNames={fieldShape} />
          <Input label="Website address" value={webOrigin} onChange={setWebOrigin} classNames={fieldShape} />
          <div className="flex items-center gap-4">
            <Button type="submit" size="md" className="rounded-[var(--radius-control)]">
              Save addresses
            </Button>
            {message && (
              <span role="status" className={`text-[12px] ${message.bad ? 'text-destructive' : 'text-muted-foreground'}`}>
                {message.text}
              </span>
            )}
          </div>
        </Card>
      </form>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="figure m-0 text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}
