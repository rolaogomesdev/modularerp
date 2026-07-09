import * as React from "react";

import { cn } from "../lib/utils";

export interface ResponsiveTableProps
  extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Column headers — rendered in a thead on sm+ only (mobile shows per-cell labels). */
  headers: React.ReactNode[];
  /** Rows: `<ResponsiveRow />` elements. */
  children: React.ReactNode;
}

/**
 * CSS-only responsive table: a real <table> from sm: up, stacked label/value
 * cards on mobile (09-design-system.md). Pair with `ResponsiveRow`.
 */
const ResponsiveTable = React.forwardRef<HTMLTableElement, ResponsiveTableProps>(
  ({ className, headers, children, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn("block w-full border-collapse sm:table", className)}
        {...props}
      >
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-border">
            {headers.map((header, index) => (
              <th
                key={index}
                scope="col"
                className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-faint"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="flex flex-col gap-3 sm:table-row-group">{children}</tbody>
      </table>
    </div>
  )
);
ResponsiveTable.displayName = "ResponsiveTable";

export interface ResponsiveRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Cell values, in header order. */
  cells: React.ReactNode[];
  /** Per-cell labels shown on mobile only — usually the same strings as `headers`. */
  labels: React.ReactNode[];
}

const ResponsiveRow = React.forwardRef<HTMLTableRowElement, ResponsiveRowProps>(
  ({ className, cells, labels, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        // mobile: stacked card; sm+: plain table row with a bottom hairline
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-1 sm:table-row sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:shadow-none",
        className
      )}
      {...props}
    >
      {cells.map((cell, index) => (
        <td
          key={index}
          className="flex items-baseline justify-between gap-4 sm:table-cell sm:px-4 sm:py-3"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-text-faint sm:hidden">
            {labels[index]}
          </span>
          <span className="text-sm text-text">{cell}</span>
        </td>
      ))}
    </tr>
  )
);
ResponsiveRow.displayName = "ResponsiveRow";

export { ResponsiveTable, ResponsiveRow };
