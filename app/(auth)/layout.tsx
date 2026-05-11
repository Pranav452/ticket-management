export const dynamic = "force-dynamic";

// The LoginForm component has its own full-page layout — this wrapper is a passthrough.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
