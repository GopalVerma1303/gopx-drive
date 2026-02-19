import { QueryClient } from "@tanstack/react-query";

/**
 * Batch invalidate multiple queries efficiently.
 * This reduces redundant API calls by batching invalidations.
 */
export function batchInvalidateQueries(
  queryClient: QueryClient,
  queryKeys: (string | string[])[]
): void {
  // Use startTransition for React 18+ to batch updates
  queryKeys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
  });
}

/**
 * Common query key patterns for batch invalidation
 */
export const QueryKeys = {
  notes: (userId?: string) => (userId ? ["notes", userId] : ["notes"]),
  notesByFolder: (userId?: string, folderId?: string) => (userId && folderId ? ["notesByFolder", userId, folderId] : ["notesByFolder"]),
  archivedNotes: (userId?: string) => (userId ? ["archivedNotes", userId] : ["archivedNotes"]),
  notesSyncStatus: (userId?: string) => (userId ? ["notes-sync-status", userId] : ["notes-sync-status"]),
  notesUnsyncedIds: (userId?: string) => (userId ? ["notes-unsynced-ids", userId] : ["notes-unsynced-ids"]),
  files: (userId?: string) => (userId ? ["files", userId] : ["files"]),
  filesByFolder: (userId?: string, folderId?: string) => (userId && folderId ? ["filesByFolder", userId, folderId] : ["filesByFolder"]),
  archivedFiles: (userId?: string) => (userId ? ["archivedFiles", userId] : ["archivedFiles"]),
  folders: (userId?: string) => (userId ? ["folders", userId] : ["folders"]),
  folder: (id: string) => ["folder", id],
  events: (userId?: string) => (userId ? ["events", userId] : ["events"]),
  note: (id: string) => ["note", id],
  attachments: (userId?: string) => (userId ? ["attachments", userId] : ["attachments"]),
} as const;

/**
 * Invalidate all notes-related queries after a mutation
 * Also invalidates all individual note queries to ensure consistency
 */
export function invalidateNotesQueries(queryClient: QueryClient, userId?: string): void {
  batchInvalidateQueries(queryClient, [
    QueryKeys.notes(userId),
    QueryKeys.notesByFolder(userId),
    QueryKeys.archivedNotes(userId),
    QueryKeys.notesSyncStatus(userId),
    QueryKeys.notesUnsyncedIds(userId),
  ]);
  queryClient.invalidateQueries({ queryKey: ["note"] });
}

/**
 * Invalidate all files-related queries after a mutation
 */
export function invalidateFilesQueries(queryClient: QueryClient, userId?: string): void {
  batchInvalidateQueries(queryClient, [
    QueryKeys.files(userId),
    QueryKeys.filesByFolder(userId),
    QueryKeys.archivedFiles(userId),
  ]);
}

/**
 * Invalidate all folder-related queries after a mutation
 */
export function invalidateFoldersQueries(queryClient: QueryClient, userId?: string): void {
  queryClient.invalidateQueries({ queryKey: ["folders"] });
  queryClient.invalidateQueries({ queryKey: ["folder"] });
}

/**
 * Invalidate events queries after a mutation
 */
export function invalidateEventsQueries(queryClient: QueryClient, userId?: string): void {
  queryClient.invalidateQueries({ queryKey: QueryKeys.events(userId) });
}

/**
 * Invalidate attachments queries (bucket-only, no note correlation)
 */
export function invalidateAttachmentsQueries(queryClient: QueryClient, userId?: string): void {
  queryClient.invalidateQueries({ queryKey: QueryKeys.attachments(userId) });
}

/**
 * Debounce function for delaying function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for limiting function execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
