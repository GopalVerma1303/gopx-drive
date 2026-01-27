import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useNetworkStatus } from "@/lib/use-network-status";
import { useQueryClient } from "@tanstack/react-query";
import { syncQueuedMutations } from "@/lib/offline-sync";
import { Alert, Platform } from "react-native";

interface NetworkContextType {
  isOffline: boolean;
  isConnected: boolean;
  isInternetReachable: boolean;
  isLoading: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const networkStatus = useNetworkStatus();
  const queryClient = useQueryClient();
  const wasOffline = useRef(networkStatus.isOffline);

  useEffect(() => {
    // Skip offline sync on web - offline features are disabled on web
    if (Platform.OS === "web") {
      return;
    }

    // When coming back online, sync queued mutations
    if (wasOffline.current && !networkStatus.isOffline) {
      console.log("Network back online, syncing queued mutations...");
      syncQueuedMutations(queryClient)
        .then(({ success, failed }) => {
          if (success > 0 || failed > 0) {
            console.log(`Sync complete: ${success} succeeded, ${failed} failed`);
            if (success > 0) {
              // Optionally show a toast/notification
              // Alert.alert("Sync Complete", `${success} changes synced successfully`);
            }
          }
        })
        .catch((error) => {
          console.error("Error syncing mutations:", error);
        });
    }
    wasOffline.current = networkStatus.isOffline;
  }, [networkStatus.isOffline, queryClient]);

  return (
    <NetworkContext.Provider value={networkStatus}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

