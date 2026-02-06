/**
 * Notes reservoir – web: Supabase only (no expo-sqlite to avoid WASM/Metro issues).
 * Native uses notes-reservoir.ts with SQLite.
 */

import type { Note } from "@/lib/supabase";
import * as supabaseNotes from "@/lib/supabase-notes";

export type NotesSyncStatus = {
  pendingCount: number;
  isSyncing: boolean;
};

/** On web, data is always from Supabase so there is nothing to sync. */
export async function getNotesSyncStatus(_userId: string | undefined): Promise<NotesSyncStatus> {
  return { pendingCount: 0, isSyncing: false };
}

/** On web, all notes are considered synced. */
export async function getUnsyncedNoteIds(_userId: string | undefined): Promise<string[]> {
  return [];
}

export async function syncFromSupabase(_userId: string): Promise<void> {
  // No-op on web; data is always from Supabase
}

export async function listNotes(userId?: string): Promise<Note[]> {
  if (!userId) throw new Error("User ID is required");
  return supabaseNotes.listNotes(userId);
}

export async function listArchivedNotes(userId?: string): Promise<Note[]> {
  if (!userId) throw new Error("User ID is required");
  return supabaseNotes.listArchivedNotes(userId);
}

export async function getNoteById(id: string): Promise<Note | null> {
  return supabaseNotes.getNoteById(id);
}

export async function createNote(input: {
  user_id: string;
  title: string;
  content: string;
}): Promise<Note> {
  return supabaseNotes.createNote(input);
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> {
  return supabaseNotes.updateNote(id, updates);
}

export async function archiveNote(id: string): Promise<void> {
  return supabaseNotes.archiveNote(id);
}

export async function restoreNote(id: string): Promise<void> {
  return supabaseNotes.restoreNote(id);
}

export async function deleteNote(id: string): Promise<void> {
  return supabaseNotes.deleteNote(id);
}
