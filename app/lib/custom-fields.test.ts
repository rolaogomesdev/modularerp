import { describe, expect, it } from "vitest";

import {
  buildCustomSchema,
  fieldLabel,
  type CustomFieldDef,
} from "./custom-fields";

function def(partial: Partial<CustomFieldDef>): CustomFieldDef {
  return {
    id: "1",
    entity: "hr_employees",
    key: "field",
    label: { en: "Field", "pt-PT": "Campo" },
    type: "text",
    config: {},
    position: 0,
    archived_at: null,
    ...partial,
  };
}

describe("fieldLabel", () => {
  it("resolves locale, falls back to en, then key", () => {
    const d = def({ label: { en: "Cost", "pt-PT": "Custo" } });
    expect(fieldLabel(d, "pt-PT")).toBe("Custo");
    expect(fieldLabel(d, "en")).toBe("Cost");
    expect(fieldLabel(def({ label: { en: "Only EN" } }), "pt-PT")).toBe("Only EN");
    expect(fieldLabel(def({ label: {}, key: "raw_key" }), "en")).toBe("raw_key");
  });
});

describe("buildCustomSchema", () => {
  it("validates required and typed fields, ignoring archived ones", () => {
    const schema = buildCustomSchema([
      def({ key: "cost", type: "number", config: { required: true, min: 0, max: 100 } }),
      def({ key: "note", type: "text", config: {} }),
      def({ key: "dead", type: "text", config: { required: true }, archived_at: "2026-01-01" }),
    ]);

    expect(schema.safeParse({ cost: 50 }).success).toBe(true);
    expect(schema.safeParse({ cost: 150 }).success).toBe(false); // over max
    expect(schema.safeParse({ note: "hi" }).success).toBe(false); // cost required
    // archived field is not required and is stripped
    const ok = schema.safeParse({ cost: 1, dead: "whatever" });
    expect(ok.success).toBe(true);
    if (ok.success) expect("dead" in ok.data).toBe(false);
  });

  it("enforces select options and multi_select arrays", () => {
    const options = [
      { value: "a", label: { en: "A" } },
      { value: "b", label: { en: "B" } },
    ];
    const schema = buildCustomSchema([
      def({ key: "pick", type: "select", config: { required: true, options } }),
      def({ key: "tags", type: "multi_select", config: { options } }),
    ]);
    expect(schema.safeParse({ pick: "a" }).success).toBe(true);
    expect(schema.safeParse({ pick: "z" }).success).toBe(false);
    expect(schema.safeParse({ pick: "a", tags: ["a", "b"] }).success).toBe(true);
    expect(schema.safeParse({ pick: "a", tags: ["a", "z"] }).success).toBe(false);
  });
});
