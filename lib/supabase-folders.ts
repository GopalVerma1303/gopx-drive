import { withSupabaseTimeout } from "@/lib/network-timeout";
import { supabase, type Folder } from "@/lib/supabase";

export const listFolders = async (userId?: string): Promise<Folder[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await withSupabaseTimeout((signal) =>
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .abortSignal(signal)
  );

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }

  return data || [];
};

export const listArchivedFolders = async (userId?: string): Promise<Folder[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await withSupabaseTimeout((signal) =>
    supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .eq("is_archived", true)
      .order("updated_at", { ascending: false })
      .abortSignal(signal)
  );

  if (error) {
    throw new Error(`Failed to fetch archived folders: ${error.message}`);
  }

  return data || [];
};

export const getFolderById = async (id: string): Promise<Folder | null> => {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch folder: ${error.message}`);
  }

  return data;
};

export const createFolder = async (input: {
  user_id: string;
  name: string;
}): Promise<Folder> => {
  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: input.user_id,
      name: input.name.trim() || "Unnamed folder",
      is_archived: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create folder: ${error.message}`);
  }

  return data;
};

export const updateFolder = async (
  id: string,
  updates: Partial<Pick<Folder, "name">>
): Promise<Folder | null> => {
  const { data, error } = await supabase
    .from("folders")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to update folder: ${error.message}`);
  }

  return data;
};

const updatedAt = () => new Date().toISOString();

export const archiveFolder = async (id: string): Promise<void> => {
  // Archive all notes in this folder
  const { error: notesError } = await supabase
    .from("notes")
    .update({ is_archived: true, updated_at: updatedAt() })
    .eq("folder_id", id);

  if (notesError && !notesError.message?.includes("folder_id")) {
    throw new Error(`Failed to archive notes in folder: ${notesError.message}`);
  }

  // Archive all files in this folder
  const { error: filesError } = await supabase
    .from("files")
    .update({ is_archived: true, updated_at: updatedAt() })
    .eq("folder_id", id);

  if (filesError && !filesError.message?.includes("folder_id")) {
    throw new Error(`Failed to archive files in folder: ${filesError.message}`);
  }

  // Archive the folder
  const { error } = await supabase
    .from("folders")
    .update({ is_archived: true, updated_at: updatedAt() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to archive folder: ${error.message}`);
  }
};

export const restoreFolder = async (id: string): Promise<void> => {
  // Restore all notes in this folder
  const { error: notesError } = await supabase
    .from("notes")
    .update({ is_archived: false, updated_at: updatedAt() })
    .eq("folder_id", id);

  if (notesError && !notesError.message?.includes("folder_id")) {
    throw new Error(`Failed to restore notes in folder: ${notesError.message}`);
  }

  // Restore all files in this folder
  const { error: filesError } = await supabase
    .from("files")
    .update({ is_archived: false, updated_at: updatedAt() })
    .eq("folder_id", id);

  if (filesError && !filesError.message?.includes("folder_id")) {
    throw new Error(`Failed to restore files in folder: ${filesError.message}`);
  }

  // Restore the folder
  const { error } = await supabase
    .from("folders")
    .update({ is_archived: false, updated_at: updatedAt() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to restore folder: ${error.message}`);
  }
};

/** List note ids in a folder (any archive state). Used for cascade delete. */
export const listNoteIdsByFolderId = async (folderId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("notes")
    .select("id")
    .eq("folder_id", folderId);

  if (error) {
    if (error.code === "PGRST116" || error.message?.includes("folder_id")) {
      return [];
    }
    throw new Error(`Failed to list notes in folder: ${error.message}`);
  }
  return (data || []).map((row: { id: string }) => row.id);
};

/** List file records in a folder (any archive state). Used for cascade delete. */
export const listFileRecordsByFolderId = async (
  folderId: string
): Promise<Array<{ id: string; file_path: string }>> => {
  const { data, error } = await supabase
    .from("files")
    .select("id, file_path")
    .eq("folder_id", folderId);

  if (error) {
    if (error.code === "PGRST116" || error.message?.includes("folder_id")) {
      return [];
    }
    throw new Error(`Failed to list files in folder: ${error.message}`);
  }
  return data || [];
};

export const deleteFolderRecord = async (id: string): Promise<void> => {
  const { error } = await supabase.from("folders").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`);
  }
};
