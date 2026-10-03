import { defineBackground } from 'wxt/utils/define-background';
import { api } from '@/utils/api';
import { authItem, trackingItem } from '@/utils/storage';
import { isTrackingActive } from '@/utils/tracking';
import { runRefresh, type RefreshDeps } from '@/utils/refresh';
import type { ExtractResult } from '@/utils/extract';

const REFRESH_ALARM = 'toki-refresh';
const REFRESH_SOON_ALARM = 'toki-refresh-soon';
const BADGE_MS = 3_000;

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER' as chrome.offscreen.Reason],
    justification: 'Parse fetched product pages to read their current price.',
  });
}

async function parseInOffscreen(html: string, url: string): Promise<ExtractResult> {
  await ensureOffscreen();
  return chrome.runtime.sendMessage({ target: 'offscreen', type: 'parse', html, url });
}

const deps: RefreshDeps = {
  fetchTasks: (limit) => api.refreshTasks(limit),
  postResults: (results) => api.refreshResults(results),
  async fetchPage(url) {
    const response = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(20_000) });
    return { status: response.status, html: await response.text() };
  },
  parse: parseInOffscreen,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  async canContinue() {
    if (!navigator.onLine) return false;
    return (await chrome.idle.queryState(60)) !== 'locked';
  },
};

let running = false;

async function refreshPrices(): Promise<void> {
  if (running || !navigator.onLine) return;
  if (!(await authItem.getValue()) || !(await isTrackingActive())) return;
  if ((await chrome.idle.queryState(60)) === 'locked') return;

  running = true;
  try {
    const summary = await runRefresh(deps);
    const tracking = await trackingItem.getValue();
    await trackingItem.setValue({ ...tracking, lastRun: { at: Date.now(), ...summary } });
  } catch (error) {
    console.warn('Toki price refresh stopped:', error);
  } finally {
    running = false;
  }
}

function scheduleSoon(): void {
  chrome.alarms.create(REFRESH_SOON_ALARM, { delayInMinutes: 1 });
}

export default defineBackground(() => {
  // The service worker restarts often; re-creating the alarm each time would reset its countdown.
  void chrome.alarms.get(REFRESH_ALARM).then((alarm) => {
    if (!alarm) chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 30 });
  });

  chrome.runtime.onInstalled.addListener(scheduleSoon);
  chrome.runtime.onStartup.addListener(scheduleSoon);

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM || alarm.name === REFRESH_SOON_ALARM) void refreshPrices();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'refresh-soon') scheduleSoon();
    if (message?.type === 'item-added') {
      void chrome.action.setBadgeBackgroundColor({ color: '#2e8540' });
      void chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => void chrome.action.setBadgeText({ text: '' }), BADGE_MS);
    }
  });
});
