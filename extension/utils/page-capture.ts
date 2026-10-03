import type { ExtractResult } from './extract';

export interface TabCapture {
  url: string;
  title: string;
  /** Null when the page could not be read; the user then types the details. */
  result: ExtractResult | null;
}

/** Returns null when the active tab is not a web page (chrome://, new tab, and so on). */
export async function captureActiveTab(): Promise<TabCapture | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) return null;
  const target = { tabId: tab.id };
  const base = { url: tab.url, title: tab.title ?? '' };

  try {
    let myx: unknown;
    if (/(^|\.)myntra\.com$/.test(new URL(tab.url).hostname)) {
      const [main] = await chrome.scripting.executeScript({
        target,
        world: 'MAIN',
        func: () => {
          try {
            const pdp = (window as unknown as { __myx?: { pdpData?: unknown } }).__myx?.pdpData;
            return pdp ? JSON.parse(JSON.stringify(pdp)) : null;
          } catch {
            return null;
          }
        },
      });
      myx = main?.result ?? undefined;
    }

    await chrome.scripting.executeScript({ target, files: ['/extract-page.js'] });
    const [run] = await chrome.scripting.executeScript({
      target,
      func: (hints: { myx?: unknown }) =>
        (window as unknown as { __tokiExtract?: (h: unknown) => unknown }).__tokiExtract?.(hints) ?? null,
      args: [{ myx }],
    });
    return { ...base, result: (run?.result as ExtractResult | null) ?? null };
  } catch {
    return { ...base, result: null };
  }
}
