"use client";

import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/lib/types";

const demoProfiles: Profile[] = [
  {
    id: "demo-user-1",
    email: "demo.user@example.com",
    full_name: "Demo User",
    avatar_url: null,
    role: "dev",
    created_at: new Date().toISOString(),
  } as Profile,
  {
    id: "demo-user-2",
    email: "assignee@example.com",
    full_name: "Assignee Demo",
    avatar_url: null,
    role: "agent",
    created_at: new Date().toISOString(),
  } as Profile,
];

// ─── Fetch current user's profile (demo) ──────────────────
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      return demoProfiles[0] ?? null;
    },
  });
}

// ─── Fetch all profiles (demo) ────────────────────────────
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      return demoProfiles;
    },
  });
}
