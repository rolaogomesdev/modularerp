import * as React from "react";

import { cn } from "../lib/utils";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Action slot — usually a primary Button. */
  action?: React.ReactNode;
}

/** Centered placeholder for empty lists and first-run screens (09-design-system.md). */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-8 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-full bg-accent-muted text-text-muted [&_svg]:size-5 [&_svg]:shrink-0"
        >
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {description ? (
          <p className="text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
