"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface CurrentUser {
  id: string
  email: string
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email ?? "" })
      }
    })
  }, [])

  return user
}
