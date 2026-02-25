import { deleteFile } from "@/lib/files";
import {
  getCachedArchivedFolders,
  getCachedFolders,
  setCachedArchivedFolders,
  setCachedFolders,
} from "@/lib/folders-cache";
import { deleteNote } from "@/lib/notes";
import type { Folder } from "@/lib/supabase";
import * as supabaseFolders from "@/lib/supabase-folders";

export const listFolders = async (userId?: string): Promise<Folder[]> => {
  if (!userId) return [];
  try {
    const folders = await supabaseFolders.listFolders(userId);
    await setCachedFolders(userId, folders);
    return folders;
  } catch {
    return getCachedFolders(userId);
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

export const createFolder = async (input: {
  user_id: string;
  name: string;
}): Promise<Folder> => {
  return supabaseFolders.createFolder(input);
};

export const updateFolder = async (
  id: string,
  updates: Partial<Pick<Folder, "name">>
): Promise<Folder | null> => {
  return supabaseFolders.updateFolder(id, updates);
};

export const archiveFolder = async (id: string): Promise<void> => {
  return supabaseFolders.archiveFolder(id);
};

export const restoreFolder = async (id: string): Promise<void> => {
  return supabaseFolders.restoreFolder(id);
};

/** Permanently delete a folder and all notes and files inside it. */
export const deleteFolder = async (id: string): Promise<void> => {
  const noteIds = await supabaseFolders.listNoteIdsByFolderId(id);
  const fileRecords = await supabaseFolders.listFileRecordsByFolderId(id);

  for (const noteId of noteIds) {
    await deleteNote(noteId);
  }
  for (const file of fileRecords) {
    await deleteFile(file.id, { filePath: file.file_path });
  }
  await supabaseFolders.deleteFolderRecord(id);
}
