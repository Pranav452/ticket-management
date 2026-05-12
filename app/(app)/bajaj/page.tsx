import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BajajIndexPage() {
  redirect("/bajaj/home");
}
