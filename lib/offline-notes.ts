import { getCachedData, setCachedData, queueMutation } from "./offline-storage";
import * as notesApi from "./notes";
import type { Note } from "./supabase";

/**
 * Enhanced listNotes with offline support
 */
export async function listNotes(
  userId?: string,
  isOffline: boolean = false
): Promise<Note[]> {
  if (isOffline) {
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      // Filter by userId if provided
      if (userId) {
        return cached.filter((note) => note.user_id === userId);
      }
      return cached;
    }
    return [];
  }

  try {
    const data = await notesApi.listNotes(userId);
    await setCachedData("notes", data);
    return data;
  } catch (error) {
    // Fallback to cache on error
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      if (userId) {
        return cached.filter((note) => note.user_id === userId);
      }
      return cached;
    }
    throw error;
  }
}

/**
 * Enhanced getNoteById with offline support
 */
export async function getNoteById(
  id: string,
  isOffline: boolean = false
): Promise<Note | null> {
  if (isOffline) {
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      return cached.find((note) => note.id === id) || null;
    }
    return null;
  }

  try {
    const data = await notesApi.getNoteById(id);
    // Update cache if found
    if (data) {
      const cached = await getCachedData<Note[]>("notes");
      if (cached) {
        const index = cached.findIndex((note) => note.id === id);
        if (index >= 0) {
          cached[index] = data;
        } else {
          cached.push(data);
        }
        await setCachedData("notes", cached);
      }
    }
    return data;
  } catch (error) {
    // Fallback to cache
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      return cached.find((note) => note.id === id) || null;
    }
    throw error;
  }
}

/**
 * Enhanced createNote with offline queue support
 */
export async function createNote(
  input: {
    user_id: string;
    title: string;
    content: string;
  },
  isOffline: boolean = false
): Promise<Note> {
  if (isOffline) {
    await queueMutation({
      type: "create",
      resource: "note",
      data: input,
    });
    // Return optimistic response
    return {
      id: `temp_${Date.now()}`,
      user_id: input.user_id,
      title: input.title,
      content: input.content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const data = await notesApi.createNote(input);
    // Update cache
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      cached.unshift(data); // Add to beginning
      await setCachedData("notes", cached);
    }
    return data;
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "create",
      resource: "note",
      data: input,
    });
    throw error;
  }
}

/**
 * Enhanced updateNote with offline queue support
 */
export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>,
  isOffline: boolean = false
): Promise<Note | null> {
  if (isOffline) {
    const cached = await getCachedData<Note[]>("notes");
    const existing = cached?.find((note) => note.id === id);
    
    await queueMutation({
      type: "update",
      resource: "note",
      data: { id, updates },
    });

    // Return optimistic update
    if (existing) {
      return {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  }

  try {
    const data = await notesApi.updateNote(id, updates);
    // Update cache
    if (data) {
      const cached = await getCachedData<Note[]>("notes");
      if (cached) {
        const index = cached.findIndex((note) => note.id === id);
        if (index >= 0) {
          cached[index] = data;
          await setCachedData("notes", cached);
        }
      }
    }
    return data;
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "update",
      resource: "note",
      data: { id, updates },
    });
    throw error;
  }
}

/**
 * Enhanced deleteNote with offline queue support
 */
export async function deleteNote(
  id: string,
  isOffline: boolean = false
): Promise<void> {
  if (isOffline) {
    await queueMutation({
      type: "delete",
      resource: "note",
      data: { id },
    });
    // Optimistically remove from cache
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      const filtered = cached.filter((note) => note.id !== id);
      await setCachedData("notes", filtered);
    }
    return;
  }

  try {
    await notesApi.deleteNote(id);
    // Update cache
    const cached = await getCachedData<Note[]>("notes");
    if (cached) {
      const filtered = cached.filter((note) => note.id !== id);
      await setCachedData("notes", filtered);
    }
  } catch (error) {
    // Queue for retry
    await queueMutation({
      type: "delete",
      resource: "note",
      data: { id },
    });
    throw error;
  }
}
