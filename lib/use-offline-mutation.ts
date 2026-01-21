import { useMutation, UseMutationOptions, useQueryClient } from "@tanstack/react-query";
import { useNetwork } from "@/contexts/network-context";
import { queueMutation } from "./offline-storage";

/**
 * Enhanced useMutation hook that queues mutations when offline
 */
export function useOfflineMutation<TData = unknown, TError = unknown, TVariables = void>(
  options: UseMutationOptions<TData, TError, TVariables> & {
    resource?: "note" | "file" | "event";
    mutationType?: "create" | "update" | "delete";
    mutationFn: (variables: TVariables) => Promise<TData>;
  }
) {
  const { isOffline } = useNetwork();
  const queryClient = useQueryClient();
  const { resource, mutationType, mutationFn, onSuccess, ...restOptions } = options;

  return useMutation<TData, TError, TVariables>({
    ...restOptions,
    mutationFn: async (variables: TVariables) => {
      if (isOffline && resource && mutationType) {
        // Queue the mutation
        await queueMutation({
          type: mutationType,
          resource,
          data: variables,
        });

        // Return optimistic response
        if (mutationType === "create") {
          return {
            id: `temp_${Date.now()}`,
            ...(variables as any),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as TData;
        } else if (mutationType === "update") {
          return {
            ...(variables as any).existing,
            ...(variables as any).updates,
            updated_at: new Date().toISOString(),
          } as TData;
        } else {
          return undefined as TData;
        }
      }

      try {
        return await mutationFn(variables);
      } catch (error) {
        // Queue for retry on error
        if (resource && mutationType) {
          await queueMutation({
            type: mutationType,
            resource,
            data: variables,
          });
        }
        throw error;
      }
    },
    onSuccess: async (data, variables, context) => {
      // Invalidate queries to refresh data
      if (resource === "note") {
        queryClient.invalidateQueries({ queryKey: ["notes"] });
      } else if (resource === "file") {
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } else if (resource === "event") {
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }

      // Call original onSuccess if provided
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
  });
}
