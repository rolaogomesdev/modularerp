import { z } from "zod";

export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "boolean",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** The entities modules may attach custom fields to (they register their own). */
export const CUSTOMIZABLE_ENTITIES = [
  "hr_employees",
  "hr_absences",
  "finance_invoices",
  "finance_expenses",
] as const;

export type CustomFieldOption = { value: string; label: Record<string, string> };

export type CustomFieldConfig = {
  required?: boolean;
  options?: CustomFieldOption[];
  min?: number;
  max?: number;
};

export type CustomFieldDef = {
  id: string;
  entity: string;
  key: string;
  label: Record<string, string>;
  type: CustomFieldType;
  config: CustomFieldConfig;
  position: number;
  archived_at: string | null;
};

/** Localized label with graceful fallback (locale → en → key). */
export function fieldLabel(def: Pick<CustomFieldDef, "label" | "key">, locale: string): string {
  return def.label[locale] ?? def.label.en ?? Object.values(def.label)[0] ?? def.key;
}

function schemaForField(def: CustomFieldDef): z.ZodTypeAny {
  const required = def.config.required === true;
  let base: z.ZodTypeAny;
  switch (def.type) {
    case "number": {
      let n = z.number();
      if (typeof def.config.min === "number") n = n.min(def.config.min);
      if (typeof def.config.max === "number") n = n.max(def.config.max);
      base = n;
      break;
    }
    case "boolean":
      base = z.boolean();
      break;
    case "date":
      base = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
      break;
    case "select": {
      const values = (def.config.options ?? []).map((o) => o.value);
      base = values.length ? z.enum(values as [string, ...string[]]) : z.string();
      break;
    }
    case "multi_select": {
      const values = (def.config.options ?? []).map((o) => o.value);
      base = z.array(values.length ? z.enum(values as [string, ...string[]]) : z.string());
      break;
    }
    case "text":
    default:
      base = z.string().max(2000);
      break;
  }
  return required ? base : base.optional().nullable();
}

/**
 * Build a runtime validator for an entity's `custom` jsonb from its active
 * field defs. Modules call this in their server actions so custom values are
 * validated exactly like first-class columns — with zero per-field code.
 */
export function buildCustomSchema(defs: CustomFieldDef[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const def of defs) {
    if (def.archived_at) continue;
    shape[def.key] = schemaForField(def);
  }
  return z.object(shape).strip();
}
