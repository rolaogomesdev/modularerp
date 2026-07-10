import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "../lib/utils";

const statCardVariants = cva(
  "flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3 shadow-1",
  {
    variants: {
      // Threshold slot — future KPI targets flip this per value (09-design-system.md).
      state: {
        default: "",
        good: "border-l-4 border-l-success",
        warn: "border-l-4 border-l-warning",
        bad: "border-l-4 border-l-danger",
      },
    },
    defaultVariants: {
      state: "default",
    },
  }
);

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Direction only — goodness is expressed via `state`, since "up" isn't always good. */
  trend?: keyof typeof trendIcons;
  trendLabel?: React.ReactNode;
}

/** KPI tile: label, big value, optional trend and threshold state (09-design-system.md). */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, hint, trend, trendLabel, state, ...props }, ref) => {
    const TrendIcon = trend ? trendIcons[trend] : null;
    return (
      <div
        ref={ref}
        className={cn(statCardVariants({ state }), className)}
        {...props}
      >
        <span className="text-sm text-text-muted">{label}</span>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-2xl font-semibold text-text">{value}</span>
          {TrendIcon ? (
            <span className="inline-flex items-center gap-1 text-sm text-text-muted">
              <TrendIcon aria-hidden="true" className="size-4 shrink-0" />
              {trendLabel}
            </span>
          ) : null}
        </div>
        {hint ? <span className="text-sm text-text-faint">{hint}</span> : null}
      </div>
    );
  }
);
StatCard.displayName = "StatCard";

export { StatCard, statCardVariants };
