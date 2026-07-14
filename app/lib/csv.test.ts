import { describe, expect, it } from "vitest";

import { toCsv, type CsvColumn } from "./csv";

type Row = { name: string; age: number; note: CsvColumnNote };
type CsvColumnNote = string | null | undefined;

const columns: CsvColumn<Row>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Age", value: (r) => r.age },
  { header: "Note", value: (r) => r.note },
];

describe("toCsv", () => {
  it("writes a header row even with no data", () => {
    expect(toCsv(columns, [])).toBe("Name,Age,Note");
  });

  it("joins records with CRLF and coerces non-strings", () => {
    const csv = toCsv(columns, [{ name: "Ana", age: 30, note: "ok" }]);
    expect(csv).toBe("Name,Age,Note\r\nAna,30,ok");
  });

  it("quotes fields containing commas, quotes or newlines", () => {
    const csv = toCsv(columns, [
      { name: "Silva, Ana", age: 1, note: 'says "hi"' },
      { name: "line\nbreak", age: 2, note: null },
    ]);
    expect(csv).toBe(
      'Name,Age,Note\r\n"Silva, Ana",1,"says ""hi"""\r\n"line\nbreak",2,'
    );
  });

  it("renders null and undefined as empty fields", () => {
    const csv = toCsv(columns, [{ name: "", age: 0, note: undefined }]);
    expect(csv).toBe("Name,Age,Note\r\n,0,");
  });
});
