import { useEffect, useState } from 'react';
import type { WxtStorageItem } from 'wxt/utils/storage';

/** Subscribes to a WXT storage item. Returns undefined until the first read. */
export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let live = true;
    void item.getValue().then((v) => live && setValue(v));
    const unwatch = item.watch((v) => setValue(v));
    return () => {
      live = false;
      unwatch();
    };
  }, [item]);
  return value;
}
