import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

/**
 * Hook to monitor network status
 * On web, always returns online status since offline features are disabled on web
 */
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: Platform.OS === "web" ? "WEB" : "UNKNOWN",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On web, offline features are disabled - always return online
    if (Platform.OS === "web") {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    // Get initial network state
    getNetworkStateAsync()
      .then((state) => {
        if (mounted) {
          setNetworkState({
            isConnected: state.isConnected ?? true,
            isInternetReachable: state.isInternetReachable ?? true,
            type: state.type ?? "UNKNOWN",
          });
          setIsLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error getting network state:", error);
        if (mounted) {
          setIsLoading(false);
        }
      });

    // Listen for network state changes
    const subscription = addNetworkStateListener((state) => {
      if (mounted) {
        setNetworkState({
          isConnected: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? true,
          type: state.type ?? "UNKNOWN",
        });
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return {
    ...networkState,
    isLoading,
    isOffline: Platform.OS === "web" ? false : (!networkState.isConnected || !networkState.isInternetReachable),
  };
}
