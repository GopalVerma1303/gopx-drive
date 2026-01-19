import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  NOTES: "@offline/notes",
  FILES: "@offline/files",
  EVENTS: "@offline/events",
  MUTATION_QUEUE: "@offline/mutation_queue",
  LAST_SYNC: "@offline/last_sync",
} as const;

export interface QueuedMutation {
  id: string;
  type: "create" | "update" | "delete";
  resource: "note" | "file" | "event";
  data: any;
  timestamp: number;
  retries: number;
}

/**
 * Get cached data for a resource
 */
export async function getCachedData<T>(
  resource: "notes" | "files" | "events"
): Promise<T | null> {
  try {
    const key = STORAGE_KEYS[resource.toUpperCase() as keyof typeof STORAGE_KEYS];
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting cached ${resource}:`, error);
    return null;
  }
}

/**
 * Save data to cache
 */
export async function setCachedData<T>(
  resource: "notes" | "files" | "events",
  data: T
): Promise<void> {
  try {
    const key = STORAGE_KEYS[resource.toUpperCase() as keyof typeof STORAGE_KEYS];
    await AsyncStorage.setItem(key, JSON.stringify(data));
    await setLastSyncTime();
  } catch (error) {
    console.error(`Error caching ${resource}:`, error);
  }
}

/**
 * Get queued mutations
 */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MUTATION_QUEUE);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting queued mutations:", error);
    return [];
  }
}

/**
 * Add mutation to queue
 */
export async function queueMutation(
  mutation: Omit<QueuedMutation, "id" | "timestamp" | "retries">
): Promise<string> {
  try {
    const queue = await getQueuedMutations();
    const id = `mutation_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(queuedMutation);
    await AsyncStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
    return id;
  } catch (error) {
    console.error("Error queueing mutation:", error);
    throw error;
  }
}

/**
 * Remove mutation from queue
 */
export async function removeQueuedMutation(id: string): Promise<void> {
  try {
    const queue = await getQueuedMutations();
    const filtered = queue.filter((m) => m.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing queued mutation:", error);
  }
}

/**
 * Update mutation retry count
 */
export async function updateMutationRetry(id: string): Promise<void> {
  try {
    const queue = await getQueuedMutations();
    const mutation = queue.find((m) => m.id === id);
    if (mutation) {
      mutation.retries += 1;
      await AsyncStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
    }
  } catch (error) {
    console.error("Error updating mutation retry:", error);
  }
}

/**
 * Clear all queued mutations
 */
export async function clearQueuedMutations(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.MUTATION_QUEUE);
  } catch (error) {
    console.error("Error clearing queued mutations:", error);
  }
}

/**
 * Get last sync time
 */
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return data ? parseInt(data, 10) : null;
  } catch (error) {
    console.error("Error getting last sync time:", error);
    return null;
  }
}

/**
 * Set last sync time
 */
export async function setLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  } catch (error) {
    console.error("Error setting last sync time:", error);
  }
}

/**
 * Clear all cached data (useful for logout or reset)
 */
export async function clearAllCachedData(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.NOTES),
      AsyncStorage.removeItem(STORAGE_KEYS.FILES),
      AsyncStorage.removeItem(STORAGE_KEYS.EVENTS),
      AsyncStorage.removeItem(STORAGE_KEYS.MUTATION_QUEUE),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
    ]);
  } catch (error) {
    console.error("Error clearing cached data:", error);
  }
}
