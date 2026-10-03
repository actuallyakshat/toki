import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { trackingItem } from '@/utils/storage';
import { disableTracking, enableTracking, isTrackingActive, TRACKING_ORIGINS } from '@/utils/tracking';

// The fake browser has no permissions API, so stub just the calls tracking.ts makes.
let granted = false;
beforeEach(() => {
  fakeBrowser.reset();
  granted = false;
  Object.assign(fakeBrowser, {
    permissions: {
      request: vi.fn(async () => granted),
      contains: vi.fn(async () => granted),
    },
  });
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined);
});

describe('tracking opt-in', () => {
  it('is off by default', async () => {
    expect(await isTrackingActive()).toBe(false);
  });

  it('stays off when the user denies host access', async () => {
    expect(await enableTracking()).toBe(false);
    expect((await trackingItem.getValue()).enabled).toBe(false);
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({ origins: TRACKING_ORIGINS });
  });

  it('turns on, asks the worker to refresh soon, and turns off again', async () => {
    granted = true;
    expect(await enableTracking()).toBe(true);
    expect(await isTrackingActive()).toBe(true);
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'refresh-soon' });

    await disableTracking();
    expect(await isTrackingActive()).toBe(false);
  });

  it('is inactive when the browser revoked host access', async () => {
    granted = true;
    await enableTracking();
    granted = false;
    expect(await isTrackingActive()).toBe(false);
  });

  it('keeps lastRun when toggled', async () => {
    const lastRun = { at: 1, checked: 3, failed: 1 };
    await trackingItem.setValue({ enabled: false, lastRun });
    granted = true;
    await enableTracking();
    expect(await trackingItem.getValue()).toEqual({ enabled: true, lastRun });
  });
});
