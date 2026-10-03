import { describe, expect, it, vi } from 'vitest';
import { checkTask, runRefresh, type RefreshDeps } from '@/utils/refresh';
import type { Capture, RefreshResult, RefreshTask } from '@/utils/types';

const capture = (price = 100000): Capture => ({
  source_url: 'x',
  title: 'Thing',
  image_url: '',
  price_minor: price,
  currency: 'INR',
  original_price_minor: null,
  in_stock: true,
  retailer: 'generic',
});

const task = (id: string, host = 'a.example'): RefreshTask => ({
  product_id: id,
  url: `https://${host}/p/${id}`,
  retailer: 'generic',
});

function makeDeps(queue: RefreshTask[], overrides: Partial<RefreshDeps> = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const posted: RefreshResult[][] = [];
  const fetchedAt: [string, number][] = [];
  const deps: RefreshDeps = {
    fetchTasks: vi.fn(async (limit: number) => queue.splice(0, limit)),
    postResults: vi.fn(async (r: RefreshResult[]) => void posted.push(r)),
    fetchPage: vi.fn(async (url: string) => {
      fetchedAt.push([url, clock]);
      return { status: 200, html: '<html></html>' };
    }),
    parse: vi.fn(async () => ({ capture: capture() })),
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
    canContinue: async () => true,
    ...overrides,
  };
  return { deps, sleeps, posted, fetchedAt };
}

describe('checkTask error mapping', () => {
  const run = (page: { status: number; html: string } | Error, parsed: Capture | null = null) =>
    checkTask(task('1'), {
      fetchPage: async () => {
        if (page instanceof Error) throw page;
        return page;
      },
      parse: async () => ({ capture: parsed }),
    });

  it('returns the capture on success', async () => {
    const r = await run({ status: 200, html: '' }, capture());
    expect(r.error).toBeUndefined();
    expect(r.capture?.price_minor).toBe(100000);
  });
  it('maps rate limits and server errors', async () => {
    expect((await run({ status: 429, html: '' })).error).toMatch(/^blocked/);
    expect((await run({ status: 503, html: '' })).error).toMatch(/^blocked/);
    expect((await run({ status: 404, html: '' })).error).toMatch(/^http_error/);
  });
  it('maps network failures', async () => {
    expect((await run(new Error('offline'))).error).toBe('network_error: offline');
  });
  it('detects robot pages', async () => {
    expect((await run({ status: 200, html: '<title>Robot Check</title>' })).error).toMatch(/^blocked/);
    expect((await run({ status: 200, html: '<div>Enter the characters you see below</div>' })).error).toMatch(/^blocked/);
  });
  it('treats a bare captcha mention as blocked only when there is no price', async () => {
    expect((await run({ status: 200, html: 'captcha.js' })).error).toMatch(/^blocked/);
    expect((await run({ status: 200, html: 'captcha.js' }, capture())).capture).toBeDefined();
  });
  it('reports a missing or zero price', async () => {
    expect((await run({ status: 200, html: '' })).error).toMatch(/^no_price/);
    expect((await run({ status: 200, html: '' }, capture(0))).error).toMatch(/^no_price/);
  });
});

describe('runRefresh', () => {
  it('spaces same-domain requests by 5 s and other domains by 2 s', async () => {
    const { deps, fetchedAt } = makeDeps([task('1'), task('2'), task('3', 'b.example'), task('4', 'b.example')]);
    await runRefresh(deps);
    expect(fetchedAt.map(([, t]) => t)).toEqual([0, 5000, 7000, 12000]);
  });

  it('posts one batch per task poll and stops when the server has no tasks', async () => {
    const queue = Array.from({ length: 7 }, (_, i) => task(String(i), `h${i}.example`));
    const { deps, posted } = makeDeps(queue);
    const summary = await runRefresh(deps);
    expect(posted.map((b) => b.length)).toEqual([5, 2]);
    expect(summary).toEqual({ checked: 7, failed: 0 });
  });

  it('caps a run at 20 products', async () => {
    const queue = Array.from({ length: 40 }, (_, i) => task(String(i), `h${i}.example`));
    const { deps, posted } = makeDeps(queue);
    const summary = await runRefresh(deps);
    expect(summary.checked).toBe(20);
    expect(posted.flat()).toHaveLength(20);
    expect(queue).toHaveLength(20);
  });

  it('sends errors for failures and counts them', async () => {
    const { deps, posted } = makeDeps([task('1'), task('2', 'b.example')], {
      fetchPage: async (url) => ({ status: url.includes('b.example') ? 429 : 200, html: '' }),
    });
    const summary = await runRefresh(deps);
    expect(summary).toEqual({ checked: 2, failed: 1 });
    expect(posted[0]![0]!.capture).toBeDefined();
    expect(posted[0]![1]).toEqual({ product_id: '2', error: 'blocked: HTTP 429' });
  });

  it('does not loop forever when the server repeats a task', async () => {
    const { deps } = makeDeps([], { fetchTasks: async () => [task('same')] });
    const summary = await runRefresh(deps);
    expect(summary.checked).toBe(1);
  });

  it('stops without fetching when the computer is offline or locked, still posting finished results', async () => {
    let calls = 0;
    const { deps, posted } = makeDeps([task('1'), task('2', 'b.example')], {
      canContinue: async () => ++calls < 2,
    });
    const summary = await runRefresh(deps);
    expect(summary.checked).toBe(1);
    expect(posted).toHaveLength(1);
    expect(deps.fetchPage).toHaveBeenCalledTimes(1);
  });
});
