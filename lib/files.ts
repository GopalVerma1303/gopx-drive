import { UI_DEV } from "@/lib/config";
import {
  getCachedArchivedFiles,
  getCachedFiles,
  setCachedArchivedFiles,
  setCachedFiles,
} from "@/lib/files-cache";
import * as mockFiles from "@/lib/mock-files";
import * as supabaseFiles from "@/lib/supabase-files";
import type { File } from "@/lib/supabase";
import { DEFAULT_FOLDER_ID } from "@/lib/supabase";

// Unified files API that switches between mock and Supabase based on UI_DEV config.
// When offline, returns cached file lists so file cards can still be shown.
export const listFiles = async (userId?: string): Promise<File[]> => {
  if (UI_DEV) {
    return mockFiles.listFiles(userId);
  }
  if (!userId) return [];
  try {
    const files = await supabaseFiles.listFiles(userId);
    await setCachedFiles(userId, files);
    return files;
  } catch {
    return getCachedFiles(userId);
  }
};

export const listArchivedFiles = async (userId?: string): Promise<File[]> => {
  if (UI_DEV) {
    return mockFiles.listArchivedFiles?.(userId) || [];
  }
  if (!userId) return [];
  try {
    const files = await supabaseFiles.listArchivedFiles(userId);
    await setCachedArchivedFiles(userId, files);
    return files;
  } catch {
    return getCachedArchivedFiles(userId);
  }
};

/** List non-archived files in a folder. Use DEFAULT_FOLDER_ID for default folder. */
export const listFilesByFolder = async (
  userId: string | undefined,
  folderId: string
): Promise<File[]> => {
  if (UI_DEV) {
    const files = await listFiles(userId);
    return files.filter((f) => (f.folder_id ?? null) === (folderId === DEFAULT_FOLDER_ID ? null : folderId));
  }
  if (!userId) return [];
  return supabaseFiles.listFilesByFolder(userId, folderId);
};

export const getFileById = async (id: string): Promise<File | null> => {
  if (UI_DEV) {
    return mockFiles.getFileById(id);
  }
  return supabaseFiles.getFileById(id);
};

export const uploadFile = async (input: {
  user_id: string;
  folder_id?: string | null;
  file: {
    uri: string;
    name: string;
    type: string;
    size: number;
  };
}): Promise<File> => {
  if (UI_DEV) {
    return mockFiles.uploadFile(input);
  }
  return supabaseFiles.uploadFile(input);
};

export const archiveFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.archiveFile?.(id) || Promise.resolve();
  }
  return supabaseFiles.archiveFile(id);
};

export const restoreFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.restoreFile?.(id) || Promise.resolve();
  }
  return supabaseFiles.restoreFile(id);
};

export const deleteFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.deleteFile(id);
  }
  return supabaseFiles.deleteFile(id);
};

export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  if (UI_DEV) {
    return mockFiles.getFileDownloadUrl(filePath);
  }
  return supabaseFiles.getFileDownloadUrl(filePath);
};
