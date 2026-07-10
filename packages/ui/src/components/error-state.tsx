"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";

export interface ErrorStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Text for the retry button (i18n'd by the caller). */
  retryLabel: React.ReactNode;
  /** Client-side retry handler. Takes precedence over `retryAction`. */
  onRetry?: () => void;
  /** Form action (e.g. a server action) — used when `onRetry` is not given. */
  retryAction?: React.ComponentProps<"form">["action"];
}

/** Centered error placeholder with a retry affordance (09-design-system.md). */
const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    { className, title, description, retryLabel, onRetry, retryAction, ...props },
    ref
  ) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-8 text-center",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-danger-bg text-danger [&_svg]:size-5 [&_svg]:shrink-0"
      >
        <CircleAlert />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {description ? (
          <p className="text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : retryAction ? (
        <form action={retryAction} className="mt-2">
          <Button variant="outline" type="submit">
            {retryLabel}
          </Button>
        </form>
      ) : null}
    </div>
  )
);
ErrorState.displayName = "ErrorState";

export { ErrorState };
