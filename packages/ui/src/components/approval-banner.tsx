import * as React from "react";
import { cva } from "class-variance-authority";
import { Check, Clock, X } from "lucide-react";

import { cn } from "../lib/utils";

const approvalBannerVariants = cva("flex w-full items-start gap-3 rounded-lg border p-4", {
  variants: {
    status: {
      pending: "border-warning bg-warning-bg",
      approved: "border-success bg-success-bg",
      rejected: "border-danger bg-danger-bg",
    },
  },
});

const statusPresentation = {
  pending: { icon: Clock, iconClassName: "text-warning" },
  approved: { icon: Check, iconClassName: "text-success" },
  rejected: { icon: X, iconClassName: "text-danger" },
} as const;

export interface ApprovalBannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  status: keyof typeof statusPresentation;
  title: React.ReactNode;
  /** Who requested/decided — e.g. "Requested by Ana · 2h ago" (i18n'd by the caller). */
  actor?: React.ReactNode;
  /** Approval or rejection reason. */
  reason?: React.ReactNode;
}

/** Four-eyes workflow banner: pending / approved / rejected, with an action slot (09-design-system.md). */
const ApprovalBanner = React.forwardRef<HTMLDivElement, ApprovalBannerProps>(
  ({ className, status, title, actor, reason, children, ...props }, ref) => {
    const { icon: Icon, iconClassName } = statusPresentation[status];
    return (
      <div
        ref={ref}
        role="status"
        className={cn(approvalBannerVariants({ status }), className)}
        {...props}
      >
        <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", iconClassName)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-medium text-text">{title}</p>
          {actor ? <p className="text-sm text-text-muted">{actor}</p> : null}
          {reason ? <p className="text-sm text-text-muted">{reason}</p> : null}
          {children ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
          ) : null}
        </div>
      </div>
    );
  }
);
ApprovalBanner.displayName = "ApprovalBanner";

export { ApprovalBanner, approvalBannerVariants };
