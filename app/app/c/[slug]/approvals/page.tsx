import { getTranslations } from "next-intl/server";
import { EmptyState } from "@repo/ui";
import { CheckCheck } from "lucide-react";

// Stub: the approvals primitive's inbox lands here (05-data-platform.md).
export default async function ApprovalsPage() {
  const t = await getTranslations("shell.stubs");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <EmptyState
        icon={<CheckCheck aria-hidden />}
        title={t("approvalsTitle")}
        description={t("approvalsBody")}
      />
    </main>
  );
}
