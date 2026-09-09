"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium text-danger">Something went wrong</p>
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">
        We hit an unexpected error
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This has been logged. You can try again, or head back to your
        dashboard.
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
