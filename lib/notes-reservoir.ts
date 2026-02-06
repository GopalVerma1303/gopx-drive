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

  isSyncing = true;
  try {
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
        } else {
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
      } catch {
        // Keep row dirty for next sync
      }
    }

    const remote = await supabaseNotes.listNotes(userId);
    const archived = await supabaseNotes.listArchivedNotes(userId);
    const allRemote = [...remote, ...archived];

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

  const hasLocal = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${TABLE} WHERE user_id = ?`,
    userId
  );
  if ((hasLocal?.c ?? 0) === 0) {
    await syncFromSupabase(userId);
  }

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC`,
    userId
  );
  return rows.map(rowToNote);
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
  } catch {
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

  const updated_at = new Date().toISOString();
  const title = updates.title !== undefined ? updates.title : null;
  const content = updates.content !== undefined ? updates.content : null;

  if (title !== null) {
    await db.runAsync(
      `UPDATE ${TABLE} SET title = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
      title,
      updated_at,
      id
    );
  }
  if (content !== null) {
    await db.runAsync(
      `UPDATE ${TABLE} SET content = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
      content,
      updated_at,
      id
    );
  }

  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLE} WHERE id = ?`,
    id
  );
  if (!row) return null;

  try {
    const updated = await supabaseNotes.updateNote(id, {
      ...(title !== null && { title }),
      ...(content !== null && { content }),
    });
    if (updated) {
      await db.runAsync(
        `UPDATE ${TABLE} SET updated_at = ?, dirty = 0 WHERE id = ?`,
        updated.updated_at,
        id
      );
      return updated;
    }
  } catch {
    // Leave dirty for later sync
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
