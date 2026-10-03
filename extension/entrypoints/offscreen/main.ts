import { extractCapture } from '@/utils/extract';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'parse') return false;
  const doc = new DOMParser().parseFromString(message.html, 'text/html');
  // Refresh reads saved products only, so listing detection must not turn one into a failed check.
  sendResponse(extractCapture(doc, message.url, { knownProduct: true }));
  return false;
});
