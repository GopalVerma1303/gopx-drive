import { QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import * as eventsApi from "./events";
import * as filesApi from "./files";
import * as notesApi from "./notes";
import type { QueuedMutation } from "./offline-storage";
import {
  getQueuedMutations,
  removeQueuedMutation,
  updateMutationRetry
} from "./offline-storage";

const MAX_RETRIES = 3;

/**
 * Process a single queued mutation
 */
async function processMutation(
  mutation: QueuedMutation,
  queryClient: QueryClient
): Promise<boolean> {
  try {
    let result: any;

    switch (mutation.resource) {
      case "note":
        if (mutation.type === "create") {
          result = await notesApi.createNote(mutation.data);
        } else if (mutation.type === "update") {
          // Check if this is an archive/restore operation
          if (mutation.data.updates?.is_archived === true) {
            await notesApi.archiveNote(mutation.data.id);
          } else if (mutation.data.updates?.is_archived === false) {
            await notesApi.restoreNote(mutation.data.id);
          } else {
            result = await notesApi.updateNote(mutation.data.id, mutation.data.updates);
          }
        } else if (mutation.type === "delete") {
          await notesApi.deleteNote(mutation.data.id);
        }
        queryClient.invalidateQueries({ queryKey: ["notes"] });
        break;

      case "file":
        if (mutation.type === "create") {
          result = await filesApi.uploadFile(mutation.data);
        } else if (mutation.type === "update") {
          // Check if this is an archive/restore operation
          if (mutation.data.updates?.is_archived === true) {
            await filesApi.archiveFile(mutation.data.id);
          } else if (mutation.data.updates?.is_archived === false) {
            await filesApi.restoreFile(mutation.data.id);
          }
          // Note: Files don't have other update operations currently
        } else if (mutation.type === "delete") {
          await filesApi.deleteFile(mutation.data.id);
        }
        queryClient.invalidateQueries({ queryKey: ["files"] });
        break;

      case "event":
        if (mutation.type === "create") {
          result = await eventsApi.createEvent(mutation.data);
        } else if (mutation.type === "update") {
          result = await eventsApi.updateEvent(mutation.data.id, mutation.data.updates);
        } else if (mutation.type === "delete") {
          await eventsApi.deleteEvent(mutation.data.id);
        }
        queryClient.invalidateQueries({ queryKey: ["events"] });
        break;
    }

    // Remove from queue on success
    await removeQueuedMutation(mutation.id);
    return true;
  } catch (error) {
    console.error(`Error processing mutation ${mutation.id}:`, error);

    // Update retry count
    await updateMutationRetry(mutation.id);

    // If max retries reached, remove from queue
    if (mutation.retries >= MAX_RETRIES) {
      console.warn(`Mutation ${mutation.id} exceeded max retries, removing from queue`);
      await removeQueuedMutation(mutation.id);
    }

    return false;
  }
}

/**
 * Sync all queued mutations when back online
 * Offline features are disabled on web - returns empty result
 */
export async function syncQueuedMutations(
  queryClient: QueryClient
): Promise<{ success: number; failed: number }> {
  // Skip on web - offline features disabled
  if (Platform.OS === "web") {
    return { success: 0, failed: 0 };
  }

  const queue = await getQueuedMutations();
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  // Process mutations in order
  for (const mutation of queue) {
    const result = await processMutation(mutation, queryClient);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Check if there are pending mutations
 * Offline features are disabled on web - always returns false
 */
export async function hasPendingMutations(): Promise<boolean> {
  // Skip on web - offline features disabled
  if (Platform.OS === "web") {
    return false;
  }

  const queue = await getQueuedMutations();
  return queue.length > 0;
}
