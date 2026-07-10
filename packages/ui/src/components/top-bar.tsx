import * as React from "react";

import { cn } from "../lib/utils";

/** Sticky app header (09-design-system.md shell). Compose slots from the app. */
const TopBar = React.forwardRef<HTMLElement, React.ComponentProps<"header">>(
  ({ className, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-surface px-4",
        className
      )}
      {...props}
    >
      {children}
    </header>
  )
);
TopBar.displayName = "TopBar";

export { TopBar };
