import { Button } from "@repo/ui";

// TODO(phase-0): replace with auth-aware shell; strings move to next-intl catalogs when wired.
// This page doubles as a token smoke test until the design-system stories exist (Phase 2).
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Shell under construction</h1>
        <p className="text-sm text-text-muted">
          Design tokens are live — this page renders in light and dark from the
          same semantic variables.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-success-bg px-3 py-1 text-success">
            Success
          </span>
          <span className="rounded-full bg-warning-bg px-3 py-1 text-warning">
            Warning
          </span>
          <span className="rounded-full bg-danger-bg px-3 py-1 text-danger">
            Danger
          </span>
          <span className="rounded-full bg-info-bg px-3 py-1 text-info">
            Info
          </span>
        </div>
      </section>
    </main>
  );
}
