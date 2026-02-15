/**
 * Clear app caches (React Query persistence, files cache, events cache)
 * without touching auth or user preferences (theme, view mode).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "./query-persistence";

const CACHE_KEY_PREFIXES = [
  "@react-query-cache",
  "@files_cache",
  "@archived_files_cache",
  "@events_cache",
];

function isCacheKey(key: string): boolean {
  if (key === "@react-query-cache") return true;
  return CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Clears all app data caches from AsyncStorage.
 * Does NOT remove auth tokens or preference keys (theme, view mode).
 */
export async function clearAppCache(): Promise<void> {
  const persister = createAsyncStoragePersister();
  await persister.removeClient();

  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter(isCacheKey);
  await Promise.all(toRemove.map((key) => AsyncStorage.removeItem(key)));
}
