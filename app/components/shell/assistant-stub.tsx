"use client";

import { useTranslations } from "next-intl";
import {
  AssistantLauncher,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";

/** Stub until Phase 5 — the launcher's position and affordance are the contract. */
export function AssistantStub() {
  const t = useTranslations("shell.assistant");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <AssistantLauncher aria-label={t("open")} />
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
