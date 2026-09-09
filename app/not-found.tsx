import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
