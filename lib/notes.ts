import { UI_DEV } from "@/lib/config";
import * as mockNotes from "@/lib/mock-notes";
import * as supabaseNotes from "@/lib/supabase-notes";
import * as offlineNotes from "@/lib/offline-notes";
import { isOffline } from "@/lib/network-utils";
import type { Note } from "@/lib/supabase";

// Unified notes API that switches between mock, Supabase, and offline-aware functions
export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listNotes(userId);
  }
  const offline = await isOffline();
  return offlineNotes.listNotes(userId, offline);
};

export const listArchivedNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listArchivedNotes?.(userId) || [];
  }
  const offline = await isOffline();
  // For archived notes, we need to filter from the offline cache
  if (offline) {
    const cached = await offlineNotes.listNotes(userId, true);
    return cached.filter((note) => note.is_archived === true);
  }
  return supabaseNotes.listArchivedNotes(userId);
};

export const getNoteById = async (id: string): Promise<Note | null> => {
  if (UI_DEV) {
    return mockNotes.getNoteById(id);
  }
  const offline = await isOffline();
  return offlineNotes.getNoteById(id, offline);
};

export const createNote = async (input: {
  user_id: string;
  title: string;
  content: string;
}): Promise<Note> => {
  if (UI_DEV) {
    return mockNotes.createNote(input);
  }
  const offline = await isOffline();
  return offlineNotes.createNote(input, offline);
};

export const updateNote = async (
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> => {
  if (UI_DEV) {
    return mockNotes.updateNote(id, updates);
  }
  const offline = await isOffline();
  return offlineNotes.updateNote(id, updates, offline);
};

export const archiveNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.archiveNote?.(id) || Promise.resolve();
  }
  const offline = await isOffline();
  return offlineNotes.archiveNote(id, offline);
};

export const restoreNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.restoreNote?.(id) || Promise.resolve();
  }
  const offline = await isOffline();
  return offlineNotes.restoreNote(id, offline);
};

export const deleteNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.deleteNote(id);
  }
  const offline = await isOffline();
  return offlineNotes.deleteNote(id, offline);
};
