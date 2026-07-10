import {
  Check,
  Inbox,
  Pencil,
  Plus,
  Send,
  UserPlus,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/accordion";
import { ApprovalBanner } from "@repo/ui/components/approval-banner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { EmptyState } from "@repo/ui/components/empty-state";
import { Field, Label } from "@repo/ui/components/field";
import { IconButton } from "@repo/ui/components/icon-button";
import { Input } from "@repo/ui/components/input";
import { ListItem } from "@repo/ui/components/list-item";
import { NativeSelect } from "@repo/ui/components/native-select";
import { PageHeader } from "@repo/ui/components/page-header";
import { Progress } from "@repo/ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import {
  ResponsiveRow,
  ResponsiveTable,
} from "@repo/ui/components/responsive-table";
import { SearchInput } from "@repo/ui/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Spinner } from "@repo/ui/components/spinner";
import { StatCard } from "@repo/ui/components/stat-card";
import { Switch } from "@repo/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import { Textarea } from "@repo/ui/components/textarea";
import { Timeline, TimelineItem } from "@repo/ui/components/timeline";
import { Toaster } from "@repo/ui/components/toast";

import {
  DialogDemo,
  DropdownMenuDemo,
  ErrorStateDemo,
  PopoverDemo,
  SheetDemo,
  ToastDemo,
  TooltipDemo,
} from "./specimens";

// Developer component gallery — every @repo/ui component, rendered twice
// (light + dark, container-scoped via data-theme) for side-by-side review.
// Specimen literals are allowed here (documented eslint exception for
// app/design/**); this page ships no product copy.

function Specimen({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <p className="font-mono text-xs text-text-faint">{label}</p>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-text">{children}</h2>;
}

/**
 * The full specimen tree, rendered once per theme. `t` prefixes every DOM id
 * so the light and dark copies never collide.
 */
function ShowcasePanel({ t }: { t: "light" | "dark" }) {
  return (
    <div className="flex flex-col gap-8">
      <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
        {t} theme
      </p>

      {/* ——— Form controls ——— */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Form controls</SectionHeading>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Specimen label="button / variants" wide>
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Specimen>

          <Specimen label="button / sizes + icon-button">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button>
                <Send />
                With icon
              </Button>
              <IconButton aria-label="Add" variant="outline">
                <Plus className="size-4" />
              </IconButton>
            </div>
          </Specimen>

          <Specimen label="input + search-input">
            <div className="flex flex-col gap-3">
              <Input placeholder="Plain input" />
              <Input disabled placeholder="Disabled input" />
              <SearchInput aria-label="Search employees" placeholder="Search…" />
            </div>
          </Specimen>

          <Specimen label="field / help + error">
            <div className="flex flex-col gap-4">
              <Field
                label="Full name"
                htmlFor={`${t}-name`}
                help="As printed on the ID document."
              >
                <Input id={`${t}-name`} placeholder="Ana Silva" />
              </Field>
              <Field
                label="Email"
                htmlFor={`${t}-email`}
                error="This email is already in use."
              >
                <Input id={`${t}-email`} defaultValue="ana@example" />
              </Field>
            </div>
          </Specimen>

          <Specimen label="textarea">
            <Textarea placeholder="Reason for the request…" />
          </Specimen>

          <Specimen label="select (radix) + native-select">
            <div className="flex flex-col gap-3">
              <Select>
                <SelectTrigger aria-label="Country">
                  <SelectValue placeholder="Pick a country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Portugal</SelectItem>
                  <SelectItem value="es">Spain</SelectItem>
                  <SelectItem value="fr">France</SelectItem>
                </SelectContent>
              </Select>
              <NativeSelect aria-label="Locale" defaultValue="pt">
                <option value="pt">Português</option>
                <option value="en">English</option>
              </NativeSelect>
            </div>
          </Specimen>

          <Specimen label="checkbox / checked + unchecked">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Checkbox id={`${t}-cb-on`} defaultChecked />
                <Label htmlFor={`${t}-cb-on`}>Send weekly summary</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id={`${t}-cb-off`} />
                <Label htmlFor={`${t}-cb-off`}>Notify on mention</Label>
              </div>
            </div>
          </Specimen>

          <Specimen label="switch / checked + unchecked">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch id={`${t}-sw-on`} defaultChecked />
                <Label htmlFor={`${t}-sw-on`}>Two-factor required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id={`${t}-sw-off`} />
                <Label htmlFor={`${t}-sw-off`}>Marketing emails</Label>
              </div>
            </div>
          </Specimen>

          <Specimen label="radio-group / checked + unchecked">
            <RadioGroup defaultValue="full">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id={`${t}-rg-full`} />
                <Label htmlFor={`${t}-rg-full`}>Full day</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="half" id={`${t}-rg-half`} />
                <Label htmlFor={`${t}-rg-half`}>Half day</Label>
              </div>
            </RadioGroup>
          </Specimen>
        </div>
      </section>

      {/* ——— Overlays ——— */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Overlays</SectionHeading>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Specimen label="dialog">
            <DialogDemo />
          </Specimen>
          <Specimen label="sheet / bottom + right">
            <SheetDemo />
          </Specimen>
          <Specimen label="dropdown-menu">
            <DropdownMenuDemo />
          </Specimen>
          <Specimen label="popover">
            <PopoverDemo />
          </Specimen>
          <Specimen label="tooltip">
            <TooltipDemo />
          </Specimen>
          <Specimen label="toast (sonner)">
            <ToastDemo />
          </Specimen>
        </div>
      </section>

      {/* ——— Display ——— */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Display</SectionHeading>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Specimen label="badge / all variants" wide>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </Specimen>

          <Specimen label="avatar / image + fallback">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src="/icon-192.png" alt="App icon" />
                <AvatarFallback>AP</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>AS</AvatarFallback>
              </Avatar>
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">JM</AvatarFallback>
              </Avatar>
            </div>
          </Specimen>

          <Specimen label="spinner / sizes">
            <div className="flex items-center gap-4">
              <Spinner size="sm" label="Loading" />
              <Spinner label="Loading" />
              <Spinner size="lg" label="Loading" />
            </div>
          </Specimen>

          <Specimen label="skeleton">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          </Specimen>

          <Specimen label="progress / 64%">
            <Progress value={64} aria-label="Onboarding progress" />
          </Specimen>

          <Specimen label="accordion">
            <Accordion type="single" collapsible>
              <AccordionItem value="a">
                <AccordionTrigger>What counts as overtime?</AccordionTrigger>
                <AccordionContent>
                  Hours worked beyond the contracted schedule, subject to the
                  country rule pack.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Who approves absences?</AccordionTrigger>
                <AccordionContent>
                  The team manager, via the four-eyes approval workflow.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Specimen>

          <Specimen label="tabs / 2 panes">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <p className="text-sm text-text-muted">
                  Summary of the employee record, contracts and documents.
                </p>
              </TabsContent>
              <TabsContent value="history">
                <p className="text-sm text-text-muted">
                  Chronological audit trail of every change.
                </p>
              </TabsContent>
            </Tabs>
          </Specimen>

          <Specimen label="responsive-table / 3 rows" wide>
            <ResponsiveTable headers={["Employee", "Role", "Status"]}>
              <ResponsiveRow
                labels={["Employee", "Role", "Status"]}
                cells={[
                  "Ana Silva",
                  "HR Manager",
                  <Badge key="s" variant="success">
                    Active
                  </Badge>,
                ]}
              />
              <ResponsiveRow
                labels={["Employee", "Role", "Status"]}
                cells={[
                  "João Mendes",
                  "Accountant",
                  <Badge key="s" variant="warning">
                    On leave
                  </Badge>,
                ]}
              />
              <ResponsiveRow
                labels={["Employee", "Role", "Status"]}
                cells={[
                  "Marta Costa",
                  "Supervisor",
                  <Badge key="s" variant="outline">
                    Invited
                  </Badge>,
                ]}
              />
            </ResponsiveTable>
          </Specimen>

          <Specimen label="timeline / 3 items" wide>
            <Timeline>
              <TimelineItem
                title="Request submitted"
                timestamp="Mon 09:12"
                description="Annual leave, 3 days."
              />
              <TimelineItem
                title="Manager approved"
                timestamp="Mon 14:30"
                icon={<Check />}
                description="Approved by Marta Costa."
              />
              <TimelineItem
                title="Payroll notified"
                timestamp="Tue 08:00"
                last
              />
            </Timeline>
          </Specimen>
        </div>
      </section>

      {/* ——— Composed ——— */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Composed</SectionHeading>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Specimen label="page-header / back + action" wide>
            <PageHeader
              backHref="#"
              backLabel="Employees"
              title="Ana Silva"
              description="HR Manager · Lisbon team"
              action={
                <Button size="sm" variant="outline">
                  <Pencil />
                  Edit
                </Button>
              }
            />
          </Specimen>

          <Specimen label="list-item / static + link" wide>
            <div className="flex flex-col gap-3">
              <ListItem
                title="Annual leave request"
                subtitle="3 days · 12–14 Aug"
                meta={<Badge variant="warning">Pending</Badge>}
              />
              <ListItem
                href="#"
                title="Expense report #482"
                subtitle="Travel · €231.40"
                meta={<Badge variant="success">Approved</Badge>}
              />
            </div>
          </Specimen>

          <Specimen label="stat-card / states + trends" wide>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label="Headcount"
                value="128"
                trend="up"
                trendLabel="+4 this month"
              />
              <StatCard
                state="good"
                label="Retention"
                value="96%"
                trend="up"
                trendLabel="+1.2 pt"
                hint="Target ≥ 95%"
              />
              <StatCard
                state="warn"
                label="Open approvals"
                value="17"
                trend="flat"
                trendLabel="unchanged"
              />
              <StatCard
                state="bad"
                label="Overtime hours"
                value="342"
                trend="down"
                trendLabel="-8% vs May"
                hint="Above legal ceiling"
              />
            </div>
          </Specimen>

          <Specimen label="approval-banner / all 3 states" wide>
            <div className="flex flex-col gap-3">
              <ApprovalBanner
                status="pending"
                title="Salary change awaiting approval"
                actor="Requested by Ana Silva · 2h ago"
              >
                <Button size="sm">Approve</Button>
                <Button size="sm" variant="outline">
                  Reject
                </Button>
              </ApprovalBanner>
              <ApprovalBanner
                status="approved"
                title="Contract amendment approved"
                actor="Approved by João Mendes · yesterday"
              />
              <ApprovalBanner
                status="rejected"
                title="Expense report rejected"
                actor="Rejected by Marta Costa · 3d ago"
                reason="Missing receipt for line 2."
              />
            </div>
          </Specimen>

          <Specimen label="empty-state">
            <EmptyState
              icon={<Inbox />}
              title="No absence requests"
              description="Requests you submit will show up here."
              action={
                <Button size="sm">
                  <UserPlus />
                  New request
                </Button>
              }
            />
          </Specimen>

          <Specimen label="error-state / retry">
            <ErrorStateDemo />
          </Specimen>
        </div>
      </section>
    </div>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-2xl flex-col gap-8 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Component gallery</h1>
        <p className="text-sm text-text-muted">
          Every @repo/ui component, side by side in light and dark. Developer
          surface — not linked from the app shell.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div
          data-theme="light"
          className="bg-bg text-text rounded-lg border border-border p-4"
        >
          <ShowcasePanel t="light" />
        </div>
        <div
          data-theme="dark"
          className="bg-bg text-text rounded-lg border border-border p-4"
        >
          <ShowcasePanel t="dark" />
        </div>
      </div>

      {/* Portaled overlays and toasts escape the themed containers and follow
          the real page theme — expected for this gallery. */}
      <Toaster containerAriaLabel="Notifications" />
    </main>
  );
}
