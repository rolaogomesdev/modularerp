import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Token-styled native <select>. Interim primitive — replaced by the Radix
 * Select when the Phase 2 design-system pass lands (09-design-system.md).
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full appearance-none rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
