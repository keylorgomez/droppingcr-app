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
  initial_payment: number; // first payment amount
}

export interface Payment {
  id:       string;
  amount:   number;
  note:     string | null;
  paid_at:  string;
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

// ── Record manual sale ─────────────────────────────────────────────────────
// Steps:
//   1. Insert sale record
//   2. Decrement stock (atomic RPC)
//   3. Insert first payment record

export async function recordManualSale(data: SaleInput): Promise<void> {
  // Fetch cost_price from the product to snapshot it on the sale
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

  // Only create a payment record if there's an initial amount
  if (data.initial_payment > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  data.initial_payment,
      note:    data.status === "pending" ? "Abono inicial" : "Pago completo",
    });
    if (payError) throw new Error(payError.message);
  }
}

// ── Get pending sales ──────────────────────────────────────────────────────

export async function getPendingSales(): Promise<PendingSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sale_price, guest_name, guest_phone, note, sold_at,
      product_variants ( size, products ( name ) ),
      payments ( id, amount, note, paid_at )
    `)
    .eq("status", "pending")
    .order("sold_at", { ascending: false });

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

// ── Add payment ────────────────────────────────────────────────────────────
// Inserts a new payment and marks the sale as completed if fully paid.

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

  // Sum all payments to check completion
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
