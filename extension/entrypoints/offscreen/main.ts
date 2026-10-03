import { extractCapture } from '@/utils/extract';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'parse') return false;
  const doc = new DOMParser().parseFromString(message.html, 'text/html');
  sendResponse(extractCapture(doc, message.url));
  return false;
});
