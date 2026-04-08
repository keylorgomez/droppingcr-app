import { supabase } from "../lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SaleInput {
  product_id:      string;
  variant_id:      string;
  quantity:        number;
  sale_price:      number;
  note:            string | null;
  guest_name:      string | null;
  guest_phone:     string | null;
  status:          "completed" | "pending";
  initial_payment: number;
}

export interface Payment {
  id:      string;
  amount:  number;
  note:    string | null;
  paid_at: string;
}

export interface PendingSale {
  id:           string;
  sale_price:   number;
  guest_name:   string | null;
  guest_phone:  string | null;
  note:         string | null;
  sold_at:      string;
  product_name: string;
  variant_size: string;
  total_paid:   number;
  remaining:    number;
  payments:     Payment[];
}

// Grouped view: one entry per client (grouped by phone, then name)
export interface ClientDebt {
  key:         string;       // grouping key used internally
  guest_name:  string | null;
  guest_phone: string | null;
  sales:       PendingSale[]; // sorted oldest → newest
  total_sale:  number;        // sum of sale_price across pending sales
  total_paid:  number;        // sum of all payments
  remaining:   number;        // total_sale - total_paid
}

// ── Record manual sale ─────────────────────────────────────────────────────

export async function recordManualSale(data: SaleInput): Promise<void> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("price_purchase")
    .eq("id", data.product_id)
    .single();

  if (productError) throw new Error(productError.message);

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      product_id:  data.product_id,
      variant_id:  data.variant_id,
      quantity:    data.quantity,
      sale_price:  data.sale_price,
      cost_price:  product.price_purchase,
      guest_name:  data.guest_name,
      guest_phone: data.guest_phone,
      status:      data.status,
      note:        data.note,
    })
    .select("id")
    .single();

  if (saleError) throw new Error(saleError.message);

  const { error: stockError } = await supabase.rpc("decrement_variant_stock", {
    p_variant_id: data.variant_id,
    p_amount:     data.quantity,
  });

  if (stockError) throw new Error(stockError.message);

  if (data.initial_payment > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  data.initial_payment,
      note:    data.status === "pending" ? "Abono inicial" : "Pago completo",
    });
    if (payError) throw new Error(payError.message);
  }
}

// ── Get pending sales (raw) ────────────────────────────────────────────────

export async function getPendingSales(): Promise<PendingSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sale_price, guest_name, guest_phone, note, sold_at,
      product_variants ( size, products ( name ) ),
      payments ( id, amount, note, paid_at )
    `)
    .eq("status", "pending")
    .order("sold_at", { ascending: true }); // oldest first for distribution

  if (error) throw new Error(error.message);

  return (data ?? []).map((s: any) => {
    const totalPaid = (s.payments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + p.amount, 0
    );
    return {
      id:           s.id,
      sale_price:   s.sale_price,
      guest_name:   s.guest_name,
      guest_phone:  s.guest_phone,
      note:         s.note,
      sold_at:      s.sold_at,
      product_name: s.product_variants?.products?.name ?? "—",
      variant_size: s.product_variants?.size ?? "—",
      total_paid:   totalPaid,
      remaining:    Math.max(0, s.sale_price - totalPaid),
      payments:     (s.payments ?? []).sort(
        (a: Payment, b: Payment) =>
          new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
      ),
    };
  });
}

// ── Get grouped debts (one entry per client) ───────────────────────────────

export async function getGroupedDebts(): Promise<ClientDebt[]> {
  const sales = await getPendingSales();

  const map = new Map<string, ClientDebt>();

  for (const sale of sales) {
    // Group key: phone (normalised) > name > sale id (unknown client)
    const key = sale.guest_phone?.replace(/\D/g, "") || sale.guest_name || sale.id;

    if (!map.has(key)) {
      map.set(key, {
        key,
        guest_name:  sale.guest_name,
        guest_phone: sale.guest_phone,
        sales:       [],
        total_sale:  0,
        total_paid:  0,
        remaining:   0,
      });
    }

    const entry = map.get(key)!;
    entry.sales.push(sale);
    entry.total_sale += sale.sale_price;
    entry.total_paid += sale.total_paid;
    entry.remaining  += sale.remaining;

    // Use the most complete name/phone available for the group
    if (!entry.guest_name  && sale.guest_name)  entry.guest_name  = sale.guest_name;
    if (!entry.guest_phone && sale.guest_phone) entry.guest_phone = sale.guest_phone;
  }

  // Sort by remaining descending (biggest debt first)
  return [...map.values()].sort((a, b) => b.remaining - a.remaining);
}

// ── Add general payment (distributed oldest-first) ─────────────────────────
// Distributes `amount` across the client's pending sales starting from the
// oldest. Marks each sale as completed when its remaining hits 0.

export async function addGeneralPayment(
  sales: PendingSale[],
  amount: number,
  note: string | null
): Promise<void> {
  // Oldest first (already sorted by getPendingSales, but be explicit)
  const sorted = [...sales].sort(
    (a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime()
  );

  let leftover = amount;

  for (const sale of sorted) {
    if (leftover <= 0) break;
    if (sale.remaining <= 0) continue;

    const apply = Math.min(leftover, sale.remaining);

    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  apply,
      note,
    });
    if (payError) throw new Error(payError.message);

    const newTotalPaid = sale.total_paid + apply;
    if (newTotalPaid >= sale.sale_price) {
      const { error: statusError } = await supabase
        .from("sales")
        .update({ status: "completed" })
        .eq("id", sale.id);
      if (statusError) throw new Error(statusError.message);
    }

    leftover -= apply;
  }
}

// ── Add single-sale payment (kept for backward compat) ────────────────────

export async function addPayment(
  saleId: string,
  priceSold: number,
  amount: number,
  note: string | null
): Promise<void> {
  const { error: payError } = await supabase.from("payments").insert({
    sale_id: saleId,
    amount,
    note,
  });
  if (payError) throw new Error(payError.message);

  const { data: payments, error: sumError } = await supabase
    .from("payments")
    .select("amount")
    .eq("sale_id", saleId);
  if (sumError) throw new Error(sumError.message);

  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  if (totalPaid >= priceSold) {
    await supabase.from("sales").update({ status: "completed" }).eq("id", saleId);
  }
}
