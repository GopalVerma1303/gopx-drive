import { UI_DEV } from "@/lib/config";
import * as mockNotes from "@/lib/mock-notes";
import * as notesReservoir from "@/lib/notes-reservoir";
import * as supabaseNotes from "@/lib/supabase-notes";
import { Platform } from "react-native";
import type { Note } from "@/lib/supabase";
import { DEFAULT_FOLDER_ID } from "@/lib/supabase";

export type NotesSyncStatus = import("@/lib/notes-reservoir").NotesSyncStatus;

// Unified notes API: mock (UI_DEV), or local-first reservoir (SQLite + Supabase sync)
export const listNotes = async (userId?: string): Promise<Note[]> => {
  if (UI_DEV) {
    return mockNotes.listNotes(userId);
  }
  return notesReservoir.listNotes(userId);
};

/** List non-archived notes in a folder. Use DEFAULT_FOLDER_ID for default folder. */
export const listNotesByFolder = async (
  userId: string | undefined,
  folderId: string
): Promise<Note[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  if (UI_DEV) {
    const notes = await mockNotes.listNotes(userId);
    return notes.filter((n) => (n.folder_id ?? null) === (folderId === DEFAULT_FOLDER_ID ? null : folderId));
  }
  
  // On web, call supabase directly (same as what notes-reservoir does)
  if (Platform.OS === "web") {
    return supabaseNotes.listNotesByFolder(userId, folderId);
  }
  
  // On native, use notes-reservoir
  try {
    // Try namespace import first
    if (notesReservoir && typeof notesReservoir.listNotesByFolder === "function") {
      return notesReservoir.listNotesByFolder(userId, folderId);
    }
    
    // If that fails, fallback to supabase directly
    console.warn("[listNotesByFolder] notesReservoir.listNotesByFolder not available, using supabase directly");
    return supabaseNotes.listNotesByFolder(userId, folderId);
  } catch (error: any) {
    console.error("[listNotesByFolder] Error calling notesReservoir:", error);
    // Fallback to supabase
    return supabaseNotes.listNotesByFolder(userId, folderId);
  }
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
  folder_id?: string | null;
}): Promise<Note> => {
  if (UI_DEV) {
    return mockNotes.createNote(input);
  }
  return notesReservoir.createNote(input);
};

export const updateNote = async (
  id: string,
  updates: Partial<Pick<Note, "title" | "content" | "folder_id">>
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

/** Trigger sync of notes from Supabase into local SQLite. Returns a promise that resolves when sync finishes (for invalidating queries). */
export const syncNotesFromSupabase = (userId: string | undefined): Promise<void> | undefined => {
  if (UI_DEV || !userId) return undefined;
  return notesReservoir.syncFromSupabase(userId).catch(() => {});
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
