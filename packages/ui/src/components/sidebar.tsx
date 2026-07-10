import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "../lib/utils";

/** Desktop navigation rail — hidden below lg (BottomNav covers mobile). */
const Sidebar = React.forwardRef<
  HTMLElement,
  React.ComponentProps<"aside"> & {
    header?: React.ReactNode;
    footer?: React.ReactNode;
  }
>(({ className, header, footer, children, ...props }, ref) => (
  <aside
    ref={ref}
    className={cn(
      "sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex",
      className
    )}
    {...props}
  >
    {header ? <div className="border-b border-border p-4">{header}</div> : null}
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {children}
    </nav>
    {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
  </aside>
));
Sidebar.displayName = "Sidebar";

type SidebarItemProps = React.ComponentProps<"a"> & {
  active?: boolean;
  /** compose icon + <span>label</span> inside the single child (e.g. a Link) */
  asChild?: boolean;
};

const SidebarItem = React.forwardRef<HTMLAnchorElement, SidebarItemProps>(
  ({ active = false, asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "a";
    return (
      <Comp
        ref={ref}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-fast outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg [&_svg]:size-4 [&_svg]:shrink-0",
          active
            ? "bg-accent-muted font-medium text-text"
            : "text-text-muted hover:bg-accent-muted hover:text-text",
          className
        )}
        {...props}
      />
    );
  }
);
SidebarItem.displayName = "SidebarItem";

export { Sidebar, SidebarItem };
