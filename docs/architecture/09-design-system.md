# 09 — Design system (the persistent UX/UI contract)

One design system, everywhere: every screen in every module is composed **exclusively** from `packages/ui` tokens, components and screen patterns. A user who learns one module has learned them all. A screen that bypasses the system fails review — no exceptions, no "just this once".

## Design tokens (single source of truth)

Semantic CSS variables, mapped into Tailwind's theme; **no raw colors, sizes or shadows anywhere in module code** (lint-enforced):

```
Color (semantic, theme-resolved)
  --bg, --surface, --surface-raised, --border, --border-strong
  --text, --text-muted, --text-faint
  --accent, --accent-fg, --accent-muted          ← company-brandable
  --success, --warning, --danger, --info (+ -bg variants)
  --focus-ring
Typography   --font-sans; scale: 12/14/16(base)/18/20/24/30; line-heights paired
Spacing      4-pt scale (4…64) — components use steps, never arbitrary px
Radius       --radius-sm 6, --radius-md 10, --radius-lg 16, --radius-full
Elevation    --shadow-1..3 (theme-aware — shadows lighten, borders strengthen in dark)
Motion       --dur-fast 150ms, --dur-base 250ms; ease-out enter, ease-in exit
             all animation respects prefers-reduced-motion
```

## Themes

- **Light + dark ship together** (ADR-0001): two values per token, resolved by `data-theme` on `<html>`. Default = `system` (device preference); per-user override in the personal profile ([02](02-tenancy-and-identity.md)).
- Every component and every screen is reviewed in **both** themes; visual-regression snapshots run both ([08](08-mobile-ux.md)).
- **Company branding without chaos**: a company may set logo + accent color ([02](02-tenancy-and-identity.md) `companies.brand`). Only `--accent*` tokens change; the accent is contrast-checked against both themes at save time (auto-adjusted shade if it fails, admin informed). Branding can never restyle components, change layout or reduce contrast.

## Component inventory (`packages/ui`)

Built on shadcn/ui + Radix, owned by us, themed by tokens:

- **Primitives**: Button, IconButton, Input, Textarea, Select, Combobox, DatePicker, Checkbox, Switch, RadioGroup, Badge, Avatar, Tooltip, Tabs, Accordion, Toast, Skeleton, Spinner, ProgressBar.
- **Overlay**: Sheet (bottom on mobile / side on desktop — the default form container), Dialog (confirmations only), Popover, DropdownMenu.
- **Composed (the ERP vocabulary)**: PageHeader (title + primary action + overflow), FilterBar (chips + sheet), SearchInput, ResponsiveTable (table → card list at mobile), ListItem, StatCard, EmptyState (icon + message + action), ErrorState (retry), FormField (label + control + error + help), ApprovalBanner (pending/approved/rejected + actor + reason), AuditTrail, PermissionGate (renders children or nothing — the UX pre-check), MoneyInput, FileDrop/CameraCapture, Timeline, chart components (used by dashboards *and* the AI's `render_chart` — [06](06-ai-platform.md)).
- **Shell**: TopBar (company switcher, notifications, profile), BottomNav/Sidebar, AssistantLauncher (FAB / ⌘K), OfflineBanner.

Adding a component = PR to `packages/ui` with both-theme stories + a11y notes — never a local one-off in a module.

## Standard screen patterns (modules assemble, never invent)

1. **ListPage** — PageHeader → FilterBar → ResponsiveTable/cards → pagination; states: skeleton, empty (with CTA), error (retry); primary action top-right (desktop) / sticky bottom (mobile).
2. **DetailPage** — PageHeader (entity + status Badge) → key-value sections → related lists (tabs) → AuditTrail at the bottom; actions in header overflow, destructive ones confirm via Dialog.
3. **FormSheet** — create/edit in a Sheet over the list (context preserved); one column; inline validation on blur; sticky submit; unsaved-changes guard; autosave drafts on long forms.
4. **Wizard** — numbered steps, progress, per-step validation (onboarding, imports).
5. **Dashboard** — StatCards row → chart grid (design-system charts only) → "attention" list (pending approvals, alerts).
6. **ApprovalFlow** — anything requiring approval renders the same ApprovalBanner + Approvals-inbox entry ([05](05-data-platform.md) primitive).

Every pattern defines its loading/empty/error/offline states once — modules inherit them.

## Voice & microcopy

- PT (`pt-PT`) is the primary voice: professional, direct, **"você"-neutral** phrasing (imperative verbs, no "tu"); EN mirrors it. All strings through `packages/i18n` (lint blocks literals).
- Errors say what happened + what to do next; empty states teach the feature; dates/numbers/currency localized (EUR default).
- Permissions language: "You need the *Approve absences* permission — ask your administrator" (name the permission, never a bare "forbidden"; matches the help assistant's behaviour — [06](06-ai-platform.md)).

## Enforcement (what makes it *persistent*)

1. **Lint**: no hex/rgb/arbitrary Tailwind color values outside `packages/ui`; no `style=` in modules; imports from `modules/*/ui` may not reach `@radix-ui`/`tailwind` primitives directly — only `packages/ui`.
2. **Review checklist** (module DoD, [04](04-module-system.md)): 390 px, both themes, all four states, touch targets, i18n, PermissionGate on gated actions.
3. **Visual regression** on `packages/ui` stories in both themes (Phase 2 on).
4. **Component-first rule**: needing something new? Extend `packages/ui` (PR + stories), then use it. The system grows; screens never fork.
