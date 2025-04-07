// stores/useAuthStore.ts
import { create } from "zustand";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
};

const supabase = createSupabaseClient();

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  clearUser: () => set({ user: null }),

  setUser: (user) => set({ user, isLoading: false }),

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      set({ user, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error };
      }

      set({ user: null });
      return { success: true };
    } catch (error) {
      console.error("Logout failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    }
  },
}));

// Initialize auth listener in store
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setUser(session?.user || null);
});
