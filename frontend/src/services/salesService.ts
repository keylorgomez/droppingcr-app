import { supabase } from "../lib/supabaseClient";
import { sendTransactionalEmail } from "../lib/emailService";

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
  { value: "apartada",   label: "Apartada",   bgCls: "bg-yellow-100 text-yellow-700" },
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

export interface OrderItemDetail {
  product_name: string;
  variant_size: string;
  quantity:     number;
  sale_price:   number;
  image_url:    string;
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
  variant_id:      string;
  delivery_status: string;
  total_paid:      number;
  remaining:       number;   // (sale_price + shipping_cost) − total_paid
  payments:        Payment[];
  isOrder?:        boolean;       // true when derived from orders table
  orderItems?:     OrderItemDetail[]; // populated for multi-item orders
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
  isMultiOrder?:   boolean;
  items?:          OrderItemDetail[];
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

  if (data.delivery_status === "apartada") {
    const { error: reserveErr } = await supabase
      .from("product_variants")
      .update({ is_reserved: true })
      .eq("id", data.variant_id);
    if (reserveErr) throw new Error(reserveErr.message);
  }

  if (data.initial_payment > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  data.initial_payment,
      note:    data.status === "pending" ? "Abono inicial" : "Pago completo",
    });
    if (payError) throw new Error(payError.message);
  }

  // Correo de comprobante (fire-and-forget)
  triggerOrderEmail(
    data.guest_phone,
    data.guest_name,
    [{ variant_id: data.variant_id, quantity: data.quantity, sale_price: data.sale_price }],
    data.shipping_cost,
  );
}

// ── Email helper — resuelve nombres y dispara correo ──────────────────────────

function triggerOrderEmail(
  guestPhone:   string | null,
  guestName:    string | null,
  items:        { variant_id: string; quantity: number; sale_price: number }[],
  shippingCost: number,
): void {
  (async () => {
    const resolved = await Promise.all(
      items.map(async (item) => {
        const { data: variant } = await supabase
          .from("product_variants")
          .select("size, products(name)")
          .eq("id", item.variant_id)
          .single();
        return {
          product_name: (variant?.products as any)?.name ?? "Producto",
          variant_size: variant?.size ?? "—",
          quantity:     item.quantity,
          sale_price:   item.sale_price,
        };
      }),
    );

    const itemsTotal = resolved.reduce((s, i) => s + i.sale_price * i.quantity, 0);

    sendTransactionalEmail({
      type: "new_order",
      data: {
        guest_phone:   guestPhone,
        guest_name:    guestName,
        items:         resolved,
        shipping_cost: shippingCost,
        total:         itemsTotal + shippingCost,
      },
    });
  })().catch(() => {});
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
      variant_id, delivery_status,
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
      product_name:    s.product_variants?.products?.name ?? "—",
      variant_size:    s.product_variants?.size            ?? "—",
      variant_id:      s.variant_id                        ?? "",
      delivery_status: s.delivery_status                   ?? "validating",
      total_paid:      totalPaid,
      remaining:       Math.max(0, totalOwed - totalPaid),
      payments:     (s.payments ?? []).sort(
        (a: Payment, b: Payment) =>
          new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
      ),
    };
  });
}

// ── Get grouped debts (one entry per client) ───────────────────────────────

export async function getGroupedDebts(): Promise<ClientDebt[]> {
  // Fetch pending sales and pending orders in parallel
  const [sales, ordersResult] = await Promise.all([
    getPendingSales(),
    supabase
      .from("orders")
      .select(`
        id, guest_name, guest_phone, note, sold_at,
        shipping_cost, delivery_status,
        order_items ( id, sale_price, quantity, product_variants(size, products(name, product_images(image_url, is_primary, display_order))) ),
        payments ( id, amount, note, paid_at )
      `)
      .eq("status", "pending"),
  ]);

  const map = new Map<string, ClientDebt>();

  const normalizePhone = (phone: string | null): string | null => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "").slice(-8);
    return digits ? `+506${digits}` : null;
  };

  for (const sale of sales) {
    const key = sale.guest_phone?.replace(/\D/g, "").slice(-8) || sale.guest_name || sale.id;

    if (!map.has(key)) {
      map.set(key, {
        key,
        guest_name:  sale.guest_name,
        guest_phone: normalizePhone(sale.guest_phone),
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

    if (!entry.guest_name)  entry.guest_name  = sale.guest_name;
    if (!entry.guest_phone) entry.guest_phone = normalizePhone(sale.guest_phone);
  }

  // Merge pending orders into the map
  for (const o of (ordersResult.data ?? []) as any[]) {
    const items: any[]     = o.order_items ?? [];
    const shippingCost     = o.shipping_cost ?? 0;
    const itemsTotal       = items.reduce((s: number, i: any) => s + i.sale_price * i.quantity, 0);
    const totalOwed        = itemsTotal + shippingCost;
    const totalPaid        = (o.payments ?? []).reduce((s: number, p: any) => s + p.amount, 0);

    const productLabel = items.length > 1
      ? `${items.length} productos (Pedido)`
      : `${items[0]?.product_variants?.products?.name ?? "Pedido"} (Pedido)`;

    const variantSize = items.length === 1
      ? (items[0]?.product_variants?.size ?? "—")
      : "Varios";

    const orderItems: OrderItemDetail[] = items.map((i: any) => {
      const rawImgs: any[] = i.product_variants?.products?.product_images ?? [];
      const sorted = [...rawImgs].sort((a: any, b: any) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.display_order - b.display_order;
      });
      return {
        product_name: i.product_variants?.products?.name ?? "Producto",
        variant_size: i.product_variants?.size ?? "—",
        quantity:     i.quantity,
        sale_price:   i.sale_price,
        image_url:    sorted[0]?.image_url ?? "",
      };
    });

    const pendingSale: PendingSale = {
      id:              o.id,
      sale_price:      itemsTotal,
      shipping_cost:   shippingCost,
      guest_name:      o.guest_name      ?? null,
      guest_phone:     o.guest_phone     ?? null,
      note:            o.note            ?? null,
      sold_at:         o.sold_at,
      product_name:    productLabel,
      variant_size:    variantSize,
      variant_id:      items[0]?.product_variants?.id ?? "",
      delivery_status: o.delivery_status ?? "validating",
      total_paid:      totalPaid,
      remaining:       Math.max(0, totalOwed - totalPaid),
      payments:        ((o.payments ?? []) as Payment[]).sort(
        (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
      ),
      isOrder:         true,
      orderItems,
    };

    const key = (o.guest_phone as string | null)?.replace(/\D/g, "").slice(-8) || (o.guest_name as string | null) || o.id;

    if (!map.has(key)) {
      map.set(key, {
        key,
        guest_name:  o.guest_name  ?? null,
        guest_phone: normalizePhone(o.guest_phone ?? null),
        sales:       [],
        total_sale:  0,
        total_paid:  0,
        remaining:   0,
      });
    }

    const entry = map.get(key)!;
    entry.sales.push(pendingSale);
    entry.total_sale += totalOwed;
    entry.total_paid += totalPaid;
    entry.remaining  += pendingSale.remaining;

    if (!entry.guest_name)  entry.guest_name  = o.guest_name  ?? null;
    if (!entry.guest_phone) entry.guest_phone = normalizePhone(o.guest_phone ?? null);
  }

  return [...map.values()].sort((a, b) => b.remaining - a.remaining);
}

// ── Add general payment (distributed oldest-first) ─────────────────────────

export async function addGeneralPayment(
  sales:      PendingSale[],
  amount:     number,
  note:       string | null,
  clientInfo: { guest_phone: string | null; guest_name: string | null; total_remaining: number },
): Promise<void> {
  const sorted   = [...sales].sort(
    (a, b) => new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime()
  );
  let leftover = amount;

  for (const sale of sorted) {
    if (leftover <= 0)       break;
    if (sale.remaining <= 0) continue;

    const apply = Math.min(leftover, sale.remaining);

    // TODO: orders in the debt list should use addOrderPayment instead.
    // For now we route order-derived PendingSales to addOrderPayment.
    if (sale.isOrder) {
      const orderTotal = sale.sale_price + sale.shipping_cost;
      await addOrderPayment(sale.id, orderTotal, apply, note);
      leftover -= apply;
      continue;
    }

    const { error: payError } = await supabase.from("payments").insert({
      sale_id: sale.id,
      amount:  apply,
      note,
    });
    if (payError) throw new Error(payError.message);

    const newTotalPaid = sale.total_paid + apply;
    const totalOwed    = sale.sale_price + sale.shipping_cost;

    if (newTotalPaid >= totalOwed) {
      const isApartada = sale.delivery_status === "apartada";
      const updates: Record<string, unknown> = { status: "completed" };
      if (isApartada) updates.delivery_status = "confirmed";

      const { error: statusError } = await supabase
        .from("sales")
        .update(updates)
        .eq("id", sale.id);
      if (statusError) throw new Error(statusError.message);

      if (isApartada && sale.variant_id) {
        await supabase
          .from("product_variants")
          .update({ is_reserved: false })
          .eq("id", sale.variant_id);
      }
    }

    leftover -= apply;
  }

  // Fire payment receipt email — only if client has a phone (to look up their email)
  if (clientInfo.guest_phone) {
    const totalOwedAll = sales.reduce((s, sale) => s + sale.sale_price + sale.shipping_cost, 0);
    const newRemaining = Math.max(0, clientInfo.total_remaining - amount);
    sendTransactionalEmail({
      type: "payment_receipt",
      data: {
        guest_phone:  clientInfo.guest_phone,
        guest_name:   clientInfo.guest_name,
        amount_paid:  amount,
        total_owed:   totalOwedAll,
        remaining:    newRemaining,
        note,
      },
    });
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
    const { data: saleData } = await supabase
      .from("sales")
      .select("delivery_status, variant_id")
      .eq("id", saleId)
      .single();

    const isApartada = saleData?.delivery_status === "apartada";
    const updates: Record<string, unknown> = { status: "completed" };
    if (isApartada) updates.delivery_status = "confirmed";

    await supabase.from("sales").update(updates).eq("id", saleId);

    if (isApartada && saleData?.variant_id) {
      await supabase
        .from("product_variants")
        .update({ is_reserved: false })
        .eq("id", saleData.variant_id);
    }
  }
}

// ── The Bridge: claim orders matching user's WhatsApp ─────────────────────
// Finds sales with customer_id = NULL whose guest_phone matches this user,
// and permanently assigns customer_id so they appear in "Mis Pedidos".

export async function claimOrders(userId: string, whatsapp: string): Promise<number> {
  const last8 = whatsapp.replace(/\D/g, "").slice(-8);
  if (!last8) return 0;

  // Uses a SECURITY DEFINER RPC so it can UPDATE unclaimed rows (customer_id = NULL)
  // without needing SELECT access to those rows via RLS.
  const { data, error } = await supabase.rpc("claim_orders_by_phone", {
    p_user_id:     userId,
    p_phone_last8: last8,
  });

  if (error) {
    console.error("claimOrders rpc error:", error.message);
    return 0;
  }

  return (data as number) ?? 0;
}

// ── Get user orders ────────────────────────────────────────────────────────

export async function getUserOrders(userId: string): Promise<UserOrder[]> {
  const [salesResult, ordersResult] = await Promise.all([
    supabase
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
      .order("sold_at", { ascending: false }),
    supabase
      .from("orders")
      .select(`
        id, shipping_cost, shipping_method,
        delivery_status, tracking_number, status, sold_at, note,
        order_items (
          quantity, sale_price,
          product_variants (
            size,
            products (
              name,
              product_images ( image_url, is_primary, display_order )
            )
          )
        ),
        payments ( amount )
      `)
      .eq("customer_id", userId)
      .order("sold_at", { ascending: false }),
  ]);

  if (salesResult.error)  throw new Error(salesResult.error.message);
  if (ordersResult.error) throw new Error(`orders: ${ordersResult.error.message}`);

  const primaryImage = (images: any[]) => {
    const sorted = [...images].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    });
    return sorted[0]?.image_url ?? "";
  };

  const sales: UserOrder[] = (salesResult.data ?? []).map((s: any) => {
    const totalPaid = (s.payments ?? []).reduce((sum: number, p: any) => sum + p.amount, 0);
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
      image_url:       primaryImage(s.product_variants?.products?.product_images ?? []),
      total_paid:      totalPaid,
    };
  });

  const multiOrders: UserOrder[] = (ordersResult.data ?? []).map((o: any) => {
    const items: any[]  = o.order_items ?? [];
    const itemsTotal    = items.reduce((s: number, i: any) => s + i.sale_price * i.quantity, 0);
    const totalPaid     = (o.payments ?? []).reduce((s: number, p: any) => s + p.amount, 0);
    const firstItem     = items[0];
    const isMulti       = items.length > 1;

    const orderItems: OrderItemDetail[] = items.map((i: any) => ({
      product_name: i.product_variants?.products?.name ?? "Producto",
      variant_size: i.product_variants?.size ?? "—",
      quantity:     i.quantity,
      sale_price:   i.sale_price,
      image_url:    primaryImage(i.product_variants?.products?.product_images ?? []),
    }));

    return {
      id:              o.id,
      sale_price:      itemsTotal,
      shipping_cost:   o.shipping_cost  ?? 0,
      shipping_method: o.shipping_method ?? "personal_grecia",
      delivery_status: o.delivery_status ?? "validating",
      tracking_number: o.tracking_number ?? null,
      status:          o.status,
      sold_at:         o.sold_at,
      note:            o.note ?? null,
      product_name:    isMulti ? `${items.length} productos` : (firstItem?.product_variants?.products?.name ?? "—"),
      variant_size:    isMulti ? "Varios" : (firstItem?.product_variants?.size ?? "—"),
      image_url:       primaryImage(firstItem?.product_variants?.products?.product_images ?? []),
      total_paid:      totalPaid,
      isMultiOrder:    true,   // always use multi-card layout for orders table entries
      items:           orderItems,
    };
  });

  return [...sales, ...multiOrders].sort(
    (a, b) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
  );
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
  variant_id:      string;
  quantity:        number;
  image_url:       string;
  total_paid:      number;
}

export async function getAllSales(): Promise<AdminSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sold_at, sale_price, shipping_cost, shipping_method,
      delivery_status, tracking_number, status, note,
      guest_name, guest_phone, variant_id, quantity,
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
      variant_id:      s.variant_id                       ?? "",
      quantity:        s.quantity                         ?? 1,
      image_url:       images[0]?.image_url               ?? "",
      total_paid:      totalPaid,
    };
  });
}

// ── Refund log ────────────────────────────────────────────────────────────

export interface RefundLog {
  id:           string;
  sale_id:      string;
  guest_name:   string | null;
  guest_phone:  string | null;
  product_name: string;
  variant_size: string;
  amount:       number;
  reason:       string | null;
  created_at:   string;
}

export async function getRefundsLog(): Promise<RefundLog[]> {
  const { data, error } = await supabase
    .from("refunds")
    .select(`
      id, sale_id, amount, reason, created_at,
      sales (
        guest_name, guest_phone,
        product_variants ( size, products ( name ) )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: any) => ({
    id:           r.id,
    sale_id:      r.sale_id,
    guest_name:   r.sales?.guest_name  ?? null,
    guest_phone:  r.sales?.guest_phone ?? null,
    product_name: r.sales?.product_variants?.products?.name ?? "—",
    variant_size: r.sales?.product_variants?.size           ?? "—",
    amount:       r.amount,
    reason:       r.reason ?? null,
    created_at:   r.created_at,
  }));
}

// ── Payment log ───────────────────────────────────────────────────────────

export interface PaymentLog {
  id:              string;
  amount:          number;
  note:            string | null;
  paid_at:         string;
  sale_id:         string;
  guest_name:      string | null;
  guest_phone:     string | null;
  product_name:    string;
  variant_size:    string;
  delivery_status: string;
  sale_price:      number;
  shipping_cost:   number;
}

export async function getPaymentsLog(): Promise<PaymentLog[]> {
  const [salesPmtsResult, orderPmtsResult] = await Promise.all([
    supabase
      .from("payments")
      .select(`
        id, amount, note, paid_at,
        sales (
          id, guest_name, guest_phone, sale_price, shipping_cost, delivery_status,
          product_variants ( size, products ( name ) )
        )
      `)
      .not("sale_id", "is", null)
      .order("paid_at", { ascending: false }),
    supabase
      .from("payments")
      .select(`
        id, amount, note, paid_at,
        orders (
          id, guest_name, guest_phone, delivery_status, shipping_cost,
          order_items ( sale_price, quantity )
        )
      `)
      .not("order_id", "is", null)
      .order("paid_at", { ascending: false }),
  ]);

  if (salesPmtsResult.error) throw new Error(salesPmtsResult.error.message);

  const saleLogs: PaymentLog[] = (salesPmtsResult.data ?? []).map((p: any) => ({
    id:              p.id,
    amount:          p.amount,
    note:            p.note              ?? null,
    paid_at:         p.paid_at,
    sale_id:         p.sales?.id         ?? "",
    guest_name:      p.sales?.guest_name  ?? null,
    guest_phone:     p.sales?.guest_phone ?? null,
    product_name:    p.sales?.product_variants?.products?.name ?? "—",
    variant_size:    p.sales?.product_variants?.size           ?? "—",
    delivery_status: p.sales?.delivery_status                  ?? "validating",
    sale_price:      p.sales?.sale_price                       ?? 0,
    shipping_cost:   p.sales?.shipping_cost                    ?? 0,
  }));

  const orderLogs: PaymentLog[] = (orderPmtsResult.data ?? []).map((p: any) => {
    const order     = p.orders;
    const items: any[] = order?.order_items ?? [];
    const itemCount    = items.length;
    const itemsTotal   = items.reduce((s: number, i: any) => s + i.sale_price * i.quantity, 0);
    const productName  = itemCount > 1 ? "Pedido multi-producto" : (items[0] ? "Pedido" : "Pedido");
    return {
      id:              p.id,
      amount:          p.amount,
      note:            p.note               ?? null,
      paid_at:         p.paid_at,
      sale_id:         order?.id            ?? "",
      guest_name:      order?.guest_name    ?? null,
      guest_phone:     order?.guest_phone   ?? null,
      product_name:    productName,
      variant_size:    "—",
      delivery_status: order?.delivery_status ?? "validating",
      sale_price:      itemsTotal,
      shipping_cost:   order?.shipping_cost ?? 0,
    };
  });

  return [...saleLogs, ...orderLogs].sort(
    (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
  );
}

// ── Multi-item Order types ─────────────────────────────────────────────────

export interface OrderItemInput {
  product_id: string;
  variant_id: string;
  quantity: number;
  sale_price: number;
}

export interface OrderInput {
  items: OrderItemInput[];
  guest_name: string | null;
  guest_phone: string | null;
  status: "completed" | "pending";
  initial_payment: number;
  shipping_method: ShippingMethod;
  shipping_cost: number;
  delivery_status: DeliveryStatus;
  tracking_number: string | null;
  note: string | null;
}

export interface AdminOrderItem {
  id: string;
  product_name: string;
  variant_size: string;
  variant_id: string;
  product_id: string;
  quantity: number;
  sale_price: number;
  image_url: string;
}

export interface AdminOrder {
  id: string;
  sold_at: string;
  guest_name: string | null;
  guest_phone: string | null;
  shipping_method: string;
  shipping_cost: number;
  delivery_status: string;
  tracking_number: string | null;
  status: "pending" | "completed" | "cancelled";
  note: string | null;
  items: AdminOrderItem[];
  items_total: number;
  order_total: number;
  total_paid: number;
}

// ── Record multi-item order ────────────────────────────────────────────────

export async function recordManualOrder(data: OrderInput): Promise<void> {
  // 1. Fetch cost prices
  const costPrices = new Map<string, number>();
  for (const item of data.items) {
    if (!costPrices.has(item.product_id)) {
      const { data: p, error } = await supabase
        .from("products")
        .select("price_purchase")
        .eq("id", item.product_id)
        .single();
      if (error) throw new Error(error.message);
      costPrices.set(item.product_id, p.price_purchase);
    }
  }

  // 2. Create order header
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      guest_name:      data.guest_name,
      guest_phone:     data.guest_phone,
      shipping_method: data.shipping_method,
      shipping_cost:   data.shipping_cost,
      delivery_status: data.delivery_status,
      tracking_number: data.tracking_number,
      status:          data.status,
      note:            data.note,
    })
    .select("id")
    .single();

  if (orderError) throw new Error(orderError.message);
  const orderId = order.id;

  // 3. Insert order items
  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(
      data.items.map((item) => ({
        order_id:   orderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity:   item.quantity,
        sale_price: item.sale_price,
        cost_price: costPrices.get(item.product_id) ?? 0,
      }))
    );
  if (itemsError) throw new Error(itemsError.message);

  // 4. Decrement stock + handle apartada
  for (const item of data.items) {
    const { error: stockError } = await supabase.rpc("decrement_variant_stock", {
      p_variant_id: item.variant_id,
      p_amount:     item.quantity,
    });
    if (stockError) throw new Error(stockError.message);

    if (data.delivery_status === "apartada") {
      const { error: reserveErr } = await supabase
        .from("product_variants")
        .update({ is_reserved: true })
        .eq("id", item.variant_id);
      if (reserveErr) throw new Error(reserveErr.message);
    }
  }

  // 5. Initial payment
  if (data.initial_payment > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      order_id: orderId,
      sale_id:  null,
      amount:   data.initial_payment,
      note:     data.status === "pending" ? "Abono inicial" : "Pago completo",
    });
    if (payError) throw new Error(payError.message);
  }

  // 6. Fire-and-forget order confirmation email
  triggerOrderEmail(
    data.guest_phone,
    data.guest_name,
    data.items.map((item) => ({
      variant_id: item.variant_id,
      quantity:   item.quantity,
      sale_price: item.sale_price,
    })),
    data.shipping_cost,
  );
}

// ── Get all orders ─────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, sold_at, guest_name, guest_phone,
      shipping_method, shipping_cost, delivery_status,
      tracking_number, status, note,
      order_items (
        id, quantity, sale_price,
        product_variants (
          id, size,
          products (
            id, name,
            product_images ( image_url, is_primary, display_order )
          )
        )
      ),
      payments ( amount )
    `)
    .order("sold_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((o: any) => {
    const items: AdminOrderItem[] = (o.order_items ?? []).map((item: any) => {
      const rawImages: any[] = item.product_variants?.products?.product_images ?? [];
      const images = [...rawImages].sort((a: any, b: any) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.display_order - b.display_order;
      });
      return {
        id:           item.id,
        product_name: item.product_variants?.products?.name ?? "—",
        variant_size: item.product_variants?.size            ?? "—",
        variant_id:   item.product_variants?.id              ?? "",
        product_id:   item.product_variants?.products?.id    ?? "",
        quantity:     item.quantity,
        sale_price:   item.sale_price,
        image_url:    images[0]?.image_url ?? "",
      };
    });

    const itemsTotal = items.reduce(
      (sum, i) => sum + i.sale_price * i.quantity, 0
    );
    const totalPaid = (o.payments ?? []).reduce(
      (sum: number, p: any) => sum + p.amount, 0
    );

    return {
      id:              o.id,
      sold_at:         o.sold_at,
      guest_name:      o.guest_name      ?? null,
      guest_phone:     o.guest_phone     ?? null,
      shipping_method: o.shipping_method ?? "personal_grecia",
      shipping_cost:   o.shipping_cost   ?? 0,
      delivery_status: o.delivery_status ?? "validating",
      tracking_number: o.tracking_number ?? null,
      status:          o.status,
      note:            o.note            ?? null,
      items,
      items_total: itemsTotal,
      order_total: itemsTotal + (o.shipping_cost ?? 0),
      total_paid:  totalPaid,
    };
  });
}

// ── Update order (admin) ───────────────────────────────────────────────────

export async function updateOrderAdmin(
  orderId:         string,
  delivery_status: DeliveryStatus,
  tracking_number: string | null,
  note:            string | null,
  prevStatus?:     string,
): Promise<void> {
  const isCancelling = delivery_status === "cancelled";
  const wasApartada  = prevStatus === "apartada";

  const orderUpdate: Record<string, unknown> = { delivery_status, tracking_number, note };
  if (isCancelling) orderUpdate.status = "cancelled";

  const { error } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  if (isCancelling) {
    const { data: items } = await supabase
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", orderId);

    for (const item of (items ?? [])) {
      if (wasApartada) {
        await supabase
          .from("product_variants")
          .update({ is_reserved: false })
          .eq("id", (item as any).variant_id);
      }
      await supabase.rpc("increment_variant_stock", {
        p_variant_id: (item as any).variant_id,
        p_amount:     (item as any).quantity,
      });
    }

    const { data: pmts } = await supabase
      .from("payments")
      .select("amount")
      .eq("order_id", orderId);

    const totalPaid = (pmts ?? []).reduce((s: number, p: any) => s + p.amount, 0);

    if (totalPaid > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("refunds").insert({
        order_id:   orderId,
        sale_id:    null,
        amount:     totalPaid,
        reason:     note?.trim() || "Cancelación de pedido",
        created_by: user?.id ?? null,
      });
    }
    return;
  }

  // Handle variant reservation
  if (delivery_status === "apartada") {
    const { data: items } = await supabase
      .from("order_items").select("variant_id").eq("order_id", orderId);
    for (const item of (items ?? [])) {
      await supabase.from("product_variants")
        .update({ is_reserved: true }).eq("id", (item as any).variant_id);
    }
  } else if (wasApartada) {
    // Moving away from apartada to any other status → release reservation
    const { data: items } = await supabase
      .from("order_items").select("variant_id").eq("order_id", orderId);
    for (const item of (items ?? [])) {
      await supabase.from("product_variants")
        .update({ is_reserved: false }).eq("id", (item as any).variant_id);
    }
  }
}

// ── Add payment to order ───────────────────────────────────────────────────

export async function addOrderPayment(
  orderId:    string,
  orderTotal: number,
  amount:     number,
  note:       string | null,
): Promise<void> {
  const { error: payError } = await supabase.from("payments").insert({
    order_id: orderId,
    sale_id:  null,
    amount,
    note,
  });
  if (payError) throw new Error(payError.message);

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId);

  const totalPaid = (payments ?? []).reduce(
    (sum: number, p: any) => sum + p.amount, 0
  );

  const { data: orderData } = await supabase
    .from("orders")
    .select("delivery_status, guest_phone, guest_name")
    .eq("id", orderId)
    .single();

  if (totalPaid >= orderTotal) {
    const isApartada = orderData?.delivery_status === "apartada";
    const updates: Record<string, unknown> = { status: "completed" };
    if (isApartada) updates.delivery_status = "confirmed";

    await supabase.from("orders").update(updates).eq("id", orderId);

    if (isApartada) {
      const { data: items } = await supabase
        .from("order_items").select("variant_id").eq("order_id", orderId);
      for (const item of (items ?? [])) {
        await supabase.from("product_variants")
          .update({ is_reserved: false }).eq("id", (item as any).variant_id);
      }
    }
  }

  if (orderData?.guest_phone) {
    const remaining = Math.max(0, orderTotal - totalPaid);
    sendTransactionalEmail({
      type: "payment_receipt",
      data: {
        guest_phone: orderData.guest_phone,
        guest_name:  orderData.guest_name ?? null,
        amount_paid: amount,
        total_owed:  orderTotal,
        remaining,
        note,
      },
    });
  }
}

export async function updateSaleAdmin(
  saleId:          string,
  delivery_status: DeliveryStatus,
  tracking_number: string | null,
  note:            string | null,
  prevStatus?:     string,
  variantId?:      string,
  quantity?:       number
): Promise<void> {
  const isCancelling = delivery_status === "cancelled";
  const wasApartada  = prevStatus === "apartada";

  // Mark sale status as "cancelled" when delivery_status is cancelled
  const saleUpdate: Record<string, unknown> = { delivery_status, tracking_number, note };
  if (isCancelling) saleUpdate.status = "cancelled";

  const { error } = await supabase
    .from("sales")
    .update(saleUpdate)
    .eq("id", saleId);
  if (error) throw new Error(error.message);

  // ── Cancellation side-effects ──────────────────────────────────────────
  if (isCancelling) {
    // 1. Always restore stock
    if (variantId) {
      if (wasApartada) {
        await supabase
          .from("product_variants")
          .update({ is_reserved: false })
          .eq("id", variantId);
      }
      await supabase.rpc("increment_variant_stock", {
        p_variant_id: variantId,
        p_amount:     quantity ?? 1,
      });
    }

    // 2. If payments were made, create a refund entry for the total paid
    const { data: pmts } = await supabase
      .from("payments")
      .select("amount")
      .eq("sale_id", saleId);

    const totalPaid = (pmts ?? []).reduce((s: number, p: any) => s + p.amount, 0);

    if (totalPaid > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("refunds").insert({
        sale_id:    saleId,
        amount:     totalPaid,
        reason:     note?.trim() || "Cancelación de venta",
        created_by: user?.id ?? null,
      });
    }
    return;
  }

  // ── Non-cancellation variant side-effects ──────────────────────────────
  if (!variantId) return;

  if (delivery_status === "apartada") {
    const { error: reserveErr } = await supabase
      .from("product_variants")
      .update({ is_reserved: true })
      .eq("id", variantId);
    if (reserveErr) throw new Error(reserveErr.message);
  } else if (wasApartada) {
    // Moving away from apartada to any other status → release reservation
    const { error: clearErr } = await supabase
      .from("product_variants")
      .update({ is_reserved: false })
      .eq("id", variantId);
    if (clearErr) throw new Error(clearErr.message);
  }
}
