import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "../lib/utils";

const spinnerVariants = cva("animate-spin text-text-muted", {
  variants: {
    size: {
      sm: "size-4",
      default: "size-5",
      lg: "size-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "aria-label" | "children">,
    VariantProps<typeof spinnerVariants> {
  /** Accessible status text, i18n'd by the caller â€” required (rendered as aria-label). */
  label: string;
}

const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size, label, ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      aria-live="polite"
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <LoaderCircle aria-hidden="true" className={spinnerVariants({ size })} />
    </span>
  )
);
Spinner.displayName = "Spinner";

export { Spinner, spinnerVariants };
