"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { BajajUser } from "@/lib/stores/auth-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  const setUser      = useAuthStore((s) => s.setUser);
  const setBajajUser = useAuthStore((s) => s.setBajajUser);
  const setLoading   = useAuthStore((s) => s.setLoading);
  const clearAuth    = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    const supabase = createClient();

    async function loadSession() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        try {
          const res = await fetch("/api/bajaj/auth/me");
          if (res.ok) {
            const data = await res.json() as BajajUser & { status?: string };
            if (data.id) setBajajUser(data);
          }
        } catch {
          // ignore — user is still authenticated in Supabase
        }
      }
      setLoading(false);
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);
          try {
            const res = await fetch("/api/bajaj/auth/me");
            if (res.ok) {
              const data = await res.json() as BajajUser & { status?: string };
              if (data.id) setBajajUser(data);
            }
          } catch {
            // ignore
          }
        } else if (event === "SIGNED_OUT") {
          clearAuth();
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
