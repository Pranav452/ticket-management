import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

export interface BajajUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  department: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  bajajUser: BajajUser | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setBajajUser: (bajajUser: BajajUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  bajajUser: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setBajajUser: (bajajUser) => set({ bajajUser }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () => set({ user: null, profile: null, bajajUser: null, isLoading: false }),
}));
