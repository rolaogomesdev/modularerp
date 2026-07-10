import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "../lib/utils";

/** Fixed mobile tab bar — hidden on lg+ where the Sidebar takes over. */
const BottomNav = React.forwardRef<HTMLElement, React.ComponentProps<"nav">>(
  ({ className, children, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe lg:hidden",
        className
      )}
      {...props}
    >
      <div className="mx-auto grid h-16 max-w-md auto-cols-fr grid-flow-col">
        {children}
      </div>
    </nav>
  )
);
BottomNav.displayName = "BottomNav";

type BottomNavItemProps = React.ComponentProps<"a"> & {
  active?: boolean;
  /** compose icon + <span>label</span> inside the single child (e.g. a Link) */
  asChild?: boolean;
};

const BottomNavItem = React.forwardRef<HTMLAnchorElement, BottomNavItemProps>(
  ({ active = false, asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return (
      <Comp
        ref={ref}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-col items-center justify-center gap-1 text-xs transition-colors duration-fast outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg [&_svg]:size-5",
          active ? "font-medium text-accent" : "text-text-muted",
          className
        )}
        {...props}
      />
    );
  }
);
BottomNavItem.displayName = "BottomNavItem";

export { BottomNav, BottomNavItem };
