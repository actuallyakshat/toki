import { useEffect, useState } from 'react';
import { trackingItem, type Tracking } from './storage';
import { TRACKING_ORIGINS } from './tracking';
import { useStorageItem } from './use-item';

export interface TrackingStatus extends Tracking {
  /** Opted in and Chrome still grants the host access. */
  active: boolean;
}

export function useTrackingStatus(): TrackingStatus | undefined {
  const tracking = useStorageItem(trackingItem);
  const [granted, setGranted] = useState<boolean>();

  useEffect(() => {
    const check = () => void chrome.permissions.contains({ origins: TRACKING_ORIGINS }).then(setGranted);
    check();
    chrome.permissions.onAdded.addListener(check);
    chrome.permissions.onRemoved.addListener(check);
    return () => {
      chrome.permissions.onAdded.removeListener(check);
      chrome.permissions.onRemoved.removeListener(check);
    };
  }, []);

  if (!tracking || granted === undefined) return undefined;
  return { ...tracking, active: tracking.enabled && granted };
}
