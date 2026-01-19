import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
import { useEffect, useState } from "react";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

/**
 * Hook to monitor network status
 */
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: "UNKNOWN",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
    isOffline: !networkState.isConnected || !networkState.isInternetReachable,
  };
}
