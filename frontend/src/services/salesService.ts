import { supabase } from "../lib/supabaseClient";

// ── Shipping & Delivery constants ──────────────────────────────────────────

export const SHIPPING_OPTIONS = [
  { value: "personal_grecia",   label: "Entrega personal (Grecia)",    cost: 0    },
  { value: "mensajero_sjo",     label: "Mensajero — SJO / HER / ALA", cost: 3000 },
  { value: "mensajero_cartago", label: "Mensajero — Cartago",          cost: 4000 },
  { value: "correos_gam",       label: "Correos CR — GAM",             cost: 2500 },
  { value: "correos_fuera_gam", label: "Correos CR — Fuera GAM",       cost: 3000 },
] as const;

export type ShippingMethod = typeof SHIPPING_OPTIONS[number]["value"];

export const DELIVERY_STATUSES = [
  { value: "validating", label: "Validando",  bgCls: "bg-amber-100  text-amber-700"  },
  { value: "confirmed",  label: "Confirmado", bgCls: "bg-orange-100 text-orange-700" },
  { value: "shipped",    label: "Enviado",    bgCls: "bg-blue-100   text-blue-700"   },
  { value: "delivered",  label: "Entregado",  bgCls: "bg-green-100  text-green-700"  },
  { value: "cancelled",  label: "Cancelado",  bgCls: "bg-red-100    text-red-600"    },
] as const;

export type DeliveryStatus = typeof DELIVERY_STATUSES[number]["value"];

export function shippingCostFor(method: ShippingMethod): number {
  return SHIPPING_OPTIONS.find((o) => o.value === method)?.cost ?? 0;
}

export function deliveryStatusMeta(value: string) {
  return (
    DELIVERY_STATUSES.find((s) => s.value === value) ??
    DELIVERY_STATUSES[0]
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface SaleInput {
  product_id:       string;
  variant_id:       string;
  quantity:         number;
  sale_price:       number;
  note:             string | null;
  guest_name:       string | null;
  guest_phone:      string | null;
  status:           "completed" | "pending";
  initial_payment:  number;
  shipping_method:  ShippingMethod;
  shipping_cost:    number;
  delivery_status:  DeliveryStatus;
  tracking_number:  string | null;
}

export interface Payment {
  id:      string;
  amount:  number;
  note:    string | null;
  paid_at: string;
}

export interface PendingSale {
  id:              string;
  sale_price:      number;
  shipping_cost:   number;
  guest_name:      string | null;
  guest_phone:     string | null;
  note:            string | null;
  sold_at:         string;
  product_name:    string;
  variant_size:    string;
  total_paid:      number;
  remaining:       number;   // (sale_price + shipping_cost) − total_paid
  payments:        Payment[];
}

// Grouped view: one entry per client (grouped by phone, then name)
export interface ClientDebt {
  key:         string;
  guest_name:  string | null;
  guest_phone: string | null;
  sales:       PendingSale[];
  total_sale:  number;   // sum of (sale_price + shipping_cost)
  total_paid:  number;
  remaining:   number;
}

export interface UserOrder {
  id:              string;
  sale_price:      number;
  shipping_cost:   number;
  shipping_method: string;
  delivery_status: string;
  tracking_number: string | null;
  status:          "pending" | "completed";
  sold_at:         string;
  note:            string | null;
  product_name:    string;
  variant_size:    string;
  image_url:       string;
  total_paid:      number;
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
      product_id:      data.product_id,
      variant_id:      data.variant_id,
      quantity:        data.quantity,
      sale_price:      data.sale_price,
      cost_price:      product.price_purchase,
      guest_name:      data.guest_name,
      guest_phone:     data.guest_phone,
      status:          data.status,
      note:            data.note,
      shipping_method: data.shipping_method,
      shipping_cost:   data.shipping_cost,
      delivery_status: data.delivery_status,
      tracking_number: data.tracking_number,
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

// ── Update delivery status + tracking ─────────────────────────────────────

export async function updateSaleDelivery(
  saleId:          string,
  delivery_status: DeliveryStatus,
  tracking_number: string | null
): Promise<void> {
  const { error } = await supabase
    .from("sales")
    .update({ delivery_status, tracking_number })
    .eq("id", saleId);
  if (error) throw new Error(error.message);
}

// ── Get pending sales (raw) ────────────────────────────────────────────────

export async function getPendingSales(): Promise<PendingSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sale_price, shipping_cost, guest_name, guest_phone, note, sold_at,
      product_variants ( size, products ( name ) ),
      payments ( id, amount, note, paid_at )
    `)
    .eq("status", "pending")
    .order("sold_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((s: any) => {
    const shippingCost = s.shipping_cost ?? 0;
    const totalOwed    = s.sale_price + shippingCost;
    const totalPaid    = (s.payments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + p.amount, 0
    );
    return {
      id:           s.id,
      sale_price:   s.sale_price,
      shipping_cost: shippingCost,
      guest_name:   s.guest_name,
      guest_phone:  s.guest_phone,
      note:         s.note,
      sold_at:      s.sold_at,
      product_name: s.product_variants?.products?.name ?? "—",
      variant_size: s.product_variants?.size ?? "—",
      total_paid:   totalPaid,
      remaining:    Math.max(0, totalOwed - totalPaid),
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
  const map   = new Map<string, ClientDebt>();

  for (const sale of sales) {
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
    entry.total_sale += sale.sale_price + sale.shipping_cost;
    entry.total_paid += sale.total_paid;
    entry.remaining  += sale.remaining;

    if (!entry.guest_name  && sale.guest_name)  entry.guest_name  = sale.guest_name;
    if (!entry.guest_phone && sale.guest_phone) entry.guest_phone = sale.guest_phone;
  }

  return [...map.values()].sort((a, b) => b.remaining - a.remaining);
}

// ── Add general payment (distributed oldest-first) ─────────────────────────

export async function addGeneralPayment(
  sales:  PendingSale[],
  amount: number,
  note:   string | null
): Promise<void> {
  const sorted   = [...sales].sort(
    (a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime()
  );
  let leftover = amount;

  for (const sale of sorted) {
    if (leftover <= 0)      break;
    if (sale.remaining <= 0) continue;

    const apply = Math.min(leftover, sale.remaining);

    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  apply,
      note,
    });
    if (payError) throw new Error(payError.message);

    const newTotalPaid = sale.total_paid + apply;
    const totalOwed    = sale.sale_price + sale.shipping_cost;

    if (newTotalPaid >= totalOwed) {
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
  saleId:    string,
  priceSold: number,
  amount:    number,
  note:      string | null
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

// ── The Bridge: claim orders matching user's WhatsApp ─────────────────────
// Finds sales with customer_id = NULL whose guest_phone matches this user,
// and permanently assigns customer_id so they appear in "Mis Pedidos".

export async function claimOrders(userId: string, whatsapp: string): Promise<number> {
  // Compare only the last 8 digits so "+50688887777" matches "88887777"
  const last8 = (s: string) => s.replace(/\D/g, "").slice(-8);
  const userLast8 = last8(whatsapp);
  if (!userLast8) return 0;

  // Fetch unclaimed sales that have a phone
  const { data, error } = await supabase
    .from("sales")
    .select("id, guest_phone")
    .is("customer_id", null)
    .not("guest_phone", "is", null);

  if (error || !data?.length) return 0;

  const matchIds = data
    .filter((s) => last8(s.guest_phone ?? "") === userLast8)
    .map((s) => s.id);

  if (!matchIds.length) return 0;

  await supabase
    .from("sales")
    .update({ customer_id: userId })
    .in("id", matchIds);

  return matchIds.length;
}

// ── Get user orders ────────────────────────────────────────────────────────

export async function getUserOrders(userId: string): Promise<UserOrder[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sale_price, shipping_cost, shipping_method,
      delivery_status, tracking_number, status, sold_at, note,
      product_variants (
        size,
        products (
          name,
          product_images ( image_url, is_primary, display_order )
        )
      ),
      payments ( amount )
    `)
    .eq("customer_id", userId)
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((s: any) => {
    const rawImages: any[] = s.product_variants?.products?.product_images ?? [];
    const images = [...rawImages].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    });
    const totalPaid = (s.payments ?? []).reduce(
      (sum: number, p: any) => sum + p.amount, 0
    );

    return {
      id:              s.id,
      sale_price:      s.sale_price,
      shipping_cost:   s.shipping_cost  ?? 0,
      shipping_method: s.shipping_method ?? "personal_grecia",
      delivery_status: s.delivery_status ?? "validating",
      tracking_number: s.tracking_number ?? null,
      status:          s.status,
      sold_at:         s.sold_at,
      note:            s.note ?? null,
      product_name:    s.product_variants?.products?.name ?? "—",
      variant_size:    s.product_variants?.size ?? "—",
      image_url:       images[0]?.image_url ?? "",
      total_paid:      totalPaid,
    };
  });
}

// ── Admin: all sales ───────────────────────────────────────────────────────

export interface AdminSale {
  id:              string;
  sold_at:         string;
  sale_price:      number;
  shipping_cost:   number;
  shipping_method: string;
  delivery_status: string;
  tracking_number: string | null;
  status:          "pending" | "completed";
  note:            string | null;
  guest_name:      string | null;
  guest_phone:     string | null;
  product_name:    string;
  variant_size:    string;
  image_url:       string;
  total_paid:      number;
}

export async function getAllSales(): Promise<AdminSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sold_at, sale_price, shipping_cost, shipping_method,
      delivery_status, tracking_number, status, note,
      guest_name, guest_phone,
      product_variants (
        size,
        products (
          name,
          product_images ( image_url, is_primary, display_order )
        )
      ),
      payments ( amount )
    `)
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((s: any) => {
    const rawImages: any[] = s.product_variants?.products?.product_images ?? [];
    const images = [...rawImages].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    });
    const totalPaid = (s.payments ?? []).reduce(
      (sum: number, p: any) => sum + p.amount, 0
    );
    return {
      id:              s.id,
      sold_at:         s.sold_at,
      sale_price:      s.sale_price,
      shipping_cost:   s.shipping_cost   ?? 0,
      shipping_method: s.shipping_method ?? "personal_grecia",
      delivery_status: s.delivery_status ?? "validating",
      tracking_number: s.tracking_number ?? null,
      status:          s.status,
      note:            s.note            ?? null,
      guest_name:      s.guest_name      ?? null,
      guest_phone:     s.guest_phone     ?? null,
      product_name:    s.product_variants?.products?.name ?? "—",
      variant_size:    s.product_variants?.size           ?? "—",
      image_url:       images[0]?.image_url               ?? "",
      total_paid:      totalPaid,
    };
  });
}

export async function updateSaleAdmin(
  saleId:          string,
  delivery_status: DeliveryStatus,
  tracking_number: string | null,
  note:            string | null
): Promise<void> {
  const { error } = await supabase
    .from("sales")
    .update({ delivery_status, tracking_number, note })
    .eq("id", saleId);
  if (error) throw new Error(error.message);
}
