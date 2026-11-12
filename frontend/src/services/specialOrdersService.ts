import { supabase } from "../lib/supabaseClient";
import { fetchAll } from "../lib/fetchAll";

// Encargos: piezas pedidas al proveedor contra pedido. Mientras no se entregan
// no son venta ni ganancia; los adelantos son plata del cliente en custodia.
// Al entregar se convierten (en la base, en un solo paso) en una venta externa
// con precio y costo reales.

export type SpecialOrderStatus = "quoted" | "ordered" | "in_transit" | "arrived" | "delivered" | "cancelled";

/** Estados en orden de avance. */
export const SPECIAL_ORDER_FLOW: SpecialOrderStatus[] = ["quoted", "ordered", "in_transit", "arrived"];

export const SPECIAL_ORDER_STATUS_LABEL: Record<SpecialOrderStatus, string> = {
  quoted:     "Cotizado",
  ordered:    "Pedido al proveedor",
  in_transit: "En camino",
  arrived:    "Llegó a CR",
  delivered:  "Entregado",
  cancelled:  "Cancelado",
};

export interface SpecialOrderPayment {
  id:      string;
  amount:  number;
  note:    string | null;
  paid_at: string;
}

export interface SpecialOrder {
  id:               string;
  customer_id:      string | null;
  guest_name:       string | null;
  guest_phone:      string | null;
  description:      string;
  size:             string | null;
  reference_url:    string | null;
  estimated_price:  number;
  estimated_cost:   number | null;
  status:           SpecialOrderStatus;
  note:             string | null;
  external_sale_id: string | null;
  created_at:       string;
  delivered_at:     string | null;
  payments:         SpecialOrderPayment[];
  /** Adelantos que siguen ligados al encargo (al entregar pasan a la venta). */
  advance:          number;
}

export interface SpecialOrderInput {
  customer_id?:    string | null;
  guest_name:      string | null;
  guest_phone:     string | null;
  description:     string;
  size:            string | null;
  reference_url:   string | null;
  estimated_price: number;
  estimated_cost:  number | null;
  note:            string | null;
  advance:         number;
}

interface RawSpecialOrderRow extends Omit<SpecialOrder, "payments" | "advance"> {
  payments: SpecialOrderPayment[] | null;
}

export function isActiveSpecialOrder(order: SpecialOrder): boolean {
  return order.status !== "delivered" && order.status !== "cancelled";
}

export async function getSpecialOrders(): Promise<SpecialOrder[]> {
  const { data, error } = await fetchAll(() => supabase
    .from("special_orders")
    .select(`
      id, customer_id, guest_name, guest_phone, description, size, reference_url,
      estimated_price, estimated_cost, status, note, external_sale_id,
      created_at, delivered_at,
      payments ( id, amount, note, paid_at )
    `)
    .order("created_at", { ascending: false }));
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RawSpecialOrderRow[]).map((row) => {
    const payments = [...(row.payments ?? [])].sort((a, b) => a.paid_at.localeCompare(b.paid_at));
    return {
      ...row,
      estimated_price: Number(row.estimated_price) || 0,
      estimated_cost:  row.estimated_cost === null ? null : Number(row.estimated_cost),
      payments,
      advance: payments.reduce((total, payment) => total + Number(payment.amount), 0),
    };
  });
}

export async function createSpecialOrder(input: SpecialOrderInput): Promise<void> {
  const { error } = await supabase.rpc("create_special_order", { p: input });
  if (error) throw new Error(error.message);
}

export type SpecialOrderEdit = Pick<SpecialOrder,
  "guest_name" | "guest_phone" | "description" | "size" | "estimated_price" | "estimated_cost" | "note">;

/** Corrige los datos de un encargo activo. Los adelantos se manejan aparte. */
export async function updateSpecialOrder(id: string, fields: SpecialOrderEdit): Promise<void> {
  const { error } = await supabase.from("special_orders").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateSpecialOrderStatus(id: string, status: SpecialOrderStatus): Promise<void> {
  const { error } = await supabase.from("special_orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addSpecialOrderAdvance(id: string, amount: number, note: string | null): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    special_order_id: id,
    amount,
    note: note || "Adelanto de encargo",
  });
  if (error) throw new Error(error.message);
}

/** Convierte el encargo en una venta externa con precio y costo reales. */
export async function deliverSpecialOrder(
  id: string, finalPrice: number, cost: number, productName: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("deliver_special_order", {
    p_id: id, p_final_price: finalPrice, p_cost: cost, p_product_name: productName,
  });
  if (error) throw new Error(error.message);
}

export async function cancelSpecialOrder(id: string, refund: boolean, reason: string | null): Promise<void> {
  const { error } = await supabase.rpc("cancel_special_order", {
    p_id: id, p_refund: refund, p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

// ── Lado del cliente ───────────────────────────────────────────────────────

export interface MySpecialOrder {
  id:              string;
  description:     string;
  size:            string | null;
  estimated_price: number;
  status:          SpecialOrderStatus;
  created_at:      string;
  delivered_at:    string | null;
  /** Adelantos registrados (al entregar pasan a la venta y aquí queda 0). */
  paid:            number;
}

/** Los encargos del cliente con sesión, sin datos internos (costo, notas). */
export async function getMySpecialOrders(): Promise<MySpecialOrder[]> {
  const { data, error } = await supabase.rpc("my_special_orders");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, string | number | null>[]).map((row) => ({
    id:              String(row.id),
    description:     String(row.description),
    size:            row.size ? String(row.size) : null,
    estimated_price: Number(row.estimated_price) || 0,
    status:          row.status as SpecialOrderStatus,
    created_at:      String(row.created_at),
    delivered_at:    row.delivered_at ? String(row.delivered_at) : null,
    paid:            Number(row.paid) || 0,
  }));
}

export async function claimSpecialOrders(userId: string, whatsapp: string): Promise<number> {
  const last8 = whatsapp.replace(/\D/g, "").slice(-8);
  if (last8.length < 8) return 0;
  const { data, error } = await supabase.rpc("claim_special_orders_by_phone", {
    p_user_id: userId, p_phone_last8: last8,
  });
  if (error) throw new Error(error.message);
  return Number(data) || 0;
}
