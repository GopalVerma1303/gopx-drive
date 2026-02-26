import { deleteFile } from "@/lib/files";
import {
  addFolderToCache,
  addPendingArchive,
  addPendingCreate,
  addPendingDelete,
  addPendingFolderUpdate,
  addPendingRestore,
  getCachedArchivedFolders,
  getCachedFolders,
  getCachedFoldersWithPending,
  getPendingArchives,
  getPendingCreates,
  getPendingDeletes,
  getPendingFolderUpdates,
  getPendingRestores,
  moveFolderToActiveInCache,
  moveFolderToArchivedInCache,
  removeFolderFromCache,
  removePendingArchive,
  removePendingCreate,
  removePendingDelete,
  removePendingFolderUpdate,
  removePendingRestore,
  setCachedArchivedFolders,
  setCachedFolders,
  updateFolderInCache,
} from "@/lib/folders-cache";
import { deleteNote } from "@/lib/notes";
import type { Folder } from "@/lib/supabase";
import * as supabaseFolders from "@/lib/supabase-folders";

/** Sync pending folder creates, updates, archive/restore, and deletes to Supabase. Does not fetch list; caller fetches after. */
async function syncPendingFolderOperations(userId: string): Promise<void> {
  const creates = await getPendingCreates(userId);
  for (const p of creates) {
    try {
      const folder = await supabaseFolders.createFolder({
        user_id: p.user_id,
        name: p.name,
      });
      await removePendingCreate(userId, p.id);
      await removeFolderFromCache(userId, p.id);
      await addFolderToCache(userId, folder);
    } catch {
      // keep in pending for next sync
    }
  }
  const updates = await getPendingFolderUpdates(userId);
  for (const u of updates) {
    try {
      await supabaseFolders.updateFolder(u.folderId, { name: u.name });
      await removePendingFolderUpdate(userId, u.folderId);
    } catch {
      // keep in pending for next sync
    }
  }
  const toArchive = await getPendingArchives(userId);
  for (const folderId of toArchive) {
    try {
      await supabaseFolders.archiveFolder(folderId);
      await removePendingArchive(userId, folderId);
    } catch {
      // keep in pending for next sync
    }
  }
  const toRestore = await getPendingRestores(userId);
  for (const folderId of toRestore) {
    try {
      await supabaseFolders.restoreFolder(folderId);
      await removePendingRestore(userId, folderId);
    } catch {
      // keep in pending for next sync
    }
  }
  const deletes = await getPendingDeletes(userId);
  for (const folderId of deletes) {
    try {
      await deleteFolder(folderId, { userId });
    } catch {
      // folder may already be deleted on server; clear pending so we don't retry forever
    }
    await removePendingDelete(userId, folderId);
  }
}

export const listFolders = async (userId?: string): Promise<Folder[]> => {
  if (!userId) return [];
  try {
    await syncPendingFolderOperations(userId);
    const folders = await supabaseFolders.listFolders(userId);
    await setCachedFolders(userId, folders);
    return folders;
  } catch (err) {
    const cached = await getCachedFoldersWithPending(userId);
    if (cached.length > 0) return cached;
    throw err;
  }
};

export const listArchivedFolders = async (userId?: string): Promise<Folder[]> => {
  if (!userId) return [];
  try {
    const folders = await supabaseFolders.listArchivedFolders(userId);
    await setCachedArchivedFolders(userId, folders);
    return folders;
  } catch {
    return getCachedArchivedFolders(userId);
  }
};

export const getFolderById = async (id: string): Promise<Folder | null> => {
  return supabaseFolders.getFolderById(id);
};

function tempFolderId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const createFolder = async (input: {
  user_id: string;
  name: string;
}): Promise<Folder> => {
  try {
    const folder = await supabaseFolders.createFolder(input);
    await addFolderToCache(input.user_id, folder);
    return folder;
  } catch (err) {
    const now = new Date().toISOString();
    const tempId = tempFolderId();
    const folder: Folder = {
      id: tempId,
      user_id: input.user_id,
      name: input.name.trim() || "Unnamed folder",
      is_archived: false,
      created_at: now,
      updated_at: now,
    };
    await addFolderToCache(input.user_id, folder);
    await addPendingCreate(input.user_id, { id: tempId, name: folder.name, user_id: input.user_id });
    return folder;
  }
};

export const updateFolder = async (
  id: string,
  updates: Partial<Pick<Folder, "name">>,
  options?: { userId?: string }
): Promise<Folder | null> => {
  try {
    const result = await supabaseFolders.updateFolder(id, updates);
    if (result)
      await updateFolderInCache(result.user_id, id, {
        name: result.name,
        updated_at: result.updated_at,
      });
    return result;
  } catch (err) {
    const userId = options?.userId;
    if (userId && updates.name !== undefined) {
      const cached = await getCachedFolders(userId);
      const archived = await getCachedArchivedFolders(userId);
      const folder = cached.find((f) => f.id === id) ?? archived.find((f) => f.id === id);
      if (folder) {
        const now = new Date().toISOString();
        await updateFolderInCache(userId, id, { name: updates.name, updated_at: now });
        await addPendingFolderUpdate(userId, id, updates.name);
        return { ...folder, name: updates.name, updated_at: now };
      }
    }
    throw err;
  }
};

export const archiveFolder = async (
  id: string,
  options?: { userId?: string }
): Promise<void> => {
  try {
    await supabaseFolders.archiveFolder(id);
    const folder = await supabaseFolders.getFolderById(id);
    if (folder) await moveFolderToArchivedInCache(folder.user_id, folder);
  } catch (err) {
    const userId = options?.userId;
    if (userId) {
      const cached = await getCachedFolders(userId);
      const folder = cached.find((f) => f.id === id);
      if (folder) {
        await moveFolderToArchivedInCache(userId, folder);
        await addPendingArchive(userId, id);
        return;
      }
    }
    throw err;
  }
};

export const restoreFolder = async (
  id: string,
  options?: { userId?: string }
): Promise<void> => {
  try {
    await supabaseFolders.restoreFolder(id);
    const folder = await supabaseFolders.getFolderById(id);
    if (folder) await moveFolderToActiveInCache(folder.user_id, folder);
  } catch (err) {
    const userId = options?.userId;
    if (userId) {
      const archived = await getCachedArchivedFolders(userId);
      const folder = archived.find((f) => f.id === id);
      if (folder) {
        await moveFolderToActiveInCache(userId, folder);
        await addPendingRestore(userId, id);
        return;
      }
    }
    throw err;
  }
};

/** Permanently delete a folder and all notes and files inside it. When offline, records delete in cache and syncs when back online. */
export const deleteFolder = async (
  id: string,
  options?: { userId?: string }
): Promise<void> => {
  let userId = options?.userId;
  try {
    const folder = await supabaseFolders.getFolderById(id);
    userId = folder?.user_id ?? userId;

    const noteIds = await supabaseFolders.listNoteIdsByFolderId(id);
    const fileRecords = await supabaseFolders.listFileRecordsByFolderId(id);

    for (const noteId of noteIds) {
      await deleteNote(noteId);
    }
    for (const file of fileRecords) {
      await deleteFile(file.id, { filePath: file.file_path });
    }
    await supabaseFolders.deleteFolderRecord(id);

    if (userId) await removeFolderFromCache(userId, id);
  } catch (err) {
    if (userId) {
      await addPendingDelete(userId, id);
      await removeFolderFromCache(userId, id);
      return; // optimistic: folder removed from cache, will sync when online
    }
    throw err;
  }
}
