import { supabase } from "../lib/supabaseClient";
import { SALE_STATUS } from "../constants/domain";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExternalSaleInput {
  product_name: string;
  cost_price:   number;
  sale_price:   number;
  note:         string | null;
  /** Todo lo de cliente es opcional: una venta externa puede no tener dueño. */
  customer_id:  string | null;
  guest_name:   string | null;
  guest_phone:  string | null;
  /** "pending" = venta a pagos; el saldo entra a Cobros pendientes. */
  status:       "completed" | "pending";
  /** Abono entregado en el momento. Solo aplica a ventas a pagos. */
  initial_payment: number;
}

export interface ExternalSale {
  id:           string;
  product_name: string;
  cost_price:   number;
  sale_price:   number;
  note:         string | null;
  created_by:   string | null;
  sold_at:      string;
  customer_id:  string | null;
  guest_name:   string | null;
  guest_phone:  string | null;
  status:       "completed" | "pending";
  total_paid:   number;
  /** Lo que falta por cobrar. 0 en las ventas de contado. */
  remaining:    number;
}

interface RawExternalSaleRow {
  id:           string;
  product_name: string;
  cost_price:   number;
  sale_price:   number;
  note:         string | null;
  created_by:   string | null;
  sold_at:      string;
  customer_id:  string | null;
  guest_name:   string | null;
  guest_phone:  string | null;
  status:       string | null;
  payments:     Array<{ amount: number }> | null;
}

const SELECT_COLUMNS = `
  id, product_name, cost_price, sale_price, note, created_by, sold_at,
  customer_id, guest_name, guest_phone, status,
  payments ( amount )
`;

function toExternalSale(row: RawExternalSaleRow): ExternalSale {
  const totalPaid = (row.payments ?? []).reduce((total, p) => total + p.amount, 0);
  const status    = row.status === SALE_STATUS.PENDING ? "pending" : "completed";
  return {
    id:           row.id,
    product_name: row.product_name,
    cost_price:   row.cost_price,
    sale_price:   row.sale_price,
    note:         row.note ?? null,
    created_by:   row.created_by ?? null,
    sold_at:      row.sold_at,
    customer_id:  row.customer_id ?? null,
    guest_name:   row.guest_name ?? null,
    guest_phone:  row.guest_phone ?? null,
    status,
    total_paid:   totalPaid,
    remaining:    status === "pending" ? Math.max(row.sale_price - totalPaid, 0) : 0,
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createExternalSale(
  input:     ExternalSaleInput,
  createdBy: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("external_sales")
    .insert({
      product_name: input.product_name.trim(),
      cost_price:   input.cost_price,
      sale_price:   input.sale_price,
      note:         input.note || null,
      created_by:   createdBy,
      customer_id:  input.customer_id,
      guest_name:   input.guest_name?.trim() || null,
      guest_phone:  input.guest_phone || null,
      status:       input.status,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // El abono inicial es un pago más: así aparece en Movimientos y cuenta para
  // el saldo sin lógica aparte.
  if (input.status === SALE_STATUS.PENDING && input.initial_payment > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      external_sale_id: data.id,
      amount:           input.initial_payment,
      note:             "Abono inicial",
    });
    if (payError) throw new Error(payError.message);
  }
}

export async function addExternalSalePayment(
  externalSaleId: string,
  salePrice:      number,
  amount:         number,
  note:           string | null,
): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    external_sale_id: externalSaleId,
    amount,
    note,
  });
  if (error) throw new Error(error.message);

  // Al quedar saldada, deja de ser un cobro pendiente.
  const { data: paid, error: sumError } = await supabase
    .from("payments")
    .select("amount")
    .eq("external_sale_id", externalSaleId);
  if (sumError) throw new Error(sumError.message);

  const totalPaid = (paid ?? []).reduce((total, p) => total + p.amount, 0);
  if (totalPaid >= salePrice) {
    const { error: statusError } = await supabase
      .from("external_sales")
      .update({ status: SALE_STATUS.COMPLETED })
      .eq("id", externalSaleId);
    if (statusError) throw new Error(statusError.message);
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getExternalSalesLog(): Promise<ExternalSale[]> {
  const { data, error } = await supabase
    .from("external_sales")
    .select(SELECT_COLUMNS)
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as RawExternalSaleRow[]).map(toExternalSale);
}

/** Ventas externas a pagos con saldo abierto — alimentan Cobros pendientes. */
export async function getPendingExternalSales(): Promise<ExternalSale[]> {
  const { data, error } = await supabase
    .from("external_sales")
    .select(SELECT_COLUMNS)
    .eq("status", SALE_STATUS.PENDING)
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as RawExternalSaleRow[])
    .map(toExternalSale)
    .filter((sale) => sale.remaining > 0);
}

/** Ventas externas vinculadas a un cliente, para "Mis pedidos". */
export async function getUserExternalSales(userId: string): Promise<ExternalSale[]> {
  const { data, error } = await supabase
    .from("external_sales")
    .select(SELECT_COLUMNS)
    .eq("customer_id", userId)
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as unknown as RawExternalSaleRow[]).map(toExternalSale);
}

/**
 * Enlaza las ventas externas de invitado con el usuario recién registrado,
 * igual que `claimOrders` hace con sales y orders.
 */
export async function claimExternalSales(userId: string, whatsapp: string): Promise<number> {
  const last8 = whatsapp.replace(/\D/g, "").slice(-8);
  if (!last8) return 0;

  const { data, error } = await supabase.rpc("claim_external_sales_by_phone", {
    p_user_id:     userId,
    p_phone_last8: last8,
  });

  if (error) {
    console.error("claimExternalSales rpc error:", error.message);
    return 0;
  }
  return (data as number) ?? 0;
}
