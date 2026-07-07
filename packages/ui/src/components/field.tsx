import * as React from "react";

import { cn } from "../lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium text-text", className)}
      {...props}
    />
  );
}

/** Label + control + optional error/help — the standard form row (09-design-system.md). */
function Field({
  label,
  htmlFor,
  error,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : help ? (
        <p className="text-sm text-text-muted">{help}</p>
      ) : null}
    </div>
  );
}

export { Field, Label };
