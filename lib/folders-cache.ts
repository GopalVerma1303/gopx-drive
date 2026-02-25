/**
 * Folders cache: persist folder and archived-folder lists in AsyncStorage
 * so they can be shown when offline (e.g. listFolders fails).
 */

import type { Folder } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FOLDERS_CACHE_KEY = "@folders_cache";
const ARCHIVED_FOLDERS_CACHE_KEY = "@archived_folders_cache";

function cacheKey(key: string, userId: string): string {
  return `${key}:${userId}`;
}

export async function getCachedFolders(userId: string): Promise<Folder[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(FOLDERS_CACHE_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Folder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedFolders(
  userId: string,
  folders: Folder[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(FOLDERS_CACHE_KEY, userId),
      JSON.stringify(folders)
    );
  } catch (e) {
    console.error("Failed to cache folders:", e);
  }
}

export async function getCachedArchivedFolders(
  userId: string
): Promise<Folder[]> {
  try {
    const raw = await AsyncStorage.getItem(
      cacheKey(ARCHIVED_FOLDERS_CACHE_KEY, userId)
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Folder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setCachedArchivedFolders(
  userId: string,
  folders: Folder[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(ARCHIVED_FOLDERS_CACHE_KEY, userId),
      JSON.stringify(folders)
    );
  } catch (e) {
    console.error("Failed to cache archived folders:", e);
  }
}
