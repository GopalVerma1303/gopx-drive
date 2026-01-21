import { supabase, type Note } from "@/lib/supabase";

export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch notes: ${error.message}`);
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
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: input.user_id,
      title: input.title || "Untitled",
      content: input.content,
    })
    .select()
    .single();

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

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }
};
