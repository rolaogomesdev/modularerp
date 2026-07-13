"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CUSTOM_FIELD_TYPES, CUSTOMIZABLE_ENTITIES } from "@/lib/custom-fields";
import { createClient } from "@/lib/supabase/server";

export type FieldActionState = { errorKey: string } | { ok: true } | null;

function errorKey(code: string | undefined): string {
  switch (code) {
    case "23505":
      return "duplicate";
    case "42501":
      return "notAllowed";
    default:
      return "unknown";
  }
}

const createSchema = z.object({
  companyId: z.string().uuid(),
  companySlug: z.string().min(1).max(40),
  entity: z.enum(CUSTOMIZABLE_ENTITIES),
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40),
  labelEn: z.string().trim().min(1).max(60),
  labelPt: z.string().trim().min(1).max(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  required: z.enum(["on"]).optional(),
  options: z.string().trim().max(500).optional(),
});

async function audit(
  companyId: string,
  action: string,
  entityId: string | null,
  after: unknown
) {
  const supabase = await createClient();
  await supabase.rpc("log_audit", {
    target_company_id: companyId,
    audit_action: action,
    audit_entity: "custom_field_defs",
    audit_entity_id: entityId,
    entry_after: after ?? undefined,
  });
}

export async function createCustomField(
  _prev: FieldActionState,
  formData: FormData
): Promise<FieldActionState> {
  const parsed = createSchema.safeParse({
    companyId: formData.get("companyId"),
    companySlug: formData.get("companySlug"),
    entity: formData.get("entity"),
    key: formData.get("key"),
    labelEn: formData.get("labelEn"),
    labelPt: formData.get("labelPt"),
    type: formData.get("type"),
    required: formData.get("required") ?? undefined,
    options: formData.get("options") ?? undefined,
  });
  if (!parsed.success) return { errorKey: "invalidInput" };
  const d = parsed.data;

  const config: Record<string, unknown> = { required: d.required === "on" };
  if ((d.type === "select" || d.type === "multi_select") && d.options) {
    const opts = d.options
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((value) => ({ value: value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"), label: { en: value, "pt-PT": value } }));
    if (opts.length === 0) return { errorKey: "invalidInput" };
    config.options = opts;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_field_defs")
    .insert({
      company_id: d.companyId,
      entity: d.entity,
      key: d.key,
      label: { en: d.labelEn, "pt-PT": d.labelPt },
      type: d.type,
      config,
    })
    .select("id")
    .single();
  if (error || !data) return { errorKey: errorKey(error?.code) };

  await audit(d.companyId, "customfield.create", data.id, { entity: d.entity, key: d.key, type: d.type });
  revalidatePath(`/c/${d.companySlug}/settings/fields`);
  return { ok: true };
}

export async function setCustomFieldArchived(
  _prev: FieldActionState,
  formData: FormData
): Promise<FieldActionState> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      companySlug: z.string().min(1).max(40),
      archived: z.enum(["true", "false"]),
    })
    .safeParse({
      id: formData.get("id"),
      companyId: formData.get("companyId"),
      companySlug: formData.get("companySlug"),
      archived: formData.get("archived"),
    });
  if (!parsed.success) return { errorKey: "invalidInput" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("custom_field_defs")
    .update(
      { archived_at: parsed.data.archived === "true" ? new Date().toISOString() : null },
      { count: "exact" }
    )
    .eq("id", parsed.data.id);
  if (error) return { errorKey: errorKey(error.code) };
  if (!count) return { errorKey: "notAllowed" };

  await audit(
    parsed.data.companyId,
    parsed.data.archived === "true" ? "customfield.archive" : "customfield.restore",
    parsed.data.id,
    null
  );
  revalidatePath(`/c/${parsed.data.companySlug}/settings/fields`);
  return { ok: true };
}
