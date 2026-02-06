import { UI_DEV } from "@/lib/config";
import * as mockNotes from "@/lib/mock-notes";
import * as notesReservoir from "@/lib/notes-reservoir";
import type { Note } from "@/lib/supabase";

export type NotesSyncStatus = import("@/lib/notes-reservoir").NotesSyncStatus;

// Unified notes API: mock (UI_DEV), or local-first reservoir (SQLite + Supabase sync)
export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listNotes(userId);
  }
  return notesReservoir.listNotes(userId);
};

export const listArchivedNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listArchivedNotes?.(userId) || [];
  }
  return notesReservoir.listArchivedNotes(userId);
};

export const getNoteById = async (id: string): Promise<Note | null> => {
  if (UI_DEV) {
    return mockNotes.getNoteById(id);
  }
  return notesReservoir.getNoteById(id);
};

export const createNote = async (input: {
  user_id: string;
  title: string;
  content: string;
}): Promise<Note> => {
  if (UI_DEV) {
    return mockNotes.createNote(input);
  }
  return notesReservoir.createNote(input);
};

export const updateNote = async (
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> => {
  if (UI_DEV) {
    return mockNotes.updateNote(id, updates);
  }
  return notesReservoir.updateNote(id, updates);
};

export const archiveNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.archiveNote?.(id) || Promise.resolve();
  }
  return notesReservoir.archiveNote(id);
};

export const restoreNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.restoreNote?.(id) || Promise.resolve();
  }
  return notesReservoir.restoreNote(id);
};

export const deleteNote = async (id: string): Promise<void> => {
  if (UI_DEV) {
    return mockNotes.deleteNote(id);
  }
  return notesReservoir.deleteNote(id);
};

/** Trigger background sync of notes from Supabase into local SQLite. Call on notes screen focus or app foreground. */
export const syncNotesFromSupabase = (userId: string | undefined) => {
  if (UI_DEV || !userId) return;
  notesReservoir.syncFromSupabase(userId).catch(() => {});
};

/** Check if notes are synced with Supabase: pendingCount (unsynced changes) and isSyncing. On web or UI_DEV always returns { pendingCount: 0, isSyncing: false }. */
export const getNotesSyncStatus = async (
  userId: string | undefined
): Promise<NotesSyncStatus> => {
  if (UI_DEV) return { pendingCount: 0, isSyncing: false };
  return notesReservoir.getNotesSyncStatus(userId);
};

/** Note ids that have local changes not yet pushed to Supabase. On web or UI_DEV always []. */
export const getUnsyncedNoteIds = async (
  userId: string | undefined
): Promise<string[]> => {
  if (UI_DEV) return [];
  return notesReservoir.getUnsyncedNoteIds(userId);
};
