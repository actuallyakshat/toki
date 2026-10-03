import type { Capture, RefreshResult, RefreshTask } from './types';

export const SAME_DOMAIN_GAP_MS = 5_000;
export const OTHER_DOMAIN_GAP_MS = 2_000;
export const MAX_PRODUCTS_PER_RUN = 20;
export const BATCH_SIZE = 5;

export interface FetchedPage {
  status: number;
  html: string;
}

export interface RefreshDeps {
  fetchTasks(limit: number): Promise<RefreshTask[]>;
  postResults(results: RefreshResult[]): Promise<void>;
  /** Rejects on network failure. */
  fetchPage(url: string): Promise<FetchedPage>;
  parse(html: string, url: string): Promise<{ capture: Capture | null }>;
  sleep(ms: number): Promise<void>;
  now(): number;
  /** Checked before each page fetch; false stops the run (offline, locked screen). */
  canContinue(): Promise<boolean>;
}

export interface RunSummary {
  checked: number;
  failed: number;
}

const HARD_BLOCK = /Robot Check|Enter the characters you see|Type the characters you see/i;
// A bare "captcha" appears in many healthy pages (script names), so it only counts when no price was found.
const SOFT_BLOCK = /captcha/i;

/** Maps a fetched page to a result for the server. Error strings are what the server stores as the failure reason. */
export async function checkTask(
  task: RefreshTask,
  deps: Pick<RefreshDeps, 'fetchPage' | 'parse'>,
): Promise<RefreshResult> {
  let page: FetchedPage;
  try {
    page = await deps.fetchPage(task.url);
  } catch (error) {
    return { product_id: task.product_id, error: `network_error: ${(error as Error).message}` };
  }

  if (page.status === 429 || page.status === 503) {
    return { product_id: task.product_id, error: `blocked: HTTP ${page.status}` };
  }
  if (page.status < 200 || page.status >= 300) {
    return { product_id: task.product_id, error: `http_error: HTTP ${page.status}` };
  }
  if (HARD_BLOCK.test(page.html)) {
    return { product_id: task.product_id, error: 'blocked: robot check page' };
  }

  let capture: Capture | null = null;
  try {
    capture = (await deps.parse(page.html, task.url)).capture;
  } catch (error) {
    return { product_id: task.product_id, error: `parse_error: ${(error as Error).message}` };
  }

  if (capture && capture.price_minor > 0 && capture.title) {
    return { product_id: task.product_id, capture: { ...capture, source_url: task.url } };
  }
  return {
    product_id: task.product_id,
    error: SOFT_BLOCK.test(page.html) ? 'blocked: captcha page' : 'no_price: no price found on the page',
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Pulls task batches until the server has none left or the per-run cap is reached. */
export async function runRefresh(deps: RefreshDeps, maxProducts = MAX_PRODUCTS_PER_RUN): Promise<RunSummary> {
  const summary: RunSummary = { checked: 0, failed: 0 };
  const lastByHost = new Map<string, number>();
  let lastAny: number | null = null;
  const seen = new Set<string>();

  while (summary.checked < maxProducts) {
    const tasks = (await deps.fetchTasks(Math.min(BATCH_SIZE, maxProducts - summary.checked))).filter(
      (task) => !seen.has(task.product_id),
    );
    if (tasks.length === 0) break;

    const results: RefreshResult[] = [];
    let stopped = false;
    for (const task of tasks) {
      seen.add(task.product_id);
      if (!(await deps.canContinue())) {
        stopped = true;
        break;
      }

      const host = hostOf(task.url);
      const hostLast = lastByHost.get(host);
      const wait = Math.max(
        hostLast === undefined ? 0 : hostLast + SAME_DOMAIN_GAP_MS - deps.now(),
        lastAny === null ? 0 : lastAny + OTHER_DOMAIN_GAP_MS - deps.now(),
      );
      if (wait > 0) await deps.sleep(wait);

      const result = await checkTask(task, deps);
      lastByHost.set(host, deps.now());
      lastAny = deps.now();
      results.push(result);
      summary.checked += 1;
      if (result.error) summary.failed += 1;
    }

    if (results.length > 0) await deps.postResults(results);
    if (stopped) break;
  }
  return summary;
}
