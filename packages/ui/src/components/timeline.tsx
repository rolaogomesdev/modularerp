import * as React from "react";

import { cn } from "../lib/utils";

/** Vertical activity feed — audit trails, request histories (09-design-system.md). */
const Timeline = React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol ref={ref} className={cn("flex flex-col", className)} {...props} />
  )
);
Timeline.displayName = "Timeline";

export interface TimelineItemProps
  extends Omit<React.HTMLAttributes<HTMLLIElement>, "title"> {
  title: React.ReactNode;
  timestamp: React.ReactNode;
  description?: React.ReactNode;
  /** Replaces the default dot with a small icon marker. */
  icon?: React.ReactNode;
  /** Hides the connector line below the last entry. */
  last?: boolean;
}

const TimelineItem = React.forwardRef<HTMLLIElement, TimelineItemProps>(
  ({ className, title, timestamp, description, icon, last = false, children, ...props }, ref) => (
    <li ref={ref} className={cn("flex gap-3", className)} {...props}>
      <div aria-hidden="true" className="flex flex-col items-center">
        {icon ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-muted text-text-muted [&_svg]:size-3.5 [&_svg]:shrink-0">
            {icon}
          </span>
        ) : (
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
        )}
        {last ? null : <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={cn("flex min-w-0 flex-col gap-0.5", last ? "pb-0" : "pb-6")}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-text">{title}</span>
          <span className="text-xs text-text-faint">{timestamp}</span>
        </div>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        {children}
      </div>
    </li>
  )
);
TimelineItem.displayName = "TimelineItem";

export { Timeline, TimelineItem };
