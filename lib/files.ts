import { UI_DEV } from "@/lib/config";
import * as mockFiles from "@/lib/mock-files";
import * as supabaseFiles from "@/lib/supabase-files";
import * as offlineFiles from "@/lib/offline-files";
import { isOffline } from "@/lib/network-utils";
import type { File } from "@/lib/supabase";
import { Platform } from "react-native";

// Unified files API that switches between mock, Supabase, and offline-aware functions
// Offline features are only enabled on mobile (iOS/Android), not on web
export const listFiles = async (userId?: string): Promise<File[]> => {
  if (UI_DEV) {
    return mockFiles.listFiles(userId);
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.listFiles(userId);
  }
  const offline = await isOffline();
  return offlineFiles.listFiles(userId, offline);
};

export const listArchivedFiles = async (userId?: string): Promise<File[]> => {
  if (UI_DEV) {
    return mockFiles.listArchivedFiles?.(userId) || [];
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.listArchivedFiles(userId);
  }
  const offline = await isOffline();
  return offlineFiles.listArchivedFiles(userId, offline);
};

export const getFileById = async (id: string, includeArchived: boolean = true): Promise<File | null> => {
  if (UI_DEV) {
    return mockFiles.getFileById(id);
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.getFileById(id, includeArchived);
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
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.uploadFile(input);
  }
  const offline = await isOffline();
  return offlineFiles.uploadFile(input, offline);
};

export const archiveFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.archiveFile?.(id) || Promise.resolve();
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.archiveFile(id);
  }
  const offline = await isOffline();
  return offlineFiles.archiveFile(id, offline);
};

export const restoreFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.restoreFile?.(id) || Promise.resolve();
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.restoreFile(id);
  }
  const offline = await isOffline();
  return offlineFiles.restoreFile(id, offline);
};

export const deleteFile = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockFiles.deleteFile(id);
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.deleteFile(id);
  }
  const offline = await isOffline();
  return offlineFiles.deleteFile(id, offline);
};

export const getFileDownloadUrl = async (filePath: string): Promise<string> => {
  if (UI_DEV) {
    return mockFiles.getFileDownloadUrl(filePath);
  }
  // Skip offline features on web - go directly to Supabase
  if (Platform.OS === "web") {
    return supabaseFiles.getFileDownloadUrl(filePath);
  }
  const offline = await isOffline();
  return offlineFiles.getFileDownloadUrl(filePath, offline);
};
