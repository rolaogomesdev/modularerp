"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";

import { cn } from "../lib/utils";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Shown only while the device is offline. Label arrives translated. */
function OfflineBanner({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const online = React.useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true // SSR: assume online
  );

  if (online) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 bg-warning-bg px-4 py-2 text-sm text-warning",
        className
      )}
    >
      <WifiOff aria-hidden className="size-4" />
      {label}
    </div>
  );
}

export { OfflineBanner };
