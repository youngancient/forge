"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABEL } from "@/lib/status";
import type { ProposalStatus } from "@prisma/client";

const SEARCH_DEBOUNCE_MS = 300;
const ALL_STATUSES = Object.keys(STATUS_LABEL) as ProposalStatus[];

export function DashboardToolbar({
  currentQuery,
  currentStatus,
  isManager,
}: {
  currentQuery: string;
  currentStatus: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(currentQuery);

  function navigate(nextQuery: string, nextStatus: string) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  // Debounced so typing doesn't trigger a navigation on every keystroke —
  // the status select below is a discrete action, so it navigates immediately.
  useEffect(() => {
    if (query === currentQuery) return;
    const timeout = setTimeout(() => navigate(query, currentStatus), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Drafts are already excluded from a manager's base query entirely — no
  // point offering it as a filter option they can never match.
  const statusOptions = ALL_STATUSES.filter(
    (status) => !(isManager && status === "DRAFT"),
  );

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-64 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, client, company, or creator…"
          className="pl-9"
        />
      </div>
      <Select
        value={currentStatus}
        onValueChange={(value) => navigate(query, value as string)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All statuses">
            {(value: string | null) =>
              !value || value === "ALL"
                ? "All statuses"
                : STATUS_LABEL[value as ProposalStatus]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {statusOptions.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABEL[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
