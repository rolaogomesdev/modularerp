"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ApprovalActionState = { errorKey: string } | { ok: true } | null;

function approvalErrorKey(code: string | undefined): string {
  switch (code) {
    case "PT002":
      return "selfApproval";
    case "42501":
      return "notAllowed";
    case "P0002":
      return "gone";
    default:
      return "unknown";
  }
}

const decideSchema = z.object({
  approvalId: z.string().uuid(),
  companySlug: z.string().min(1).max(40),
  approve: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

export async function decideApproval(
  _prev: ApprovalActionState,
  formData: FormData
): Promise<ApprovalActionState> {
  const parsed = decideSchema.safeParse({
    approvalId: formData.get("approvalId"),
    companySlug: formData.get("companySlug"),
    approve: formData.get("approve"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_approval", {
    approval_id: parsed.data.approvalId,
    approve: parsed.data.approve === "approve",
    reason: parsed.data.reason ?? null,
  });
  if (error) return { errorKey: approvalErrorKey(error.code) };

  revalidatePath(`/c/${parsed.data.companySlug}/approvals`);
  return { ok: true };
}

export async function cancelApproval(
  _prev: ApprovalActionState,
  formData: FormData
): Promise<ApprovalActionState> {
  const parsed = z
    .object({ approvalId: z.string().uuid(), companySlug: z.string().min(1).max(40) })
    .safeParse({
      approvalId: formData.get("approvalId"),
      companySlug: formData.get("companySlug"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_approval", {
    approval_id: parsed.data.approvalId,
  });
  if (error) return { errorKey: approvalErrorKey(error.code) };

  revalidatePath(`/c/${parsed.data.companySlug}/approvals`);
  return { ok: true };
}
