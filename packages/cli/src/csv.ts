import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Cell = string | number | bigint | boolean | undefined;

export function csvLine(cells: readonly Cell[]): string {
  return cells
    .map((cell) => {
      if (cell === undefined) return "";
      const text = String(cell);
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    })
    .join(",");
}

/** Appends one row, writing the header first if the file is new. */
export function appendRow(file: string, header: readonly string[], row: readonly Cell[]): void {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, csvLine(header) + "\n");
  }
  appendFileSync(file, csvLine(row) + "\n");
}
