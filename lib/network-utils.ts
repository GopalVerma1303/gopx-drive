import { getNetworkStateAsync } from "expo-network";
import { Platform } from "react-native";

let cachedNetworkState: { isOffline: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // Cache for 5 seconds

/**
 * Check if device is offline
 * Uses a short cache to avoid excessive async calls
 * On web, always returns false (not offline) since offline features are disabled on web
 */
export async function isOffline(): Promise<boolean> {
  // On web, offline features are disabled - always return false
  if (Platform.OS === "web") {
    return false;
  }

  // Check cache first
  if (cachedNetworkState && Date.now() - cachedNetworkState.timestamp < CACHE_DURATION) {
    return cachedNetworkState.isOffline;
  }

  try {
    const state = await getNetworkStateAsync();
    const isOffline = !state.isConnected || !state.isInternetReachable;
    
    // Update cache
    cachedNetworkState = {
      isOffline,
      timestamp: Date.now(),
    };
    
    return isOffline;
  } catch (error) {
    // If we can't check network status, assume we're offline to be safe
    console.warn("Failed to check network status, assuming offline:", error);
    return true;
  }
}

/**
 * Clear the network state cache (useful for testing or when you want fresh status)
 */
export function clearNetworkCache(): void {
  cachedNetworkState = null;
}
