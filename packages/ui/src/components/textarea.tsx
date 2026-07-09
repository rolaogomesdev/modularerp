import * as React from "react";

import { cn } from "../lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      // min-h-24: comfortable multi-line editing on mobile (09-design-system.md)
      "flex min-h-24 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text placeholder:text-text-faint outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
