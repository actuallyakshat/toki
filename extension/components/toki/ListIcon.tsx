import { List } from 'lucide-react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import { cn } from '@/lib/utils';

/**
 * A list's icon, the same as the web app's (web/src/components/shared/list-icon.tsx). Icons are
 * stored in the list's `emoji` field as `i:<lucide-name>` and load one at a time; lists made
 * before icons keep a plain emoji.
 */
const NAMES = new Set<string>(iconNames);

/** Short keys from the web app's first, curated icon set, kept so lists saved with them still resolve. */
const LEGACY_KEYS: Record<string, IconName> = {
  bag: 'shopping-bag',
  cart: 'shopping-cart',
  home: 'house',
  sofa: 'armchair',
  plant: 'sprout',
  kitchen: 'utensils',
  party: 'party-popper',
  diya: 'flame',
  phone: 'smartphone',
  gamepad: 'gamepad-2',
  work: 'briefcase',
  gym: 'dumbbell',
  travel: 'plane',
  camping: 'tent',
  pet: 'dog',
};

function resolveIconName(value: string): IconName | null {
  const key = value.slice(2);
  const name = LEGACY_KEYS[key] ?? key;
  return NAMES.has(name) ? (name as IconName) : null;
}

export function ListIcon({ value, className }: { value: string | undefined; className?: string }) {
  if (value && !value.startsWith('i:')) {
    return (
      <span aria-hidden className={cn('grid size-4 shrink-0 place-items-center text-[13px] leading-none', className)}>
        {value}
      </span>
    );
  }
  const name = value ? resolveIconName(value) : null;
  if (!name) return <List aria-hidden className={cn('size-4 shrink-0', className)} />;
  return (
    <DynamicIcon
      name={name}
      aria-hidden
      className={cn('size-4 shrink-0', className)}
      // Same box while the icon's chunk loads, so nothing shifts.
      fallback={() => <span aria-hidden className={cn('inline-block size-4 shrink-0', className)} />}
    />
  );
}
