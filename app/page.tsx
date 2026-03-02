import { ModuleSelector } from "@/components/bajaj/ModuleSelector";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const profile = {
    id: "demo-user-1",
    full_name: "Demo User",
    email: "demo.user@example.com",
    avatar_url: null,
    role: "dev",
    created_at: new Date().toISOString(),
  };

  return <ModuleSelector profile={profile} />;
}
