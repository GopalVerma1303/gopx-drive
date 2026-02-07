/**
 * Files cache: persist file and archived-file lists in AsyncStorage
 * so they can be shown when offline (e.g. listFiles fails).
 */

import type { File } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FILES_CACHE_KEY = "@files_cache";
const ARCHIVED_FILES_CACHE_KEY = "@archived_files_cache";

function cacheKey(key: string, userId: string): string {
  return `${key}:${userId}`;
}

export async function getCachedFiles(userId: string): Promise<File[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(FILES_CACHE_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as File[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedFiles(userId: string, files: File[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(FILES_CACHE_KEY, userId),
      JSON.stringify(files)
    );
  } catch (e) {
    console.error("Failed to cache files:", e);
  }
}

export async function getCachedArchivedFiles(userId: string): Promise<File[]> {
  try {
    const raw = await AsyncStorage.getItem(
      cacheKey(ARCHIVED_FILES_CACHE_KEY, userId)
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as File[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedArchivedFiles(
  userId: string,
  files: File[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(ARCHIVED_FILES_CACHE_KEY, userId),
      JSON.stringify(files)
    );
  } catch (e) {
    console.error("Failed to cache archived files:", e);
  }
}
