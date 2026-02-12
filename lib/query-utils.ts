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
  archivedNotes: (userId?: string) => (userId ? ["archivedNotes", userId] : ["archivedNotes"]),
  notesSyncStatus: (userId?: string) => (userId ? ["notes-sync-status", userId] : ["notes-sync-status"]),
  notesUnsyncedIds: (userId?: string) => (userId ? ["notes-unsynced-ids", userId] : ["notes-unsynced-ids"]),
  files: (userId?: string) => (userId ? ["files", userId] : ["files"]),
  archivedFiles: (userId?: string) => (userId ? ["archivedFiles", userId] : ["archivedFiles"]),
  events: (userId?: string) => (userId ? ["events", userId] : ["events"]),
  note: (id: string) => ["note", id],
} as const;

/**
 * Invalidate all notes-related queries after a mutation
 * Also invalidates all individual note queries to ensure consistency
 */
export function invalidateNotesQueries(queryClient: QueryClient, userId?: string): void {
  batchInvalidateQueries(queryClient, [
    QueryKeys.notes(userId),
    QueryKeys.archivedNotes(userId),
    QueryKeys.notesSyncStatus(userId),
    QueryKeys.notesUnsyncedIds(userId),
  ]);
  // Also invalidate all individual note queries to ensure they show latest content
  // This fixes the issue where note list updates but individual notes show stale data
  queryClient.invalidateQueries({ queryKey: ["note"] });
}

/**
 * Invalidate all files-related queries after a mutation
 */
export function invalidateFilesQueries(queryClient: QueryClient, userId?: string): void {
  batchInvalidateQueries(queryClient, [
    QueryKeys.files(userId),
    QueryKeys.archivedFiles(userId),
  ]);
}

/**
 * Invalidate events queries after a mutation
 */
export function invalidateEventsQueries(queryClient: QueryClient, userId?: string): void {
  queryClient.invalidateQueries({ queryKey: QueryKeys.events(userId) });
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
