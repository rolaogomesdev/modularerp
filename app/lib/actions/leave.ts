"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buildCustomSchema,
  collectCustomValues,
  type CustomFieldDef,
} from "@/lib/custom-fields";
import { LEAVE_CUSTOM_ENTITY, LEAVE_TYPES } from "@/lib/leave";
import { createClient } from "@/lib/supabase/server";

export type LeaveActionState = { errorKey: string } | null;

function errorKey(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "notAllowed";
    case "23514":
      return "invalidInput";
    default:
      return "unknown";
  }
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const submitSchema = z.object({
  companyId: z.string().uuid(),
  companySlug: z.string().min(1).max(40),
  leaveType: z.enum(LEAVE_TYPES),
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().trim().max(2000).optional(),
});

export async function submitLeaveRequest(
  _prev: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  const parsed = submitSchema.safeParse({
    companyId: formData.get("companyId"),
    companySlug: formData.get("companySlug"),
    leaveType: formData.get("leaveType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return { errorKey: "invalidInput" };
  const d = parsed.data;
  if (d.endDate < d.startDate) return { errorKey: "invalidInput" };

  const supabase = await createClient();

  // Custom fields validate exactly like first-class columns — zero per-field code.
  const { data: defsData } = await supabase
    .from("custom_field_defs")
    .select("id, entity, key, label, type, config, position, archived_at")
    .eq("company_id", d.companyId)
    .eq("entity", LEAVE_CUSTOM_ENTITY)
    .is("archived_at", null)
    .order("position");
  const defs = (defsData ?? []) as CustomFieldDef[];

  const custom = buildCustomSchema(defs).safeParse(collectCustomValues(formData, defs));
  if (!custom.success) return { errorKey: "invalidInput" };

  const { error } = await supabase.rpc("submit_leave_request", {
    target_company: d.companyId,
    leave_type: d.leaveType,
    start_date: d.startDate,
    end_date: d.endDate,
    reason: d.reason || null,
    custom: custom.data,
  });
  if (error) return { errorKey: errorKey(error.code) };

  redirect(`/c/${d.companySlug}/hr/leave`);
}
