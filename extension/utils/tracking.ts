import { trackingItem } from './storage';

export const TRACKING_ORIGINS = ['https://*/*', 'http://*/*'];

/** Must be called directly from a click handler: permissions.request needs a user gesture. */
export async function enableTracking(): Promise<boolean> {
  const granted = await chrome.permissions.request({ origins: TRACKING_ORIGINS });
  if (!granted) return false;
  await trackingItem.setValue({ ...(await trackingItem.getValue()), enabled: true });
  await chrome.runtime.sendMessage({ type: 'refresh-soon' }).catch(() => undefined);
  return true;
}

export async function disableTracking(): Promise<void> {
  await trackingItem.setValue({ ...(await trackingItem.getValue()), enabled: false });
}

/** Tracking runs only when the user opted in and the browser still grants the host access. */
export async function isTrackingActive(): Promise<boolean> {
  const { enabled } = await trackingItem.getValue();
  return enabled && (await chrome.permissions.contains({ origins: TRACKING_ORIGINS }));
}
