export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function col(header: string[], names: string[]): number {
  for (const name of names) {
    const i = header.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

export type CsvProductRow = {
  name: string;
  barcode: string | null;
  cost: number;
  selling: number;
  stock: number;
  min_stock: number;
  category: string | null;
};

export function parseProductCsv(text: string): { rows: CsvProductRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], errors: ["Empty CSV file"] };

  const header = table[0]!.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const hasHeader =
    col(header, ["name", "product", "item"]) >= 0 || col(header, ["barcode", "sku"]) >= 0;
  const body = hasHeader ? table.slice(1) : table;
  const nameI = hasHeader ? Math.max(0, col(header, ["name", "product", "item"])) : 0;
  const barcodeI = hasHeader ? col(header, ["barcode", "sku", "code"]) : 1;
  const costI = hasHeader ? col(header, ["cost", "cost_price"]) : 2;
  const sellingI = hasHeader ? col(header, ["selling", "price", "sell", "selling_price"]) : 3;
  const stockI = hasHeader ? col(header, ["stock", "qty", "quantity"]) : 4;
  const minI = hasHeader ? col(header, ["min_stock", "min", "reorder"]) : 5;
  const catI = hasHeader ? col(header, ["category"]) : 6;

  const rows: CsvProductRow[] = [];
  const errors: string[] = [];
  body.forEach((line, idx) => {
    const name = (line[nameI] ?? "").trim();
    if (!name) {
      errors.push(`Row ${idx + (hasHeader ? 2 : 1)}: missing name`);
      return;
    }
    rows.push({
      name,
      barcode: barcodeI >= 0 ? (line[barcodeI] || "").trim() || null : null,
      cost: costI >= 0 ? Number(line[costI]) || 0 : 0,
      selling: sellingI >= 0 ? Number(line[sellingI]) || 0 : 0,
      stock: stockI >= 0 ? Number(line[stockI]) || 0 : 0,
      min_stock: minI >= 0 ? Number(line[minI]) || 5 : 5,
      category: catI >= 0 ? (line[catI] || "").trim() || null : null,
    });
  });
  return { rows, errors };
}
