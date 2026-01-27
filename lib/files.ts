import { UI_DEV } from "@/lib/config";
import * as mockFiles from "@/lib/mock-files";
import * as supabaseFiles from "@/lib/supabase-files";
import * as offlineFiles from "@/lib/offline-files";
import { isOffline } from "@/lib/network-utils";
import type { File } from "@/lib/supabase";

// Unified files API that switches between mock, Supabase, and offline-aware functions
export const listFiles = async (userId?: string): Promise<File[]> => {
  if (UI_DEV) {
    return mockFiles.listFiles(userId);
  }
  const offline = await isOffline();
  return offlineFiles.listFiles(userId, offline);
};

export const listArchivedFiles = async (userId?: string): Promise<File[]> => {
  if (UI_DEV) {
    return mockFiles.listArchivedFiles?.(userId) || [];
  }
  const offline = await isOffline();
  return offlineFiles.listArchivedFiles(userId, offline);
};

export const getFileById = async (id: string, includeArchived: boolean = true): Promise<File | null> => {
  if (UI_DEV) {
    return mockFiles.getFileById(id);
  }
  const offline = await isOffline();
  return offlineFiles.getFileById(id, offline, includeArchived);
};

export const uploadFile = async (input: {
  user_id: string;
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
  const offline = await isOffline();
  return offlineFiles.uploadFile(input, offline);
};

export const archiveFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.archiveFile?.(id) || Promise.resolve();
  }
  const offline = await isOffline();
  return offlineFiles.archiveFile(id, offline);
};

export const restoreFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.restoreFile?.(id) || Promise.resolve();
  }
  const offline = await isOffline();
  return offlineFiles.restoreFile(id, offline);
};

export const deleteFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.deleteFile(id);
  }
  const offline = await isOffline();
  return offlineFiles.deleteFile(id, offline);
};

export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  if (UI_DEV) {
    return mockFiles.getFileDownloadUrl(filePath);
  }
  const offline = await isOffline();
  return offlineFiles.getFileDownloadUrl(filePath, offline);
};
