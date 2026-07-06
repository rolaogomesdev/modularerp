# 08 — Mobile UX & PWA

The phone is the primary device. Every screen is designed at **390 px first**; desktop is a progressive enhancement (wider layouts, more columns — same components, same patterns, per [09-design-system.md](09-design-system.md)).

## PWA

- **Installable**: web manifest (name, theme colors for light/dark, maskable icons); in-app "add to home screen" hint after second visit.
- **Service worker (Serwist)**: precache shell + design system assets; runtime cache for read data (below); web push later (parking lot — start with in-app inbox + email).
- **Device features used**: camera (`capture` input) for document intake ([06-ai-platform.md](06-ai-platform.md)); share target for receiving PDFs/photos into Finance intake (later); biometric re-auth via WebAuthn as a 2FA factor upgrade (parking lot).

## Performance budgets (CI-watched via Vercel Analytics)

| Metric | Budget | Notes |
|---|---|---|
| LCP | < 2.5 s | mid-range Android over 4G, cold |
| INP | < 200 ms | |
| First-load JS | < 200 kB per route | Server Components keep module screens mostly HTML |
| Any list screen | usable at 3G with skeletons | pagination default 25, infinite scroll |

## Offline strategy — deliberate and narrow

Full offline ERP is a trap (conflicts, stale permissions). We do **offline-tolerant**, not offline-first, and only where mobile reality demands it:

- **Reads, everywhere**: TanStack Query cache persisted to IndexedDB — last-seen data renders instantly with a "viewing offline data from HH:MM" banner; refetch on reconnect.
- **Writes, flagged flows only** (each flow opts in via the module registry): shop-floor work-order actions (Production), absence requests, expense capture (photo queues, uploads later). Queued mutations carry an **idempotency key**, execute through the normal server actions on reconnect (RLS + audit + events all apply), and surface per-item success/failure in the inbox. Conflict policy: **server wins**, user notified with a retry affordance.
- Never offline: anything approval-, permission-, or money-moving beyond capture.

## Navigation shell

```
┌──────────────────────────────┐
│ ◱ Company ▾        🔔  👤   │   top bar: company switcher, notifications, profile
│                              │
│         (screen)             │
│                              │
├──────────────────────────────┤
│  ⌂      ▦      ✓      ⌕     │   bottom tabs: Home · Modules · Approvals · Search
└──────────────────────────────┘
```

- **Home**: personal dashboard — my pending items, my team today, pinned reports.
- **Modules**: grid of enabled modules (permission-gated) → module inner navigation is segmented tabs/lists, never deeper than 3 levels.
- **Approvals**: the cross-module approval inbox (platform primitive) — badge count via Realtime.
- **Search**: global, across `searchables` registered by modules + manual/help; the AI assistant lives here too (ask instead of search).
- Desktop: bottom tabs become a left sidebar; content gains columns. Same components.
- The **AI assistant** is reachable from every screen (FAB on mobile, ⌘K on desktop) and can deep-link ("take me to pending absences") using the manual's `path` metadata.

## Mobile interaction rules

- Touch targets ≥ 44 px; primary action reachable by thumb (bottom sheet forms, sticky action bar).
- Forms: one column, native input types, inline validation, autosave drafts for long forms (offline-safe).
- Lists: pull-to-refresh; swipe actions only as shortcuts to visible actions (never the only path — accessibility).
- Tables collapse to card lists on mobile (design-system `ResponsiveTable`).
- Document capture flow is ≤ 3 taps: FAB → camera → confirm.
- Respect safe areas (notches), `prefers-reduced-motion`, and both themes at every review.

## Accessibility

WCAG 2.2 AA: contrast verified in **both themes** (token pipeline checks — [09](09-design-system.md)); full keyboard/screen-reader paths on desktop; focus management in sheets/dialogs (shadcn/radix gives most of it); `lang` per locale; no color-only meaning (badges pair icon + label).

## Testing

- Playwright mobile viewport (390×844) is the default for e2e smoke flows (login+2FA, switch company, request absence, approve absence, capture document).
- Visual regression on design-system components in both themes (Playwright screenshots) — Phase 2.
- Real-device sanity pass (one Android mid-range, one iPhone) before each phase exit.
