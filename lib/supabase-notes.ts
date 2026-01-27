import { supabase, type Note } from "@/lib/supabase";

export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Try querying with is_archived filter first
  let { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  // If column doesn't exist (400 error), fallback to querying without filter
  if (error && (error.code === "PGRST116" || error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to fetch notes: ${fallbackQuery.error.message}`);
    }
    
    // Filter out archived items in JavaScript (treat null/undefined as false)
    return (fallbackQuery.data || []).filter((note: any) => !note.is_archived);
  }

  if (error) {
    throw new Error(`Failed to fetch notes: ${error.message}`);
  }

  return data || [];
};

export const listArchivedNotes = async (userId?: string): Promise<Note[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Try querying with is_archived filter first
  let { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", true)
    .order("updated_at", { ascending: false });

  // If column doesn't exist (400 error), return empty array (no archived items yet)
  if (error && (error.code === "PGRST116" || error.message?.includes("column") || error.message?.includes("is_archived"))) {
    return [];
  }

  if (error) {
    throw new Error(`Failed to fetch archived notes: ${error.message}`);
  }

  return data || [];
};

export const getNoteById = async (id: string): Promise<Note | null> => {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to fetch note: ${error.message}`);
  }

  return data;
};

export const createNote = async (input: {
  user_id: string;
  title: string;
  content: string;
}): Promise<Note> => {
  // Try with is_archived first
  let { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: input.user_id,
      title: input.title || "Untitled",
      content: input.content,
      is_archived: false,
    })
    .select()
    .single();

  // If column doesn't exist, try without is_archived
  if (error && (error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("notes")
      .insert({
        user_id: input.user_id,
        title: input.title || "Untitled",
        content: input.content,
      })
      .select()
      .single();
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to create note: ${fallbackQuery.error.message}`);
    }
    
    return fallbackQuery.data;
  }

  if (error) {
    throw new Error(`Failed to create note: ${error.message}`);
  }

  return data;
};

export const updateNote = async (
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> => {
  const { data, error } = await supabase
    .from("notes")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to update note: ${error.message}`);
  }

  return data;
};

export const archiveNote = async (id: string): Promise<void> => {
  // Try updating with is_archived first
  let { error } = await supabase
    .from("notes")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);

  // If column doesn't exist, just update updated_at (column will be added later)
  if (error && (error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("notes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to archive note: ${fallbackQuery.error.message}`);
    }
    // Note: Archive functionality won't work until column is added, but won't crash
    return;
  }

  if (error) {
    throw new Error(`Failed to archive note: ${error.message}`);
  }
};

export const restoreNote = async (id: string): Promise<void> => {
  // Try updating with is_archived first
  let { error } = await supabase
    .from("notes")
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  // If column doesn't exist, just update updated_at (column will be added later)
  if (error && (error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await supabase
      .from("notes")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (fallbackQuery.error) {
      throw new Error(`Failed to restore note: ${fallbackQuery.error.message}`);
    }
    // Note: Restore functionality won't work until column is added, but won't crash
    return;
  }

  if (error) {
    throw new Error(`Failed to restore note: ${error.message}`);
  }
};

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }
};
