import { useState } from 'react';
import { Button } from '@/components/motion/button';
import { enableTracking } from '@/utils/tracking';

export function TrackingCard() {
  const [denied, setDenied] = useState(false);

  async function turnOn() {
    setDenied(!(await enableTracking()));
  }

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--toki-purple)_55%,var(--border))] bg-card p-4 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="figure m-0 text-[17px] font-semibold leading-snug">Turn on price tracking</h2>
        <p className="m-0 mt-1 text-[12px] text-muted-foreground">
          Toki checks prices from this browser about once an hour. It opens only the pages on your wishlist.
        </p>
      </div>
      <Button size="md" onClick={turnOn} className="w-full rounded-[var(--radius-control)]">
        Turn on price tracking
      </Button>
      {denied && (
        <p role="alert" className="m-0 text-[12px] text-destructive">
          Chrome did not grant access, so tracking is still off. Press the button again and choose Allow.
        </p>
      )}
    </section>
  );
}
