import { UI_DEV } from "@/lib/config";
import * as supabaseFolders from "@/lib/supabase-folders";
import type { Folder } from "@/lib/supabase";

export const listFolders = async (userId?: string): Promise<Folder[]> => {
  if (UI_DEV) {
    return [];
  }
  return supabaseFolders.listFolders(userId);
};

export const getFolderById = async (id: string): Promise<Folder | null> => {
  if (UI_DEV) {
    return null;
  }
  return supabaseFolders.getFolderById(id);
};

export const createFolder = async (input: {
  user_id: string;
  name: string;
}): Promise<Folder> => {
  if (UI_DEV) {
    throw new Error("Folders not available in UI dev mode");
  }
  return supabaseFolders.createFolder(input);
};

export const updateFolder = async (
  id: string,
  updates: Partial<Pick<Folder, "name">>
): Promise<Folder | null> => {
  if (UI_DEV) {
    return null;
  }
  return supabaseFolders.updateFolder(id, updates);
};

export const deleteFolder = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return;
  }
  return supabaseFolders.deleteFolder(id);
};
