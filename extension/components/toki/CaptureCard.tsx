import { Check, ImageOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionSwapButton, type ActionSwapItem } from '@/components/motion/action-swap';
import { Input } from '@/components/motion/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/motion/select';
import { TimeCost } from '@/components/toki/TimeCost';
import { api, ApiError } from '@/utils/api';
import { currencySymbol, formatAmountInput, parsePriceMinor } from '@/utils/money';
import { timeCost } from '@/utils/time';
import type { TabCapture } from '@/utils/page-capture';
import type { Capture, Profile, WishList } from '@/utils/types';

const RETAILER_NAMES: Record<string, string> = {
  amazon_in: 'Amazon India',
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  shopify: 'Online store',
  generic: 'Online store',
};

type Phase = 'ready' | 'adding' | 'added' | 'exists';

interface Props {
  tab: TabCapture;
  lists: WishList[];
  profile: Profile | null;
  webOrigin: string;
}

const fieldShape = { field: 'rounded-[var(--radius-control)]' };

export function CaptureCard({ tab, lists, profile, webOrigin }: Props) {
  const found = tab.result?.capture ?? null;
  const hasPrice = (found?.price_minor ?? 0) > 0;
  const hostname = useMemo(() => new URL(tab.url).hostname.replace(/^www\./, ''), [tab.url]);

  const [title, setTitle] = useState(found?.title || tab.title);
  const [price, setPrice] = useState(hasPrice ? formatAmountInput(found!.price_minor) : '');
  const [target, setTarget] = useState('');
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState('');

  const currency = found?.currency ?? 'INR';
  const priceMinor = parsePriceMinor(price);
  const cost = currency === 'INR' && priceMinor ? timeCost(priceMinor, profile) : null;
  const listName = lists.find((l) => l.id === listId)?.name ?? 'Wishlist';
  const guessed = hasPrice && tab.result && !tab.result.confident;

  const items: ActionSwapItem[] = [
    { id: 'ready', label: 'Add to Toki' },
    { id: 'adding', label: 'Adding' },
    { id: 'added', label: `Added to ${listName}`, icon: <Check strokeWidth={2.5} /> },
    { id: 'exists', label: `Already in ${listName}`, icon: <Check strokeWidth={2.5} /> },
  ];

  async function add() {
    if (phase !== 'ready') return;
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
    setPhase('adding');
    try {
      const { status } = await api.addItem({
        url: tab.url,
        list_id: listId || undefined,
        capture,
        target_price_minor: targetMinor ?? undefined,
      });
      setPhase(status === 200 ? 'exists' : 'added');
      if (status !== 200) void chrome.runtime.sendMessage({ type: 'item-added' });
    } catch (e) {
      setPhase('ready');
      setError(e instanceof ApiError ? e.message : 'Toki could not add this product. Try again.');
    }
  }

  const done = phase === 'added' || phase === 'exists';

  return (
    <section className="rounded-[var(--radius-card)] bg-card p-2.5 shadow-[var(--shadow-card)]">
      <div className="relative flex h-[168px] items-center justify-center overflow-hidden rounded-[var(--radius-image)] bg-muted">
        {found?.image_url ? (
          <img
            src={found.image_url}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain p-2 mix-blend-multiply dark:mix-blend-normal"
          />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="flex flex-col gap-3 px-1.5 pb-1.5 pt-3">
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
          onChange={setTitle}
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
            onChange={setPrice}
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
            onChange={setTarget}
            classNames={fieldShape}
          />
          <div className="flex flex-col gap-1.5">
            <span className="px-1 text-sm font-medium">List</span>
            <Select value={listId} onValueChange={setListId} disabled={lists.length === 0}>
              <SelectTrigger className="h-11 rounded-[var(--radius-control)]">
                <SelectValue placeholder="Wishlist" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.emoji && !list.emoji.startsWith('i:') ? `${list.emoji} ${list.name}` : list.name}
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
          variant="primary"
          size="lg"
          animation="roll"
          onClick={add}
          disabled={phase === 'adding'}
          className="w-full rounded-[var(--radius-control)]"
        />
        {done && (
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
