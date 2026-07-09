import * as React from "react";
import { type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Required: the button renders only an icon, so it must carry its own accessible name. */
  "aria-label": string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size = "icon", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
IconButton.displayName = "IconButton";

export { IconButton };
