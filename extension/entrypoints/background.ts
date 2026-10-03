import { defineBackground } from 'wxt/utils/define-background';
import { api } from '@/utils/api';
import { clearCachedPage, writeCachedPage } from '@/utils/page-cache';
import { authItem, isTokiUrl, settingsItem, trackingItem } from '@/utils/storage';
import { isTrackingActive, TRACKING_ORIGINS } from '@/utils/tracking';
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

const PREFETCH_ID = 'toki-prefetch';

/**
 * The prefetch content script reads product pages as they load. It uses the same host access as
 * price tracking, so it runs exactly while tracking is active. Registrations persist across
 * sessions and a duplicate id throws, so this checks what is registered first.
 */
async function syncPrefetch(): Promise<void> {
  const want = await isTrackingActive();
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [PREFETCH_ID] });
  if (want && registered.length === 0) {
    await chrome.scripting.registerContentScripts([
      {
        id: PREFETCH_ID,
        js: ['content-scripts/prefetch.js'],
        matches: TRACKING_ORIGINS,
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
  } else if (!want && registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [PREFETCH_ID] });
  }
}

function syncPrefetchSafely(): void {
  syncPrefetch().catch((error) => console.warn('Toki could not update page prefetch:', error));
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

  syncPrefetchSafely();
  trackingItem.watch(syncPrefetchSafely);
  chrome.permissions.onAdded.addListener(syncPrefetchSafely);
  chrome.permissions.onRemoved.addListener(syncPrefetchSafely);
  chrome.tabs.onRemoved.addListener((tabId) => void clearCachedPage(tabId));

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM || alarm.name === REFRESH_SOON_ALARM) void refreshPrices();
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'refresh-soon') scheduleSoon();
    const tabId = sender.tab?.id;
    if (message?.type === 'page-captured' && tabId !== undefined) {
      void settingsItem.getValue().then((settings) => {
        if (isTokiUrl(message.url, settings)) return;
        return writeCachedPage(tabId, { url: message.url, title: message.title, result: message.result });
      });
    }
    if (message?.type === 'item-added') {
      void chrome.action.setBadgeBackgroundColor({ color: '#2e8540' });
      void chrome.action.setBadgeText({ text: '✓' });
      setTimeout(() => void chrome.action.setBadgeText({ text: '' }), BADGE_MS);
    }
  });
});
