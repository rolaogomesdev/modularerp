import * as React from "react";
import { Search } from "lucide-react";

import { cn } from "../lib/utils";
import { Input } from "./input";

export interface SearchInputProps extends React.ComponentProps<"input"> {
  /** Required — the icon carries no text, so the field must be named for assistive tech. */
  "aria-label": string;
}

/** Input with a leading search icon — the standard list-filter control (09-design-system.md). */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
      />
      <Input ref={ref} type="search" className={cn("pl-10", className)} {...props} />
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
