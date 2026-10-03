import type { TrackingStatus as Status } from '@/utils/use-tracking';
import { timeAgo } from '@/utils/time';

export function trackingSentence(status: Status): string {
  if (!status.enabled) return 'Price tracking is off.';
  if (!status.active) return 'Price tracking is paused because Chrome removed site access.';
  if (!status.lastRun) return 'Price tracking is on. The first check runs soon.';
  const { at, checked } = status.lastRun;
  const noun = checked === 1 ? 'product' : 'products';
  return `Price tracking is on. Last check ${timeAgo(at)}, ${checked} ${noun}.`;
}

export function TrackingStatus({ status }: { status: Status }) {
  return (
    <p className="m-0 flex items-start gap-2 text-[12px] text-muted-foreground">
      <span
        aria-hidden
        className={`mt-[7px] size-1.5 shrink-0 rounded-full ${status.active ? 'bg-jade' : 'bg-muted-foreground/50'}`}
      />
      {trackingSentence(status)}
    </p>
  );
}
