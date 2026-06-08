import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExternalSaleInput {
  product_name: string;
  cost_price:   number;
  sale_price:   number;
  note:         string | null;
}

export interface ExternalSale {
  id:           string;
  product_name: string;
  cost_price:   number;
  sale_price:   number;
  note:         string | null;
  created_by:   string | null;
  sold_at:      string;
}

interface RawExternalSaleRow {
  id:           string;
  product_name: string;
  cost_price:   number;
  sale_price:   number;
  note:         string | null;
  created_by:   string | null;
  sold_at:      string;
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createExternalSale(
  input:     ExternalSaleInput,
  createdBy: string,
): Promise<void> {
  const { error } = await supabase.from("external_sales").insert({
    product_name: input.product_name.trim(),
    cost_price:   input.cost_price,
    sale_price:   input.sale_price,
    note:         input.note || null,
    created_by:   createdBy,
  });
  if (error) throw new Error(error.message);
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getExternalSalesLog(): Promise<ExternalSale[]> {
  const { data, error } = await supabase
    .from("external_sales")
    .select("id, product_name, cost_price, sale_price, note, created_by, sold_at")
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as RawExternalSaleRow[]).map((row) => ({
    id:           row.id,
    product_name: row.product_name,
    cost_price:   row.cost_price,
    sale_price:   row.sale_price,
    note:         row.note     ?? null,
    created_by:   row.created_by ?? null,
    sold_at:      row.sold_at,
  }));
}
