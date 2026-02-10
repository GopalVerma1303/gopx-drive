import { UI_DEV } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

interface AuthContextValue {
  user: User | null;
  session: any;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SESSION_STORAGE_KEY = "sb-auth-token";

export const [AuthProvider, useAuth] = createContextHook(
  (): AuthContextValue => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      if (UI_DEV) {
        // In UI dev mode, don't auto-login - user must use login/signup (which bypasses auth)
        setSession(null);
        setIsLoading(false);
        return;
      }

      let isMounted = true;

      const initializeSession = async () => {
        try {
          // Supabase will read from AsyncStorage first, then optionally refresh the token
          const {
            data: { session },
          } = await supabase.auth.getSession();

          // Only set user if email is confirmed
          if (session?.user?.email_confirmed_at) {
            if (!isMounted) return;
            setSession(session);
            setUser(session.user);
          } else {
            if (!isMounted) return;
            setSession(null);
            setUser(null);
          }
        } catch {
          // Network failed - Supabase should still have session from AsyncStorage
          // Try reading directly from storage as fallback
          try {
            const keys = await AsyncStorage.getAllKeys();
            const supabaseKey = keys.find(
              (key) =>
                key.includes("supabase.auth.token") ||
                (key.includes("sb-") && key.includes("-auth-token"))
            );

            if (supabaseKey) {
              const stored = await AsyncStorage.getItem(supabaseKey);
              if (stored) {
                const parsed = JSON.parse(stored);
                const sessionValue =
                  parsed?.currentSession || parsed?.session || parsed;

                if (sessionValue?.user?.email_confirmed_at) {
                  if (!isMounted) return;
                  setSession(sessionValue);
                  setUser(sessionValue.user);
                } else if (isMounted) {
                  setSession(null);
                  setUser(null);
                }
                return;
              }
            }

            if (isMounted) {
              setSession(null);
              setUser(null);
            }
          } catch {
            if (isMounted) {
              // Invalid or missing cached data
              setSession(null);
              setUser(null);
            }
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      // Perform the initial session check before we consider auth done
      initializeSession();

      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) {
          return;
        }

        // Handle different auth events
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
        } else if (
          event === "USER_UPDATED" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          // For these events, only set user if email is confirmed
          if (session?.user?.email_confirmed_at) {
            setSession(session);
            setUser(session.user);
          } else {
            // User exists but email not confirmed
            setSession(null);
            setUser(null);
          }
        } else {
          // For other events (like EMAIL_CONFIRMED), check if email is confirmed
          if (session?.user?.email_confirmed_at) {
            setSession(session);
            setUser(session.user);
          } else {
            setSession(null);
            setUser(null);
          }
        }
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }, []);

    const signIn = async (email: string, password: string) => {
      if (UI_DEV) {
        // In UI dev mode, just set a demo user
        setUser({
          id: "demo-user",
          email: email || "demo@example.com",
        } as User);
        return;
      }

      // In production mode, use Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Only set session/user if email is confirmed
      if (data.session && data.user?.email_confirmed_at) {
        setSession(data.session);
        setUser(data.user);
      } else {
        throw new Error("Please verify your email before signing in");
      }
    };

    const signUp = async (email: string, password: string) => {
      if (UI_DEV) {
        // In UI dev mode, just set a demo user
        setUser({
          id: "demo-user",
          email: email || "demo@example.com",
        } as User);
        return;
      }

      // In production mode, use Supabase auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Only set session/user if email is confirmed or if session exists
      // When email confirmation is required, session might be null
      if (data.session && data.user?.email_confirmed_at) {
        setSession(data.session);
        setUser(data.user);
      } else {
        // Email verification required - don't set session/user yet
        setSession(null);
        setUser(null);
      }
    };

    const signOut = async () => {
      if (UI_DEV) {
        // In UI dev mode, just clear the user
        setUser(null);
        setSession(null);
        return;
      }

      // In production mode, use Supabase auth
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      setUser(null);
      setSession(null);
    };

    return {
      user,
      session,
      isLoading,
      signIn,
      signUp,
      signOut,
    };
  }
);
