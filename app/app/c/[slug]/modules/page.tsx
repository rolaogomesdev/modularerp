import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui";
import { LayoutGrid } from "lucide-react";

// Stub: the module registry mounts here from Phase 3 on (04-module-system.md).
export default async function ModulesPage() {
  const t = await getTranslations("shell.stubs");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <EmptyState
        icon={<LayoutGrid aria-hidden />}
        title={t("modulesTitle")}
        description={t("modulesBody")}
      />
    </main>
  );
}
