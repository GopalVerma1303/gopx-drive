import AsyncStorage from "@react-native-async-storage/async-storage";

// Simple persister interface that matches what we need
interface PersistedClient {
  timestamp: number;
  buster: string;
  cacheState: any;
}

interface Persister {
  persistClient: (client: PersistedClient) => Promise<void>;
  restoreClient: () => Promise<PersistedClient | undefined>;
  removeClient: () => Promise<void>;
}

/**
 * Create a persister for React Query using AsyncStorage
 * This is a simplified version that works without additional packages
 */
export function createAsyncStoragePersister(): Persister {
  const CACHE_KEY = "@react-query-cache";

  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(client));
      } catch (error) {
        console.error("Error persisting query cache:", error);
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const data = await AsyncStorage.getItem(CACHE_KEY);
        if (!data) return undefined;
        return JSON.parse(data);
      } catch (error) {
        console.error("Error restoring query cache:", error);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await AsyncStorage.removeItem(CACHE_KEY);
      } catch (error) {
        console.error("Error removing query cache:", error);
      }
    },
  };
}

/**
 * Manually persist query client state
 * This is a fallback if persistQueryClient is not available
 */
export async function persistQueryClientState(queryClient: any) {
  try {
    const persister = createAsyncStoragePersister();
    const queryCache = queryClient.getQueryCache();
    const mutationCache = queryClient.getMutationCache();
    
    const client: PersistedClient = {
      timestamp: Date.now(),
      buster: "v1",
      cacheState: {
        queries: queryCache.getAll().map((query: any) => ({
          queryKey: query.queryKey,
          queryHash: query.queryHash,
          state: query.state,
          dataUpdatedAt: query.state.dataUpdatedAt,
        })),
        mutations: mutationCache.getAll().map((mutation: any) => ({
          mutationKey: mutation.options.mutationKey,
          state: mutation.state,
        })),
      },
    };

    await persister.persistClient(client);
  } catch (error) {
    console.error("Error persisting query client state:", error);
  }
}

/**
 * Restore query client state
 */
export async function restoreQueryClientState(queryClient: any) {
  try {
    const persister = createAsyncStoragePersister();
    const client = await persister.restoreClient();
    
    if (client && client.cacheState) {
      // Restore queries
      if (client.cacheState.queries) {
        for (const queryState of client.cacheState.queries) {
          queryClient.setQueryData(queryState.queryKey, queryState.state.data);
        }
      }
    }
  } catch (error) {
    console.error("Error restoring query client state:", error);
  }
}
