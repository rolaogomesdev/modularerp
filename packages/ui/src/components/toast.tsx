"use client";

import * as React from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster> & {
  /** i18n contract: sonner defaults this to English — callers must supply it */
  containerAriaLabel: string;
};

/**
 * Preconfigured sonner Toaster mapped onto the design tokens.
 * Render once in the app shell; fire notifications via `toast(...)`.
 */
function Toaster({ toastOptions, containerAriaLabel, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      position="top-center"
      containerAriaLabel={containerAriaLabel}
      toastOptions={{
        classNames: {
          toast:
            "rounded-md border border-border bg-surface-raised text-text shadow-2",
          title: "text-sm font-medium text-text",
          description: "text-sm text-text-muted",
          actionButton: "bg-accent text-accent-fg",
          cancelButton: "bg-accent-muted text-text",
        },
        ...toastOptions,
      }}
      {...props}
    />
  );
}
Toaster.displayName = "Toaster";

export { Toaster, toast };
