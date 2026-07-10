import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui";
import { Search } from "lucide-react";

// Stub: global search + assistant entry point (06-ai-platform.md).
export default async function SearchPage() {
  const t = await getTranslations("shell.stubs");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <EmptyState
        icon={<Search aria-hidden />}
        title={t("searchTitle")}
        description={t("searchBody")}
      />
    </main>
  );
}
