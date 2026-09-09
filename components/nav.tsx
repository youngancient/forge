"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function Nav({
  name,
  role,
}: {
  name: string;
  role: "SALESPERSON" | "MANAGER";
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    ...(role === "MANAGER"
      ? [{ href: "/approvals", label: "Approvals" }]
      : []),
  ];

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-semibold">
            Forge
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-[var(--ease-out)] hover:bg-muted hover:text-foreground",
                  pathname.startsWith(link.href) &&
                    "bg-muted text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{name}</span>
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-9 px-0"
            aria-label="Sign out"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
