import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { extractCapture, type ExtractHints, type ExtractResult } from '@/utils/extract';

declare global {
  interface Window {
    __tokiExtract?: (hints?: ExtractHints) => ExtractResult;
  }
}

/** Injected into the active tab on demand by the popup; it only registers the extractor. */
export default defineUnlistedScript(() => {
  window.__tokiExtract = (hints) => extractCapture(document, location.href, hints);
});
