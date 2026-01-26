import { supabase } from "@/lib/supabase";

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface NoteTag {
  note_id: string;
  tag_id: string;
  created_at: string;
}

export const listTags = async (userId?: string): Promise<Tag[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tags: ${error.message}`);
  }

  return data || [];
};

export const getTagById = async (id: string): Promise<Tag | null> => {
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch tag: ${error.message}`);
  }

  return data;
};

export const createTag = async (input: {
  user_id: string;
  name: string;
}): Promise<Tag> => {
  const { data, error } = await supabase
    .from("tags")
    .insert({
      user_id: input.user_id,
      name: input.name.trim(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create tag: ${error.message}`);
  }

  return data;
};

export const updateTag = async (
  id: string,
  updates: Partial<Pick<Tag, "name">>
): Promise<Tag | null> => {
  const { data, error } = await supabase
    .from("tags")
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
    throw new Error(`Failed to update tag: ${error.message}`);
  }

  return data;
};

export const deleteTag = async (id: string): Promise<void> => {
  const { error } = await supabase.from("tags").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete tag: ${error.message}`);
  }
};

// Ensure default tag exists for a user
export const ensureDefaultTag = async (userId: string): Promise<Tag> => {
  // Try to find existing default tag
  const { data: existingTag } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .eq("name", "Default")
    .single();

  if (existingTag) {
    return existingTag;
  }

  // Create default tag if it doesn't exist
  return createTag({ user_id: userId, name: "Default" });
};

// Get tags for a specific note
export const getNoteTags = async (noteId: string): Promise<Tag[]> => {
  const { data, error } = await supabase
    .from("note_tags")
    .select("tag_id")
    .eq("note_id", noteId);

  if (error) {
    throw new Error(`Failed to fetch note tags: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const tagIds = data.map((nt) => nt.tag_id);
  const { data: tags, error: tagsError } = await supabase
    .from("tags")
    .select("*")
    .in("id", tagIds);

  if (tagsError) {
    throw new Error(`Failed to fetch tags: ${tagsError.message}`);
  }

  return tags || [];
};

// Add tag to note
export const addTagToNote = async (
  noteId: string,
  tagId: string
): Promise<void> => {
  const { error } = await supabase
    .from("note_tags")
    .insert({
      note_id: noteId,
      tag_id: tagId,
    });

  if (error) {
    // Ignore duplicate key errors (tag already on note)
    if (error.code !== "23505") {
      throw new Error(`Failed to add tag to note: ${error.message}`);
    }
  }
};

// Remove tag from note
export const removeTagFromNote = async (
  noteId: string,
  tagId: string
): Promise<void> => {
  const { error } = await supabase
    .from("note_tags")
    .delete()
    .eq("note_id", noteId)
    .eq("tag_id", tagId);

  if (error) {
    throw new Error(`Failed to remove tag from note: ${error.message}`);
  }
};

// Get notes by tag
export const getNotesByTag = async (
  userId: string,
  tagId: string
): Promise<string[]> => {
  // First verify the tag belongs to the user
  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .eq("user_id", userId)
    .single();

  if (!tag) {
    throw new Error("Tag not found or access denied");
  }

  const { data, error } = await supabase
    .from("note_tags")
    .select("note_id")
    .eq("tag_id", tagId);

  if (error) {
    throw new Error(`Failed to fetch notes by tag: ${error.message}`);
  }

  return data?.map((nt) => nt.note_id) || [];
};
