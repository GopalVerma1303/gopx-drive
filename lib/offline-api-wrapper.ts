import { useNetworkStatus } from "./use-network-status";
import {
  getCachedData,
  setCachedData,
  queueMutation,
} from "./offline-storage";
import type { Note, File, Event } from "./supabase";

/**
 * Wrapper for list operations that checks cache when offline
 */
export async function withOfflineSupport<T>(
  resource: "notes" | "files" | "events",
  apiCall: () => Promise<T>,
  isOffline: boolean
): Promise<T> {
  if (isOffline) {
    // Try to get from cache first
    const cached = await getCachedData<T>(resource);
    if (cached) {
      console.log(`Using cached ${resource} data (offline mode)`);
      return cached;
    }
    // If no cache, return empty array as fallback
    console.warn(`No cached ${resource} data available, returning empty`);
    return [] as unknown as T;
  }

  try {
    // Online: fetch from API
    const data = await apiCall();
    // Cache the result
    await setCachedData(resource, data);
    return data;
  } catch (error) {
    // If API call fails, try cache as fallback
    console.warn(`API call failed for ${resource}, trying cache:`, error);
    const cached = await getCachedData<T>(resource);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Wrapper for get by ID operations
 */
export async function withOfflineGetById<T>(
  resource: "notes" | "files" | "events",
  id: string,
  apiCall: () => Promise<T | null>,
  isOffline: boolean
): Promise<T | null> {
  if (isOffline) {
    // Get from cached list
    const cached = await getCachedData<T[]>(resource);
    if (cached) {
      const item = cached.find((item: any) => item.id === id);
      return item || null;
    }
    return null;
  }

  try {
    const data = await apiCall();
    // If we got data, update cache
    if (data) {
      const cached = await getCachedData<T[]>(resource);
      if (cached) {
        const index = cached.findIndex((item: any) => item.id === id);
        if (index >= 0) {
          cached[index] = data;
        } else {
          cached.push(data);
        }
        await setCachedData(resource, cached);
      }
    }
    return data;
  } catch (error) {
    // Try cache as fallback
    const cached = await getCachedData<T[]>(resource);
    if (cached) {
      const item = cached.find((item: any) => item.id === id);
      if (item) return item;
    }
    throw error;
  }
}

/**
 * Wrapper for mutations that queues when offline
 */
export async function withOfflineMutation<T>(
  resource: "note" | "file" | "event",
  type: "create" | "update" | "delete",
  mutationFn: () => Promise<T>,
  mutationData: any,
  isOffline: boolean
): Promise<T> {
  if (isOffline) {
    // Queue the mutation
    console.log(`Queueing ${type} ${resource} mutation (offline mode)`);
    await queueMutation({
      type,
      resource,
      data: mutationData,
    });

    // For optimistic updates, return a mock response
    if (type === "create") {
      return {
        id: `temp_${Date.now()}`,
        ...mutationData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as T;
    } else if (type === "update") {
      // Return updated data optimistically
      return {
        ...mutationData.existing,
        ...mutationData.updates,
        updated_at: new Date().toISOString(),
      } as T;
    } else {
      // For delete, just return void-like
      return undefined as T;
    }
  }

  try {
    // Online: execute mutation
    const result = await mutationFn();
    return result;
  } catch (error) {
    // If mutation fails, queue it anyway for retry
    console.warn(`Mutation failed, queueing for retry:`, error);
    await queueMutation({
      type,
      resource,
      data: mutationData,
    });
    throw error;
  }
}
