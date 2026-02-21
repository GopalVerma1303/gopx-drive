import { supabase, type Note } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/network-timeout";

export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  // Try querying with is_archived filter first
  let { data, error } = await withSupabaseTimeout((signal) =>
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .abortSignal(signal)
  );

  // If column doesn't exist (400 error), fallback to querying without filter
  if (error && (error.code === "PGRST116" || error.message?.includes("column") || error.message?.includes("is_archived"))) {
    const fallbackQuery = await withSupabaseTimeout((signal) =>
      supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .abortSignal(signal)
    );
    
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
  let { data, error } = await withSupabaseTimeout((signal) =>
    supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_archived", true)
      .order("updated_at", { ascending: false })
      .abortSignal(signal)
  );

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
  updates: Partial<Pick<Note, "title" | "content" | "share_token">>
): Promise<Note | null> => {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("notes")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
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

/** Public API: fetch a note by share token (no auth). Returns null if not found or not shared. */
export type SharedNoteResult = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  shared_by_email: string | null;
};

export const getNoteByShareToken = async (
  token: string
): Promise<SharedNoteResult | null> => {
  const { data, error } = await supabase.rpc("get_note_by_share_token", {
    token,
  });

  if (error) {
    if (error.code === "PGRST116" || error.message?.includes("0 rows")) {
      return null;
    }
    throw new Error(`Failed to fetch shared note: ${error.message}`);
  }

  // RPC returns table result: array of rows (or single row depending on client)
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.id == null) return null;

  return {
    id: row.id,
    title: row.title ?? "",
    content: row.content ?? "",
    updated_at: row.updated_at ?? new Date().toISOString(),
    shared_by_email: row.shared_by_email ?? null,
  };
};
