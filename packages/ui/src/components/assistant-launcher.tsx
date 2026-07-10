import * as React from "react";
import { Sparkles } from "lucide-react";

import { cn } from "../lib/utils";

type AssistantLauncherProps = Omit<
  React.ComponentProps<"button">,
  "aria-label"
> & {
  /** accessible name — required, arrives translated from the app */
  "aria-label": string;
};

/**
 * The floating entry point of the AI assistant (09-design-system.md).
 * Positioned above the BottomNav on mobile, corner-anchored on desktop.
 * Behaviour (dialog / ⌘K) is wired by the app.
 */
const AssistantLauncher = React.forwardRef<
  HTMLButtonElement,
  AssistantLauncherProps
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "fixed bottom-safe-fab right-4 z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-3 transition-transform duration-fast outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg lg:bottom-6 lg:right-6",
      className
    )}
    {...props}
  >
    <Sparkles aria-hidden className="size-6" />
  </button>
));
AssistantLauncher.displayName = "AssistantLauncher";

export { AssistantLauncher };
