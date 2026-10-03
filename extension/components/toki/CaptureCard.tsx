import { Check, ImageOff, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSwapButton, type ActionSwapItem } from '@/components/motion/action-swap';
import { Input } from '@/components/motion/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { ListIcon } from '@/components/toki/ListIcon';
import { TimeCost } from '@/components/toki/TimeCost';
import { api, ApiError } from '@/utils/api';
import { currencySymbol, formatAmountInput, parsePriceMinor } from '@/utils/money';
import { timeCost } from '@/utils/time';
import type { TabCapture } from '@/utils/page-capture';
import type { Capture, Profile, SavedItem, WishList } from '@/utils/types';

const RETAILER_NAMES: Record<string, string> = {
  amazon_in: 'Amazon India',
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  shopify: 'Online store',
  generic: 'Online store',
};

/** A short confirmation shown on the button before it settles on its next action. */
type Flash = 'added' | 'exists' | 'removed';
type Phase = 'checking' | 'ready' | 'adding' | 'saved' | 'removing' | Flash;

const FLASH_MS = 1_600;

interface Props {
  tab: TabCapture;
  lists: WishList[];
  profile: Profile | null;
  webOrigin: string;
  /** The user's items for this product; undefined while Toki checks. */
  saved: SavedItem[] | undefined;
  /**
   * The popup's own read of the page finished. Before that the card may show the copy read as the
   * page loaded, which on stores that change pages without a reload can be the previous product.
   */
  pageRead: boolean;
  onSavedChange: (items: SavedItem[]) => void;
}

const fieldShape = { field: 'rounded-[var(--radius-control)]' };

export function CaptureCard({ tab, lists, profile, webOrigin, saved, pageRead, onSavedChange }: Props) {
  const found = tab.result?.capture ?? null;
  const hasPrice = (found?.price_minor ?? 0) > 0;
  const hostname = useMemo(() => new URL(tab.url).hostname.replace(/^www\./, ''), [tab.url]);

  const [title, setTitle] = useState(found?.title || tab.title);
  const [price, setPrice] = useState(hasPrice ? formatAmountInput(found!.price_minor) : '');
  const [target, setTarget] = useState('');
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [busy, setBusy] = useState<'adding' | 'removing' | Flash | null>(null);
  const [error, setError] = useState('');

  // The popup can show the page as it was read on load, then a fresh read. Fields the user
  // has not touched follow the fresh read.
  const edited = useRef({ title: false, price: false });
  useEffect(() => {
    if (!edited.current.title) setTitle(found?.title || tab.title);
    if (!edited.current.price) setPrice(hasPrice ? formatAmountInput(found!.price_minor) : '');
  }, [found?.title, found?.price_minor, hasPrice, tab.title]);

  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  function flash(next: Flash) {
    setBusy(next);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setBusy(null), FLASH_MS);
  }

  const savedListId = saved?.[0]?.list_id;
  const isSaved = savedListId !== undefined;
  const phase: Phase = busy ?? (saved === undefined || !pageRead ? 'checking' : isSaved ? 'saved' : 'ready');
  // A saved product shows the list it is in.
  const shownListId = savedListId && lists.some((l) => l.id === savedListId) ? savedListId : listId;
  const shownList = lists.find((l) => l.id === shownListId);
  const listName = shownList?.name ?? 'Wishlist';
  // Target and list apply only to adding.
  const locked = isSaved || busy !== null;

  const currency = found?.currency ?? 'INR';
  const priceMinor = parsePriceMinor(price);
  const cost = currency === 'INR' && priceMinor ? timeCost(priceMinor, profile) : null;
  const guessed = hasPrice && tab.result && !tab.result.confident;

  const items: ActionSwapItem[] = [
    { id: 'checking', label: 'Checking' },
    { id: 'ready', label: 'Add to Toki' },
    { id: 'adding', label: 'Adding' },
    { id: 'added', label: `Added to ${listName}`, icon: <Check strokeWidth={2.5} /> },
    { id: 'exists', label: `Already in ${listName}`, icon: <Check strokeWidth={2.5} /> },
    { id: 'saved', label: 'Remove from Toki', icon: <Trash2 strokeWidth={2.25} /> },
    { id: 'removing', label: 'Removing' },
    { id: 'removed', label: 'Removed from Toki', icon: <Check strokeWidth={2.5} /> },
  ];

  function press() {
    if (phase === 'ready') void add();
    else if (phase === 'saved') void remove();
  }

  async function remove() {
    setError('');
    setBusy('removing');
    try {
      await Promise.all((saved ?? []).map((item) => api.removeItem(item.id)));
      onSavedChange([]);
      flash('removed');
    } catch (e) {
      setBusy(null);
      setError(e instanceof ApiError ? e.message : 'Toki could not remove this product. Try again.');
    }
  }

  async function add() {
    if (!priceMinor) {
      setError('Enter the price to add this product.');
      return;
    }
    const targetMinor = target.trim() ? parsePriceMinor(target) : null;
    if (target.trim() && !targetMinor) {
      setError('Enter the target price as a number, for example 12,499.');
      return;
    }

    const capture: Capture = {
      source_url: tab.url,
      title: title.trim() || hostname,
      image_url: found?.image_url ?? '',
      price_minor: priceMinor,
      currency,
      original_price_minor: found?.original_price_minor ?? null,
      in_stock: found?.in_stock ?? true,
      retailer: found?.retailer ?? 'generic',
    };

    setError('');
    setBusy('adding');
    try {
      const { data } = await api.addItem({
        url: tab.url,
        list_id: listId || undefined,
        capture,
        target_price_minor: targetMinor ?? undefined,
      });
      // 200 is an existing item: a removed one comes back as wanted, a bought one stays bought.
      if (data.status === 'wanted') {
        onSavedChange([data]);
        flash('added');
        void chrome.runtime.sendMessage({ type: 'item-added' });
      } else {
        flash('exists');
      }
    } catch (e) {
      setBusy(null);
      setError(e instanceof ApiError ? e.message : 'Toki could not add this product. Try again.');
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {/* No frame around the image: multiply blends the store's white backdrop into the popup. */}
      <div className="relative flex h-[160px] items-center justify-center overflow-hidden">
        {found?.image_url ? (
          <img
            src={found.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal"
          />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12px] text-muted-foreground">{found ? RETAILER_NAMES[found.retailer] : hostname}</p>

        {!hasPrice && (
          <p role="status" className="m-0 text-[12px] text-foreground">
            Toki could not read a price on this page. Enter it below.
          </p>
        )}
        {guessed && (
          <p role="status" className="m-0 text-[12px] text-muted-foreground">
            Toki guessed this price from the page text. Check it before you add.
          </p>
        )}

        <Input
          label="Title"
          value={title}
          onChange={(value) => {
            edited.current.title = true;
            setTitle(value);
          }}
          classNames={fieldShape}
          className="[&_input]:text-[13px]"
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Price"
            inputMode="decimal"
            autoFocus={!hasPrice}
            placeholder="0"
            value={price}
            onChange={(value) => {
              edited.current.price = true;
              setPrice(value);
            }}
            leftIcon={<span className="text-lg text-foreground">{currencySymbol(currency).trim()}</span>}
            classNames={{
              field: 'h-14 rounded-[var(--radius-control)]',
              input: 'figure text-[22px] font-semibold pl-11',
              leftIcon: 'left-4',
            }}
          />
          <div className="min-h-5 px-1">
            {cost ? (
              <TimeCost cost={cost} />
            ) : (
              currency === 'INR' &&
              !profile?.monthly_income_minor && (
                <a
                  href={`${webOrigin}/app/settings/hours`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  See this in hours
                </a>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Target price"
            inputMode="decimal"
            placeholder="Optional"
            value={target}
            disabled={locked}
            onChange={setTarget}
            classNames={fieldShape}
          />
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-medium">List</span>
            <Select value={shownListId} onValueChange={setListId} disabled={lists.length === 0 || locked}>
              {/* The trigger draws the selected list itself: SelectValue only shows plain-text labels. */}
              <SelectTrigger className="h-11 rounded-[var(--radius-control)]">
                <ListLabel name={listName} emoji={shownList?.emoji} />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    <ListLabel name={list.name} emoji={list.emoji} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p role="alert" className="m-0 text-[12px] text-destructive">
            {error}
          </p>
        )}

        <ActionSwapButton
          items={items}
          value={phase}
          cycle={false}
          variant={phase === 'saved' || phase === 'removing' ? 'secondary' : 'primary'}
          size="lg"
          animation="roll"
          onClick={press}
          disabled={phase !== 'ready' && phase !== 'saved'}
          className="w-full rounded-[var(--radius-control)] disabled:opacity-100"
        />
        {isSaved && (
          <a
            href={`${webOrigin}/app`}
            target="_blank"
            rel="noreferrer"
            className="self-center text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Open Toki
          </a>
        )}
      </div>
    </section>
  );
}

function ListLabel({ name, emoji }: { name: string; emoji?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ListIcon value={emoji} className="size-3.5" />
      <span className="truncate whitespace-nowrap">{name}</span>
    </span>
  );
}
