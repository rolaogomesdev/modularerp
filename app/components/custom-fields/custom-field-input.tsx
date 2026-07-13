"use client";

import { useLocale } from "next-intl";
import { Checkbox, Field, Input, NativeSelect, Switch } from "@repo/ui";

import { fieldLabel, type CustomFieldDef } from "@/lib/custom-fields";

/**
 * Renders a single custom field's control, named `cf_<key>` so a module's
 * server action can collect all custom values generically. This is the
 * "appears in forms without code" machinery from 05-data-platform.md.
 */
export function CustomFieldInput({
  def,
  defaultValue,
}: {
  def: CustomFieldDef;
  defaultValue?: unknown;
}) {
  const locale = useLocale();
  const label = fieldLabel(def, locale);
  const name = `cf_${def.key}`;
  const id = `cf-${def.key}`;
  const required = def.config.required === true;
  const options = def.config.options ?? [];

  if (def.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        <Switch id={id} name={name} defaultChecked={defaultValue === true} />
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <Field label={label} htmlFor={id}>
        <NativeSelect
          id={id}
          name={name}
          required={required}
          defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
        >
          <option value="" />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label[locale] ?? o.label.en ?? o.value}
            </option>
          ))}
        </NativeSelect>
      </Field>
    );
  }

  if (def.type === "multi_select") {
    const selected = Array.isArray(defaultValue) ? (defaultValue as string[]) : [];
    return (
      <Field label={label} htmlFor={id}>
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                name={name}
                value={o.value}
                defaultChecked={selected.includes(o.value)}
              />
              {o.label[locale] ?? o.label.en ?? o.value}
            </label>
          ))}
        </div>
      </Field>
    );
  }

  const inputType =
    def.type === "number" ? "number" : def.type === "date" ? "date" : "text";
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name={name}
        type={inputType}
        required={required}
        min={def.config.min}
        max={def.config.max}
        defaultValue={
          typeof defaultValue === "string" || typeof defaultValue === "number"
            ? String(defaultValue)
            : ""
        }
      />
    </Field>
  );
}

/** Renders all active defs for an entity — a drop-in form section. */
export function CustomFieldsSection({
  defs,
  values,
}: {
  defs: CustomFieldDef[];
  values?: Record<string, unknown>;
}) {
  const active = defs.filter((d) => !d.archived_at).sort((a, b) => a.position - b.position);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {active.map((def) => (
        <CustomFieldInput key={def.id} def={def} defaultValue={values?.[def.key]} />
      ))}
    </div>
  );
}
