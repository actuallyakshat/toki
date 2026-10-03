import type { ExtractResult } from './extract';
import type { SavedItem } from './types';

/**
 * Per-tab results of the prefetch content script, and per-URL lookups of saved items, kept in
 * session storage (memory only, cleared when the browser closes) so the popup opens with data.
 * Only extension pages and the background read and write it; content scripts message the background.
 */

export interface CachedPage {
  url: string;
  title: string;
  result: ExtractResult;
}

const pageKey = (tabId: number) => `page:${tabId}`;
const savedKey = (url: string) => `saved:${url}`;

export async function readCachedPage(tabId: number, url: string): Promise<CachedPage | null> {
  const key = pageKey(tabId);
  const page = (await chrome.storage.session.get(key))[key] as CachedPage | undefined;
  return page?.url === url ? page : null;
}

export async function writeCachedPage(tabId: number, page: CachedPage): Promise<void> {
  await chrome.storage.session.set({ [pageKey(tabId)]: page });
}

export async function clearCachedPage(tabId: number): Promise<void> {
  await chrome.storage.session.remove(pageKey(tabId));
}

export async function readCachedSaved(url: string): Promise<SavedItem[] | null> {
  const key = savedKey(url);
  return ((await chrome.storage.session.get(key))[key] as SavedItem[] | undefined) ?? null;
}

export async function writeCachedSaved(url: string, items: SavedItem[]): Promise<void> {
  await chrome.storage.session.set({ [savedKey(url)]: items });
}
