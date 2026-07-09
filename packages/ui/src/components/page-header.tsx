import * as React from "react";
import { ChevronLeft } from "lucide-react";

import { cn } from "../lib/utils";

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Action slot (buttons, menus) — stacks below the title on mobile, aligns right on sm+. */
  action?: React.ReactNode;
  /** Rendered as a text link above the title. Requires `backLabel` for the link text. */
  backHref?: string;
  backLabel?: React.ReactNode;
}

/** Standard screen header: back link, title, description, action slot (09-design-system.md). */
const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    { className, title, description, action, backHref, backLabel, children, ...props },
    ref
  ) => (
    <header ref={ref} className={cn("flex flex-col gap-3", className)} {...props}>
      {backHref && backLabel ? (
        <a
          href={backHref}
          className="inline-flex items-center gap-1 self-start rounded-sm text-sm text-text-muted outline-none transition-colors duration-fast hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <ChevronLeft aria-hidden="true" />
          {backLabel}
        </a>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </header>
  )
);
PageHeader.displayName = "PageHeader";

export { PageHeader };
