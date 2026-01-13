import { UI_DEV } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import createContextHook from "@nkzw/create-context-hook";
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

      // In production mode, use Supabase auth
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      });

      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      });

      return () => subscription.unsubscribe();
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

      setSession(data.session);
      setUser(data.user);
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

      setSession(data.session);
      setUser(data.user);
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
