import { defineContentScript } from 'wxt/utils/define-content-script';
import { extractCapture, mayBeProductPage } from '@/utils/extract';

// Prices on many stores render after the page settles, so the page is read again a little later.
const LOAD_READS_MS = [0, 1_500, 4_000];
// After an in-page navigation the old product stays on screen for a moment, so the first read waits.
const NAVIGATION_READS_MS = [1_000, 3_000];

/**
 * Reads the product on each page as it loads, so the popup opens with it already there. Runs only
 * when the background registers it (price tracking on, which grants the host access). Everything
 * stays in the browser: the result goes to the background, which keeps it in session storage.
 */
export default defineContentScript({
  registration: 'runtime',
  main() {
    let sent = '';
    let timers: ReturnType<typeof setTimeout>[] = [];
    let href = location.href;

    const stop = () => {
      clearInterval(watch);
      timers.forEach(clearTimeout);
    };

    const read = () => {
      // After the extension reloads, this copy of the script can no longer reach it.
      if (!chrome.runtime?.id) return stop();
      const url = location.href;
      if (!mayBeProductPage(document, url)) return;
      const message = { type: 'page-captured', url, title: document.title, result: extractCapture(document, url) };
      const key = JSON.stringify(message);
      if (key === sent) return;
      sent = key;
      try {
        chrome.runtime.sendMessage(message).catch(() => undefined);
      } catch {
        stop();
      }
    };

    const schedule = (delays: number[]) => {
      timers.forEach(clearTimeout);
      timers = delays.map((ms) => setTimeout(read, ms));
    };

    // Stores like Flipkart and Myntra change pages without a reload.
    const watch = setInterval(() => {
      if (location.href === href) return;
      href = location.href;
      schedule(NAVIGATION_READS_MS);
    }, 1_000);

    schedule(LOAD_READS_MS);
  },
});
