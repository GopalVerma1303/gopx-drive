/**
 * Folders cache: persist folder and archived-folder lists in AsyncStorage
 * so they can be shown when offline (e.g. listFolders fails).
 */

import type { Folder } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FOLDERS_CACHE_KEY = "@folders_cache";
const ARCHIVED_FOLDERS_CACHE_KEY = "@archived_folders_cache";
const PENDING_CREATES_KEY = "@pending_folder_creates";
const PENDING_DELETES_KEY = "@pending_folder_deletes";
const PENDING_UPDATES_KEY = "@pending_folder_updates";
const PENDING_ARCHIVES_KEY = "@pending_folder_archives";
const PENDING_RESTORES_KEY = "@pending_folder_restores";

function cacheKey(key: string, userId: string): string {
  return `${key}:${userId}`;
}

export type PendingFolderCreate = { id: string; name: string; user_id: string };

export async function getPendingCreates(userId: string): Promise<PendingFolderCreate[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(PENDING_CREATES_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingFolderCreate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPendingCreate(
  userId: string,
  item: PendingFolderCreate
): Promise<void> {
  const list = await getPendingCreates(userId);
  await AsyncStorage.setItem(
    cacheKey(PENDING_CREATES_KEY, userId),
    JSON.stringify([...list.filter((p) => p.id !== item.id), item])
  );
}

export async function removePendingCreate(
  userId: string,
  tempId: string
): Promise<void> {
  const list = (await getPendingCreates(userId)).filter((p) => p.id !== tempId);
  await AsyncStorage.setItem(
    cacheKey(PENDING_CREATES_KEY, userId),
    JSON.stringify(list)
  );
}

export async function getPendingDeletes(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(PENDING_DELETES_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPendingDelete(userId: string, folderId: string): Promise<void> {
  const list = await getPendingDeletes(userId);
  if (list.includes(folderId)) return;
  await AsyncStorage.setItem(
    cacheKey(PENDING_DELETES_KEY, userId),
    JSON.stringify([...list, folderId])
  );
}

export async function removePendingDelete(
  userId: string,
  folderId: string
): Promise<void> {
  const list = (await getPendingDeletes(userId)).filter((id) => id !== folderId);
  await AsyncStorage.setItem(
    cacheKey(PENDING_DELETES_KEY, userId),
    JSON.stringify(list)
  );
}

export type PendingFolderUpdate = { folderId: string; name: string };

export async function getPendingFolderUpdates(
  userId: string
): Promise<PendingFolderUpdate[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(PENDING_UPDATES_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingFolderUpdate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPendingFolderUpdate(
  userId: string,
  folderId: string,
  name: string
): Promise<void> {
  const list = (await getPendingFolderUpdates(userId)).filter(
    (u) => u.folderId !== folderId
  );
  await AsyncStorage.setItem(
    cacheKey(PENDING_UPDATES_KEY, userId),
    JSON.stringify([...list, { folderId, name }])
  );
}

export async function removePendingFolderUpdate(
  userId: string,
  folderId: string
): Promise<void> {
  const list = (await getPendingFolderUpdates(userId)).filter(
    (u) => u.folderId !== folderId
  );
  await AsyncStorage.setItem(
    cacheKey(PENDING_UPDATES_KEY, userId),
    JSON.stringify(list)
  );
}

export async function getPendingArchives(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(
      cacheKey(PENDING_ARCHIVES_KEY, userId)
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPendingArchive(
  userId: string,
  folderId: string
): Promise<void> {
  const list = await getPendingArchives(userId);
  if (list.includes(folderId)) return;
  await AsyncStorage.setItem(
    cacheKey(PENDING_ARCHIVES_KEY, userId),
    JSON.stringify([...list, folderId])
  );
}

export async function removePendingArchive(
  userId: string,
  folderId: string
): Promise<void> {
  const list = (await getPendingArchives(userId)).filter((id) => id !== folderId);
  await AsyncStorage.setItem(
    cacheKey(PENDING_ARCHIVES_KEY, userId),
    JSON.stringify(list)
  );
}

export async function getPendingRestores(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(
      cacheKey(PENDING_RESTORES_KEY, userId)
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPendingRestore(
  userId: string,
  folderId: string
): Promise<void> {
  const list = await getPendingRestores(userId);
  if (list.includes(folderId)) return;
  await AsyncStorage.setItem(
    cacheKey(PENDING_RESTORES_KEY, userId),
    JSON.stringify([...list, folderId])
  );
}

export async function removePendingRestore(
  userId: string,
  folderId: string
): Promise<void> {
  const list = (await getPendingRestores(userId)).filter((id) => id !== folderId);
  await AsyncStorage.setItem(
    cacheKey(PENDING_RESTORES_KEY, userId),
    JSON.stringify(list)
  );
}

/** Cached folders list with pending creates included, pending deletes excluded, and pending renames applied. */
export async function getCachedFoldersWithPending(userId: string): Promise<Folder[]> {
  const [cached, pendingDeletes, pendingUpdates] = await Promise.all([
    getCachedFolders(userId),
    getPendingDeletes(userId),
    getPendingFolderUpdates(userId),
  ]);
  const deleteSet = new Set(pendingDeletes);
  const updateMap = new Map(
    pendingUpdates.map((u) => [u.folderId, u.name])
  );
  return cached
    .filter((f) => !deleteSet.has(f.id))
    .map((f) => {
      const name = updateMap.get(f.id);
      return name !== undefined ? { ...f, name, updated_at: new Date().toISOString() } : f;
    });
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

/** Add or replace a folder in the active folders cache (e.g. after create or restore). */
export async function addFolderToCache(
  userId: string,
  folder: Folder
): Promise<void> {
  const list = await getCachedFolders(userId);
  const without = list.filter((f) => f.id !== folder.id);
  await setCachedFolders(userId, [...without, folder]);
}

/** Remove a folder from both active and archived caches (e.g. after delete). */
export async function removeFolderFromCache(
  userId: string,
  folderId: string
): Promise<void> {
  const [active, archived] = await Promise.all([
    getCachedFolders(userId),
    getCachedArchivedFolders(userId),
  ]);
  await Promise.all([
    setCachedFolders(userId, active.filter((f) => f.id !== folderId)),
    setCachedArchivedFolders(
      userId,
      archived.filter((f) => f.id !== folderId)
    ),
  ]);
}

/** Update a folder in cache (e.g. after rename). */
export async function updateFolderInCache(
  userId: string,
  folderId: string,
  updates: Partial<Pick<Folder, "name" | "updated_at">>
): Promise<void> {
  const list = await getCachedFolders(userId);
  const idx = list.findIndex((f) => f.id === folderId);
  if (idx === -1) return;
  const next = [...list];
  next[idx] = { ...next[idx], ...updates };
  await setCachedFolders(userId, next);
  const archived = await getCachedArchivedFolders(userId);
  const archIdx = archived.findIndex((f) => f.id === folderId);
  if (archIdx !== -1) {
    const nextArch = [...archived];
    nextArch[archIdx] = { ...nextArch[archIdx], ...updates };
    await setCachedArchivedFolders(userId, nextArch);
  }
}

/** Move folder from active to archived cache (e.g. after archive). */
export async function moveFolderToArchivedInCache(
  userId: string,
  folder: Folder
): Promise<void> {
  const [active, archived] = await Promise.all([
    getCachedFolders(userId),
    getCachedArchivedFolders(userId),
  ]);
  const updated = { ...folder, is_archived: true };
  await Promise.all([
    setCachedFolders(userId, active.filter((f) => f.id !== folder.id)),
    setCachedArchivedFolders(userId, [
      ...archived.filter((f) => f.id !== folder.id),
      updated,
    ]),
  ]);
}

/** Move folder from archived to active cache (e.g. after restore). */
export async function moveFolderToActiveInCache(
  userId: string,
  folder: Folder
): Promise<void> {
  const [active, archived] = await Promise.all([
    getCachedFolders(userId),
    getCachedArchivedFolders(userId),
  ]);
  const updated = { ...folder, is_archived: false };
  await Promise.all([
    setCachedFolders(userId, [...active.filter((f) => f.id !== folder.id), updated]),
    setCachedArchivedFolders(userId, archived.filter((f) => f.id !== folder.id)),
  ]);
}
