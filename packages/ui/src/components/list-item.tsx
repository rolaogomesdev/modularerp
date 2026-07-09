import * as React from "react";

import { cn } from "../lib/utils";

export interface ListItemProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned slot: badge, amount, chevron, timestamp… */
  meta?: React.ReactNode;
  /** When given, the row renders as a link and gains a hover state. */
  href?: string;
}

/** The standard card-row for every list screen (09-design-system.md). */
const ListItem = React.forwardRef<HTMLElement, ListItemProps>(
  ({ className, title, subtitle, meta, href, ...props }, ref) => {
    const content = (
      <>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-text">{title}</span>
          {subtitle ? (
            <span className="truncate text-sm text-text-muted">{subtitle}</span>
          ) : null}
        </div>
        {meta ? (
          <div className="flex shrink-0 items-center gap-2 text-sm text-text-muted">
            {meta}
          </div>
        ) : null}
      </>
    );

    const baseClassName = cn(
      "flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-1",
      href &&
        "outline-none transition-colors duration-fast hover:bg-accent-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
      className
    );

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={baseClassName}
          {...props}
        >
          {content}
        </a>
      );
    }
    return (
      <div ref={ref as React.Ref<HTMLDivElement>} className={baseClassName} {...props}>
        {content}
      </div>
    );
  }
);
ListItem.displayName = "ListItem";

export { ListItem };
