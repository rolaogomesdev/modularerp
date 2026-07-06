import { getTranslations } from "next-intl/server";
import { Button } from "@repo/ui";

// TODO(phase-0): replace with auth-aware shell.
// This page doubles as a token smoke test until the design-system stories exist (Phase 2).
export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-text-muted">{t("description")}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-1">
        <div className="flex flex-wrap gap-2">
          <Button>{t("buttons.primary")}</Button>
          <Button variant="secondary">{t("buttons.secondary")}</Button>
          <Button variant="outline">{t("buttons.outline")}</Button>
          <Button variant="destructive">{t("buttons.destructive")}</Button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-success-bg px-3 py-1 text-success">
            {t("badges.success")}
          </span>
          <span className="rounded-full bg-warning-bg px-3 py-1 text-warning">
            {t("badges.warning")}
          </span>
          <span className="rounded-full bg-danger-bg px-3 py-1 text-danger">
            {t("badges.danger")}
          </span>
          <span className="rounded-full bg-info-bg px-3 py-1 text-info">
            {t("badges.info")}
          </span>
        </div>
      </section>
    </main>
  );
}
