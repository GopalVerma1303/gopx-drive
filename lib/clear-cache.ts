/**
 * Clear app caches (React Query persistence, files cache, folders cache, events cache)
 * without touching auth or user preferences (theme, view mode).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { createAsyncStoragePersister } from "./query-persistence";

const CACHE_KEY_PREFIXES = [
  "@react-query-cache",
  "@files_cache",
  "@archived_files_cache",
  "@folders_cache",
  "@archived_folders_cache",
  "@pending_folder_creates",
  "@pending_folder_deletes",
  "@pending_folder_updates",
  "@pending_folder_archives",
  "@pending_folder_restores",
  "@events_cache",
];

function isCacheKey(key: string): boolean {
  if (key === "@react-query-cache") return true;
  return CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Clears all app data caches from AsyncStorage, expo-image, and FileSystem.
 * Does NOT remove auth tokens or preference keys (theme, view mode).
 */
export async function clearAppCache(): Promise<void> {
  // 1. Clear React Query client state
  try {
    const persister = createAsyncStoragePersister();
    await persister.removeClient();
  } catch (e) {
    console.warn("Failed to clear query client:", e);
  }

  // 2. Clear known AsyncStorage cache keys
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(isCacheKey);
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.warn("Failed to clear AsyncStorage cache:", e);
  }

  // 3. Clear expo-image cache (memory + disk)
  try {
    Image.clearMemoryCache();
    await Image.clearDiskCache();
  } catch (e) {
    console.warn("Failed to clear image cache:", e);
  }

  // 4. Clear FileSystem.cacheDirectory contents
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (cacheDir) {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      await Promise.all(
        files.map((file) =>
          FileSystem.deleteAsync(cacheDir + file, { idempotent: true })
        )
      );
    }
  } catch (e) {
    console.warn("Failed to clear filesystem cache:", e);
  }
}

