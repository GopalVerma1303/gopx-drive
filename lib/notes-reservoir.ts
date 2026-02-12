/**
 * Notes reservoir: local-first storage with Expo SQLite, synced with Supabase.
 * - On native: CRUD goes to SQLite first, then syncs to Supabase.
 * - On web: uses Supabase only (expo-sqlite web is alpha).
 */

import type { Note } from "@/lib/supabase";
import * as supabaseNotes from "@/lib/supabase-notes";
import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";

const DB_NAME = "notes.db";
const TABLE = "notes";

/** One-time open and migrate; null on web. */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> | null {
  if (Platform.OS === "web") {
    return null;
  }
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          dirty INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_notes_user_archived_updated ON ${TABLE}(user_id, is_archived, updated_at);
      `);
      return db;
    })();
  }
  return dbPromise;
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    title: (row.title as string) ?? "",
    content: (row.content as string) ?? "",
    is_archived: Boolean(row.is_archived),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function getDbAsync(): Promise<SQLite.SQLiteDatabase | null> {
  const p = getDb();
  return p ? p : null;
}

export type NotesSyncStatus = {
  /** Number of notes with local changes not yet pushed to Supabase. */
  pendingCount: number;
  /** True while a sync is in progress. */
  isSyncing: boolean;
};

let isSyncing = false;

/** Returns current sync status: pending count (dirty rows) and whether a sync is in progress. */
export async function getNotesSyncStatus(userId: string | undefined): Promise<NotesSyncStatus> {
  if (Platform.OS === "web" || !userId) {
    return { pendingCount: 0, isSyncing: false };
  }
  const db = await getDbAsync();
  if (!db) return { pendingCount: 0, isSyncing: false };
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${TABLE} WHERE user_id = ? AND dirty = 1`,
    userId
  );
  return {
    pendingCount: row?.c ?? 0,
    isSyncing,
  };
}

/** Returns note ids that have local changes not yet pushed to Supabase (for showing per-note sync icon). */
export async function getUnsyncedNoteIds(userId: string | undefined): Promise<string[]> {
  if (Platform.OS === "web" || !userId) return [];
  const db = await getDbAsync();
  if (!db) return [];
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM ${TABLE} WHERE user_id = ? AND dirty = 1`,
    userId
  );
  return rows.map((r) => r.id);
}

/** Sync: push dirty rows to Supabase, then pull all notes for user and upsert into SQLite. */
export async function syncFromSupabase(userId: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  const db = await getDbAsync();
  if (!db) return;

  // Prevent concurrent syncs
  if (isSyncing) {
    return;
  }

  isSyncing = true;
  try {
    // Fetch all remote notes once (we'll need them for duplicate checking and final sync)
    const remote = await supabaseNotes.listNotes(userId);
    const archived = await supabaseNotes.listArchivedNotes(userId);
    const allRemote = [...remote, ...archived];

    const dirtyRows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${TABLE} WHERE user_id = ? AND dirty = 1`,
      userId
    );
    for (const row of dirtyRows) {
      const note = rowToNote(row);
      if (!note.id) continue;
      try {
        const existing = await supabaseNotes.getNoteById(note.id);
        if (!existing) {
          // Note doesn't exist in Supabase - this could be:
          // 1. A new note created locally (legitimate case)
          // 2. A note that was created but sync failed (should check for duplicates)
          // 
          // To prevent duplicates, check if a note with similar content already exists
          // Check if a note with the same title and content already exists
          // (within a small time window to account for timing differences)
          const duplicate = allRemote.find(
            (remoteNote) =>
              remoteNote.title === note.title &&
              remoteNote.content === note.content &&
              Math.abs(
                new Date(remoteNote.created_at).getTime() -
                new Date(note.created_at).getTime()
              ) < 60000 // Within 1 minute
          );

          if (duplicate) {
            // A duplicate exists - update local note to use the existing ID
            await db.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, note.id);
            await db.runAsync(
              `INSERT INTO ${TABLE} (id, user_id, title, content, is_archived, created_at, updated_at, dirty)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0)
               ON CONFLICT(id) DO UPDATE SET
                 user_id = excluded.user_id,
                 title = excluded.title,
                 content = excluded.content,
                 is_archived = excluded.is_archived,
                 created_at = excluded.created_at,
                 updated_at = excluded.updated_at,
                 dirty = 0`,
              duplicate.id,
              duplicate.user_id,
              duplicate.title,
              duplicate.content,
              duplicate.is_archived ? 1 : 0,
              duplicate.created_at,
              duplicate.updated_at
            );
          } else {
            // No duplicate found - create new note
            const created = await supabaseNotes.createNote({
              user_id: note.user_id,
              title: note.title,
              content: note.content,
            });
            if (note.is_archived) {
              await supabaseNotes.archiveNote(created.id);
            }
            await db.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, note.id);
            await db.runAsync(
              `INSERT INTO ${TABLE} (id, user_id, title, content, is_archived, created_at, updated_at, dirty)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
              created.id,
              created.user_id,
              created.title,
              created.content,
              note.is_archived ? 1 : 0,
              created.created_at,
              created.updated_at
            );
            // Add the newly created note to allRemote for subsequent duplicate checks
            allRemote.push(created);
          }
        } else {
          // Note exists - update it
          await supabaseNotes.updateNote(note.id, {
            title: note.title,
            content: note.content,
          });
          if (note.is_archived) {
            await supabaseNotes.archiveNote(note.id);
          } else {
            await supabaseNotes.restoreNote(note.id);
          }
          await db.runAsync(
            `UPDATE ${TABLE} SET dirty = 0 WHERE id = ?`,
            note.id
          );
        }
      } catch (error) {
        // Log error but keep row dirty for next sync
        console.warn(`[notes-reservoir] Failed to sync note ${note.id}:`, error);
      }
    }

    for (const note of allRemote) {
      await db.runAsync(
        `INSERT INTO ${TABLE} (id, user_id, title, content, is_archived, created_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           title = excluded.title,
           content = excluded.content,
           is_archived = excluded.is_archived,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           dirty = 0`,
        note.id,
        note.user_id,
        note.title,
        note.content,
        note.is_archived ? 1 : 0,
        note.created_at,
        note.updated_at
      );
    }
  } catch (e) {
    console.warn("[notes-reservoir] syncFromSupabase failed:", e);
  } finally {
    isSyncing = false;
  }
}

export async function listNotes(userId?: string): Promise<Note[]> {
  if (!userId) throw new Error("User ID is required");
  if (Platform.OS === "web") {
    return supabaseNotes.listNotes(userId);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.listNotes(userId);

  // Offline-first: Return cached data immediately, sync in background
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC`,
    userId
  );
  
  // If we have cached data, return it immediately and sync in background
  if (rows.length > 0) {
    // Sync in background (non-blocking)
    syncFromSupabase(userId).catch(() => {
      // Sync failed, but we already returned cached data
    });
    return rows.map(rowToNote);
  }

  // No cached data - try to sync, but don't block if network fails
  try {
    await syncFromSupabase(userId);
    // After sync, get the data again
    const syncedRows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${TABLE} WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC`,
      userId
    );
    return syncedRows.map(rowToNote);
  } catch {
    // Network failed, return empty array (better than blocking)
    return [];
  }
}

export async function listArchivedNotes(userId?: string): Promise<Note[]> {
  if (!userId) throw new Error("User ID is required");
  if (Platform.OS === "web") {
    return supabaseNotes.listArchivedNotes(userId);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.listArchivedNotes(userId);

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE user_id = ? AND is_archived = 1 ORDER BY updated_at DESC`,
    userId
  );
  return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
  if (Platform.OS === "web") {
    return supabaseNotes.getNoteById(id);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.getNoteById(id);

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE id = ?`,
    id
  );
  return row ? rowToNote(row) : null;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function createNote(input: {
  user_id: string;
  title: string;
  content: string;
}): Promise<Note> {
  if (Platform.OS === "web") {
    return supabaseNotes.createNote(input);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.createNote(input);

  const id = generateId();
  const now = new Date().toISOString();
  const title = input.title || "Untitled";

  // Check if a note with the same content already exists locally (prevent duplicates)
  const existingLocal = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE user_id = ? AND title = ? AND content = ? AND is_archived = 0 LIMIT 1`,
    input.user_id,
    title,
    input.content
  );

  if (existingLocal) {
    // Return existing note instead of creating duplicate
    return rowToNote(existingLocal);
  }

  await db.runAsync(
    `INSERT INTO ${TABLE} (id, user_id, title, content, is_archived, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, 0, ?, ?, 1)`,
    id,
    input.user_id,
    title,
    input.content,
    now,
    now
  );

  const note: Note = {
    id,
    user_id: input.user_id,
    title,
    content: input.content,
    is_archived: false,
    created_at: now,
    updated_at: now,
  };

  try {
    // Check if note already exists in Supabase before creating
    const allRemoteNotes = await supabaseNotes.listNotes(input.user_id);
    const duplicate = allRemoteNotes.find(
      (remoteNote) =>
        remoteNote.title === title &&
        remoteNote.content === input.content
    );

    if (duplicate) {
      // Update local note to use existing Supabase ID
      await db.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, id);
      await db.runAsync(
        `INSERT INTO ${TABLE} (id, user_id, title, content, is_archived, created_at, updated_at, dirty)
         VALUES (?, ?, ?, ?, 0, ?, ?, 0)`,
        duplicate.id,
        duplicate.user_id,
        duplicate.title,
        duplicate.content,
        duplicate.created_at,
        duplicate.updated_at
      );
      return { ...duplicate };
    }

    const created = await supabaseNotes.createNote({
      user_id: input.user_id,
      title,
      content: input.content,
    });
    await db.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, id);
    await db.runAsync(
      `INSERT INTO ${TABLE} (id, user_id, title, content, is_archived, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, 0, ?, ?, 0)`,
      created.id,
      created.user_id,
      created.title,
      created.content,
      created.created_at,
      created.updated_at
    );
    return { ...created };
  } catch (error) {
    // Sync failed - return local note, it will sync later
    console.warn(`[notes-reservoir] Failed to sync new note immediately:`, error);
    return note;
  }
}

export async function updateNote(
  id: string,
  updates: Partial<Pick<Note, "title" | "content">>
): Promise<Note | null> {
  if (Platform.OS === "web") {
    return supabaseNotes.updateNote(id, updates);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.updateNote(id, updates);

  // Get current note state
  const currentRow = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE id = ?`,
    id
  );
  if (!currentRow) return null;

  const currentNote = rowToNote(currentRow);
  const updated_at = new Date().toISOString();
  const title = updates.title !== undefined ? updates.title : currentNote.title;
  const content = updates.content !== undefined ? updates.content : currentNote.content;

  // Update local database
  await db.runAsync(
    `UPDATE ${TABLE} SET title = ?, content = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
    title,
    content,
    updated_at,
    id
  );

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE id = ?`,
    id
  );
  if (!row) return null;

  try {
    const updated = await supabaseNotes.updateNote(id, {
      title,
      content,
    });
    if (updated) {
      await db.runAsync(
        `UPDATE ${TABLE} SET updated_at = ?, dirty = 0 WHERE id = ?`,
        updated.updated_at,
        id
      );
      return updated;
    }
  } catch (error) {
    // Leave dirty for later sync
    console.warn(`[notes-reservoir] Failed to sync update for note ${id}:`, error);
  }
  return rowToNote(row);
}

export async function archiveNote(id: string): Promise<void> {
  if (Platform.OS === "web") {
    return supabaseNotes.archiveNote(id);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.archiveNote(id);

  const updated_at = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${TABLE} SET is_archived = 1, updated_at = ?, dirty = 1 WHERE id = ?`,
    updated_at,
    id
  );

  try {
    await supabaseNotes.archiveNote(id);
    await db.runAsync(`UPDATE ${TABLE} SET dirty = 0 WHERE id = ?`, id);
  } catch {
    // Leave dirty
  }
}

export async function restoreNote(id: string): Promise<void> {
  if (Platform.OS === "web") {
    return supabaseNotes.restoreNote(id);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.restoreNote(id);

  const updated_at = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${TABLE} SET is_archived = 0, updated_at = ?, dirty = 1 WHERE id = ?`,
    updated_at,
    id
  );

  try {
    await supabaseNotes.restoreNote(id);
    await db.runAsync(`UPDATE ${TABLE} SET dirty = 0 WHERE id = ?`, id);
  } catch {
    // Leave dirty
  }
}

export async function deleteNote(id: string): Promise<void> {
  if (Platform.OS === "web") {
    return supabaseNotes.deleteNote(id);
  }

  const db = await getDbAsync();
  if (!db) return supabaseNotes.deleteNote(id);

  await db.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, id);

  try {
    await supabaseNotes.deleteNote(id);
  } catch {
    // Already removed locally
  }
}
