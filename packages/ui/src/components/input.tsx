import * as React from "react";

import { cn } from "../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // h-11: comfortable mobile touch target (09-design-system.md)
        "flex h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-text placeholder:text-text-faint outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
