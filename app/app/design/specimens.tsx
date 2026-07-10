"use client";

// Interactive specimens for the /design gallery. Client-only because they
// hold open/checked state or fire imperative toasts. Specimen literals are
// allowed here (documented eslint exception for app/design/**).

import * as React from "react";
import { Bell, Funnel, LogOut, Settings, User } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { ErrorState } from "@repo/ui/components/error-state";
import { Field } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { toast } from "@repo/ui/components/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent closeLabel="Close">
        <DialogHeader>
          <DialogTitle>Archive employee record?</DialogTitle>
          <DialogDescription>
            The record stays in the audit log and can be restored by an HR
            manager at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive">Archive</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SheetDemo() {
  const teamFieldId = React.useId();
  return (
    <div className="flex flex-wrap gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Bottom sheet</Button>
        </SheetTrigger>
        <SheetContent side="bottom" closeLabel="Close">
          <SheetHeader>
            <SheetTitle>Filter absences</SheetTitle>
            <SheetDescription>
              Mobile-first bottom sheet — the default side.
            </SheetDescription>
          </SheetHeader>
          <Field label="Team" htmlFor={teamFieldId}>
            <Input id={teamFieldId} placeholder="All teams" />
          </Field>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="outline">Reset</Button>
            </SheetClose>
            <SheetClose asChild>
              <Button>Apply</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Right sheet</Button>
        </SheetTrigger>
        <SheetContent side="right" closeLabel="Close">
          <SheetHeader>
            <SheetTitle>Request details</SheetTitle>
            <SheetDescription>
              Side panel for desktop detail views.
            </SheetDescription>
          </SheetHeader>
          <p className="text-sm text-text-muted">
            Annual leave, 3 days, pending approval.
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function DropdownMenuDemo() {
  const [showArchived, setShowArchived] = React.useState(true);
  const [density, setDensity] = React.useState("comfortable");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Funnel />
          Options
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>My account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User />
          Profile
          <DropdownMenuShortcut>⇧P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Bell />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showArchived}
          onCheckedChange={setShowArchived}
        >
          Show archived
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
          <DropdownMenuRadioItem value="comfortable">
            Comfortable
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-text">Working hours</p>
          <p className="text-sm text-text-muted">
            Mon–Fri, 09:00–18:00 (Europe/Lisbon). Overrides are set per
            employee contract.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TooltipDemo() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Inverted chip — dark on light, light on dark</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast("Draft saved")}>
        Toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.success("Employee created", {
            description: "Ana Silva was added to the Lisbon team.",
          })
        }
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Something went wrong", {
            description: "The request could not be saved. Try again.",
          })
        }
      >
        Error toast
      </Button>
    </div>
  );
}

export function ErrorStateDemo() {
  return (
    <ErrorState
      title="Could not load absences"
      description="The server took too long to respond."
      retryLabel="Try again"
      onRetry={() => toast("Retrying…")}
    />
  );
}
