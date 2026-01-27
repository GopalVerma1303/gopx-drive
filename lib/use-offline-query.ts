import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { Platform } from "react-native";
import { useNetwork } from "@/contexts/network-context";
import { getCachedData, setCachedData } from "./offline-storage";

/**
 * Enhanced useQuery hook that automatically uses cache when offline
 * Offline features are disabled on web
 */
export function useOfflineQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError> & {
    resource?: "notes" | "files" | "events";
    queryFn: () => Promise<TData>;
  }
) {
  const { isOffline } = useNetwork();
  const { resource, queryFn, ...restOptions } = options;

  return useQuery<TData, TError>({
    ...restOptions,
    queryFn: async () => {
      // Skip offline cache on web - offline features disabled
      if (Platform.OS !== "web" && isOffline && resource) {
        // Try to get from cache
        const cached = await getCachedData<TData>(resource);
        if (cached) {
          return cached;
        }
        // If no cache and offline, return empty/default
        return [] as unknown as TData;
      }

      try {
        const data = await queryFn();
        // Cache the result (only on mobile)
        if (Platform.OS !== "web" && resource) {
          await setCachedData(resource, data);
        }
        return data;
      } catch (error) {
        // On error, try cache as fallback (only on mobile)
        if (Platform.OS !== "web" && resource) {
          const cached = await getCachedData<TData>(resource);
          if (cached) {
            return cached;
          }
        }
        throw error;
      }
    },
    // Use cached data when offline
    enabled: restOptions.enabled !== false,
  });
}
