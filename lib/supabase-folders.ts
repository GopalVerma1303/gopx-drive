import { supabase, type Folder } from "@/lib/supabase";

export const listFolders = async (userId?: string): Promise<Folder[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`);
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
      name: input.name || "Untitled folder",
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

export const deleteFolder = async (id: string): Promise<void> => {
  // Move notes and files in this folder to default (folder_id = null)
  await supabase.from("notes").update({ folder_id: null }).eq("folder_id", id);
  await supabase.from("files").update({ folder_id: null }).eq("folder_id", id);

  const { error } = await supabase.from("folders").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete folder: ${error.message}`);
  }
};
