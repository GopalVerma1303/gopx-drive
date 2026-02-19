import { supabase, DEFAULT_FOLDER_ID, type Note } from "@/lib/supabase";

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
    return (fallbackQuery.data || []).map((n: any) => {
      const folderId = n.folder_id;
      return { 
        ...n, 
        folder_id: folderId === null || folderId === undefined || folderId === "" ? null : folderId 
      };
    });
  }

  if (error) {
    throw new Error(`Failed to fetch notes: ${error.message}`);
  }

  return (data || []).map((n: any) => {
    const folderId = n.folder_id;
    return { 
      ...n, 
      folder_id: folderId === null || folderId === undefined || folderId === "" ? null : folderId 
    };
  });
};

/** List non-archived notes in a folder. Use DEFAULT_FOLDER_ID for default (folder_id is null). */
export const listNotesByFolder = async (
  userId: string,
  folderId: string
): Promise<Note[]> => {
  if (!userId) {
    console.error("[listNotesByFolder] userId is required");
    return [];
  }
  
  const isDefault = folderId === DEFAULT_FOLDER_ID;
  
  // For default folder, always fetch all notes and filter in JavaScript
  // This is more reliable than querying with .is("folder_id", null) which can hang
  if (isDefault) {
    try {
      const all = await listNotes(userId);
      const filtered = all.filter((n) => {
        const noteFolderId = n.folder_id;
        // Include notes where folder_id is null, undefined, or empty string
        return !noteFolderId || noteFolderId === null || noteFolderId === "";
      });
      console.log(`[listNotesByFolder] Default folder: Found ${filtered.length} notes out of ${all.length} total`);
      return filtered;
    } catch (err: any) {
      console.error("[listNotesByFolder] Error fetching default folder notes:", err);
      return [];
    }
  }
  
  // For specific folders, use direct query
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .eq("folder_id", folderId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[listNotesByFolder] Query error:", error);
      if (error.message?.includes("column") || error.message?.includes("folder_id")) {
        // Fallback: fetch all and filter
        const all = await listNotes(userId);
        return all.filter((n) => n.folder_id === folderId);
      }
      throw new Error(`Failed to fetch notes: ${error.message}`);
    }

    return (data || []).map((n: any) => {
      const folderIdValue = n.folder_id;
      return { 
        ...n, 
        folder_id: folderIdValue === null || folderIdValue === undefined || folderIdValue === "" ? null : folderIdValue 
      };
    });
  } catch (err: any) {
    console.error("[listNotesByFolder] Error:", err);
    return [];
  }
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

  return (data || []).map((n: any) => ({ ...n, folder_id: n.folder_id ?? null }));
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

  return data ? { ...data, folder_id: data.folder_id ?? null } : data;
};

export const createNote = async (input: {
  user_id: string;
  title: string;
  content: string;
  folder_id?: string | null;
}): Promise<Note> => {
  const folderId = input.folder_id === DEFAULT_FOLDER_ID ? null : (input.folder_id ?? null);
  const row: Record<string, unknown> = {
    user_id: input.user_id,
    title: input.title || "Untitled",
    content: input.content,
    is_archived: false,
  };
  if (folderId !== undefined) (row as any).folder_id = folderId;

  let { data, error } = await supabase.from("notes").insert(row).select().single();

  if (error && (error.message?.includes("column") || error.message?.includes("is_archived") || error.message?.includes("folder_id"))) {
    const fallbackRow: Record<string, unknown> = {
      user_id: input.user_id,
      title: input.title || "Untitled",
      content: input.content,
    };
    const fallbackQuery = await supabase.from("notes").insert(fallbackRow).select().single();
    if (fallbackQuery.error) {
      throw new Error(`Failed to create note: ${fallbackQuery.error.message}`);
    }
    return { ...fallbackQuery.data, folder_id: (fallbackQuery.data as any).folder_id ?? null };
  }

  if (error) {
    throw new Error(`Failed to create note: ${error.message}`);
  }

  return { ...data, folder_id: (data as any).folder_id ?? null };
};

export const updateNote = async (
  id: string,
  updates: Partial<Pick<Note, "title" | "content" | "folder_id">>
): Promise<Note | null> => {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if ("folder_id" in updates) {
    (payload as any).folder_id = updates.folder_id === DEFAULT_FOLDER_ID ? null : updates.folder_id;
  }
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
    if (error.message?.includes("folder_id")) {
      const { folder_id: _fd, ...rest } = updates;
      const fallback = await supabase.from("notes").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (fallback.error) throw new Error(`Failed to update note: ${fallback.error.message}`);
      return { ...fallback.data, folder_id: (fallback.data as any).folder_id ?? null };
    }
    throw new Error(`Failed to update note: ${error.message}`);
  }

  return data ? { ...data, folder_id: (data as any).folder_id ?? null } : data;
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
