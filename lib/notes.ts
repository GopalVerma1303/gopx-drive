import { UI_DEV } from "@/lib/config";
import * as mockNotes from "@/lib/mock-notes";
import * as supabaseNotes from "@/lib/supabase-notes";
import type { Note } from "@/lib/supabase";

// Unified notes API that switches between mock and Supabase based on UI_DEV config
export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listNotes(userId);
  }
  return supabaseNotes.listNotes(userId);
};

export const listArchivedNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listArchivedNotes?.(userId) || [];
  }
  return supabaseNotes.listArchivedNotes(userId);
};

export const getNoteById = async (id: string): Promise<Note | null> => {
  if (UI_DEV) {
    return mockNotes.getNoteById(id);
  }
  return supabaseNotes.getNoteById(id);
};

export const createNote = async (input: {
  user_id: string;
  title: string;
  content: string;
}): Promise<Note> => {
  if (UI_DEV) {
    return mockNotes.createNote(input);
  }
  return supabaseNotes.createNote(input);
};

export const updateNote = async (
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> => {
  if (UI_DEV) {
    return mockNotes.updateNote(id, updates);
  }
  return supabaseNotes.updateNote(id, updates);
};

export const archiveNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.archiveNote?.(id) || Promise.resolve();
  }
  return supabaseNotes.archiveNote(id);
};

export const restoreNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.restoreNote?.(id) || Promise.resolve();
  }
  return supabaseNotes.restoreNote(id);
};

export const deleteNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.deleteNote(id);
  }
  return supabaseNotes.deleteNote(id);
};
