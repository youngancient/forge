"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/cn";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Popup>) {
  return (
    <BaseDialog.Portal>
      {/* emil-design-eng: modals stay centered, backdrop dims to focus */}
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ease-[var(--ease-out)]",
          "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        )}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <BaseDialog.Popup
          className={cn(
            "w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg",
            "transition-[transform,opacity] duration-200 ease-[var(--ease-out)]",
            // never scale from 0 — start from 0.95 + opacity per emil-design-eng
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </BaseDialog.Popup>
      </div>
    </BaseDialog.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn(
        "text-lg font-semibold tracking-[-0.01em]",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
