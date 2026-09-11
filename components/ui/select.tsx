"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export const Select = BaseSelect.Root;
export const SelectValue = BaseSelect.Value;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "flex h-9 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-colors duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="text-muted-foreground">
        <ChevronDown className="h-4 w-4" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Popup>) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        className="z-50"
        sideOffset={4}
        alignItemWithTrigger={false}
      >
        <BaseSelect.Popup
          className={cn(
            "max-h-64 min-w-[var(--anchor-width)] overflow-auto rounded-md border border-border bg-surface p-1 shadow-lg",
            "transition-[transform,opacity] duration-150 ease-[var(--ease-out)]",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none data-[highlighted]:bg-muted",
        className,
      )}
      {...props}
    >
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
}
