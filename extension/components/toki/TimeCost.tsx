import { NumberTicker } from '@/components/motion/number-ticker';
import type { TimeCost as Cost } from '@/utils/time';

const ticker = { startOnView: false, duration: 0.6, stagger: 0.02 } as const;

export function TimeCost({ cost }: { cost: Cost }) {
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-x-1 text-[12px] text-muted-foreground">
      <span>≈</span>
      {cost.kind === 'minutes' && <NumberTicker {...ticker} value={cost.minutes} suffix=" min" className="text-foreground" />}
      {cost.kind === 'hours' && (
        <>
          <NumberTicker {...ticker} value={cost.hours} suffix=" h" className="text-foreground" />
          {cost.minutes > 0 && (
            <NumberTicker {...ticker} value={cost.minutes} suffix=" min" className="text-foreground" />
          )}
        </>
      )}
      {cost.kind === 'workdays' && (
        <NumberTicker
          {...ticker}
          value={Math.round(cost.days * 10)}
          format={(v) => (v / 10).toFixed(1)}
          suffix={cost.days === 1 ? ' workday' : ' workdays'}
          className="text-foreground"
        />
      )}
      <span>of work</span>
    </p>
  );
}
