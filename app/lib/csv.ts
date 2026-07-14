// RFC 4180 CSV serialisation. Pure and dependency-free so it can be unit
// tested and reused by any module that needs an export. The HTTP layer is
// responsible for the download headers and (for spreadsheet apps) a UTF-8 BOM.

export type CsvCell = string | number | boolean | null | undefined;

export type CsvColumn<T> = {
  /** Column header, already localised by the caller. */
  header: string;
  /** Extracts the cell value for a row. */
  value: (row: T) => CsvCell;
};

// A field must be quoted when it contains a comma, a quote, or a line break.
// Quotes inside a quoted field are escaped by doubling them (RFC 4180 §2.7).
function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const text = typeof cell === "string" ? cell : String(cell);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serialises rows to an RFC 4180 CSV string with a header row. Records are
 * terminated with CRLF, the interoperable line ending for CSV.
 */
export function toCsv<T>(
  columns: readonly CsvColumn<T>[],
  rows: readonly T[]
): string {
  const lines = [columns.map((column) => escapeCell(column.header))];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))));
  }
  return lines.map((cells) => cells.join(",")).join("\r\n");
}
