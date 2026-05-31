import { supabase } from "../lib/supabaseClient";
import { sendTransactionalEmail } from "../lib/emailService";
import {
  DELIVERY_STATUS, SALE_STATUS, SHIPPING_METHOD,
} from "../constants/domain";

// ── Shipping & Delivery UI arrays ──────────────────────────────────────────

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
  return SHIPPING_OPTIONS.find((option) => option.value === method)?.cost ?? 0;
}

export function deliveryStatusMeta(value: string) {
  return (
    DELIVERY_STATUSES.find((statusEntry) => statusEntry.value === value) ??
    DELIVERY_STATUSES[0]
  );
}

// ── Raw Supabase row types (internal) ─────────────────────────────────────

interface RawProductImage { image_url: string; is_primary: boolean; display_order: number; }

interface RawPendingSaleRow {
  id:              string;
  sale_price:      number;
  shipping_cost:   number | null;
  guest_name:      string | null;
  guest_phone:     string | null;
  note:            string | null;
  sold_at:         string;
  variant_id:      string | null;
  delivery_status: string | null;
  product_variants: { size: string; products: { name: string } | null } | null;
  payments:         Array<{ id: string; amount: number; note: string | null; paid_at: string }>;
}

interface RawUserSaleRow {
  id:              string;
  sale_price:      number;
  shipping_cost:   number | null;
  shipping_method: string | null;
  delivery_status: string | null;
  tracking_number: string | null;
  status:          string;
  sold_at:         string;
  note:            string | null;
  product_variants: {
    size: string;
    products: { name: string; product_images: RawProductImage[] } | null;
  } | null;
  payments: Array<{ amount: number }>;
}

interface RawUserOrderRow {
  id:              string;
  shipping_cost:   number | null;
  shipping_method: string | null;
  delivery_status: string | null;
  tracking_number: string | null;
  status:          string;
  sold_at:         string;
  note:            string | null;
  order_items: Array<{
    sale_price: number;
    quantity:   number;
    product_variants: {
      size: string;
      products: { name: string; product_images: RawProductImage[] } | null;
    } | null;
  }>;
  payments: Array<{ amount: number }>;
}

interface RawAdminSaleRow {
  id:              string;
  sold_at:         string;
  sale_price:      number;
  shipping_cost:   number | null;
  shipping_method: string | null;
  delivery_status: string | null;
  tracking_number: string | null;
  status:          string;
  note:            string | null;
  guest_name:      string | null;
  guest_phone:     string | null;
  variant_id:      string | null;
  quantity:        number | null;
  product_variants: {
    size: string;
    products: { name: string; product_images: RawProductImage[] } | null;
  } | null;
  payments: Array<{ amount: number }>;
}

interface RawRefundRow {
  id:         string;
  sale_id:    string | null;
  amount:     number;
  reason:     string | null;
  created_at: string;
  sales: {
    guest_name:       string | null;
    guest_phone:      string | null;
    product_variants: { size: string; products: { name: string } | null } | null;
  } | null;
}

interface RawSalePaymentLogRow {
  id:      string;
  amount:  number;
  note:    string | null;
  paid_at: string;
  sales: {
    id:              string;
    guest_name:      string | null;
    guest_phone:     string | null;
    sale_price:      number;
    shipping_cost:   number | null;
    delivery_status: string | null;
    product_variants: { size: string; products: { name: string } | null } | null;
  } | null;
}

interface RawOrderPaymentLogRow {
  id:      string;
  amount:  number;
  note:    string | null;
  paid_at: string;
  orders: {
    id:              string;
    guest_name:      string | null;
    guest_phone:     string | null;
    delivery_status: string | null;
    shipping_cost:   number | null;
    order_items:     Array<{ sale_price: number; quantity: number }>;
  } | null;
}

// ── Shared types ───────────────────────────────────────────────────────────

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
  remaining:       number;
  payments:        Payment[];
  isOrder?:        boolean;
  orderItems?:     OrderItemDetail[];
}

export interface ClientDebt {
  key:         string;
  guest_name:  string | null;
  guest_phone: string | null;
  sales:       PendingSale[];
  total_sale:  number;
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

export interface RefundLog {
  id:           string;
  sale_id:      string | null;
  guest_name:   string | null;
  guest_phone:  string | null;
  product_name: string;
  variant_size: string;
  amount:       number;
  reason:       string | null;
  created_at:   string;
}

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

// ── Email helper (shared with ordersService) ───────────────────────────────

export function triggerNewOrderEmail(
  guestPhone:   string | null,
  guestName:    string | null,
  items:        { variant_id: string; quantity: number; sale_price: number }[],
  shippingCost: number,
): void {
  (async () => {
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        const { data: variant } = await supabase
          .from("product_variants")
          .select("size, products(name)")
          .eq("id", item.variant_id)
          .single();
        const product = variant?.products as unknown as { name: string } | null;
        return {
          product_name: product?.name ?? "Producto",
          variant_size: variant?.size ?? "—",
          quantity:     item.quantity,
          sale_price:   item.sale_price,
        };
      }),
    );

    const itemsTotal = resolvedItems.reduce(
      (total, item) => total + item.sale_price * item.quantity, 0
    );

    sendTransactionalEmail({
      type: "new_order",
      data: {
        guest_phone:   guestPhone,
        guest_name:    guestName,
        items:         resolvedItems,
        shipping_cost: shippingCost,
        total:         itemsTotal + shippingCost,
      },
    });
  })().catch(() => {});
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

  if (data.delivery_status === DELIVERY_STATUS.APARTADA) {
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
      note:    data.status === SALE_STATUS.PENDING ? "Abono inicial" : "Pago completo",
    });
    if (payError) throw new Error(payError.message);
  }

  triggerNewOrderEmail(
    data.guest_phone,
    data.guest_name,
    [{ variant_id: data.variant_id, quantity: data.quantity, sale_price: data.sale_price }],
    data.shipping_cost,
  );
}

// ── Update delivery status + tracking ─────────────────────────────────────

export async function updateSaleDelivery(
  saleId:          string,
  delivery_status: DeliveryStatus,
  tracking_number: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("sales")
    .update({ delivery_status, tracking_number })
    .eq("id", saleId);
  if (error) throw new Error(error.message);
}

// ── Get pending sales ──────────────────────────────────────────────────────

export async function getPendingSales(): Promise<PendingSale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id, sale_price, shipping_cost, guest_name, guest_phone, note, sold_at,
      variant_id, delivery_status,
      product_variants ( size, products ( name ) ),
      payments ( id, amount, note, paid_at )
    `)
    .eq("status", SALE_STATUS.PENDING)
    .order("sold_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data as unknown as RawPendingSaleRow[]).map((saleRow) => {
    const shippingCost = saleRow.shipping_cost ?? 0;
    const totalOwed    = saleRow.sale_price + shippingCost;
    const totalPaid    = saleRow.payments.reduce(
      (total, payment) => total + payment.amount, 0
    );
    return {
      id:              saleRow.id,
      sale_price:      saleRow.sale_price,
      shipping_cost:   shippingCost,
      guest_name:      saleRow.guest_name   ?? null,
      guest_phone:     saleRow.guest_phone  ?? null,
      note:            saleRow.note         ?? null,
      sold_at:         saleRow.sold_at,
      product_name:    saleRow.product_variants?.products?.name ?? "—",
      variant_size:    saleRow.product_variants?.size            ?? "—",
      variant_id:      saleRow.variant_id                        ?? "",
      delivery_status: saleRow.delivery_status                   ?? DELIVERY_STATUS.VALIDATING,
      total_paid:      totalPaid,
      remaining:       Math.max(0, totalOwed - totalPaid),
      payments:        (saleRow.payments ?? []).sort(
        (paymentA: Payment, paymentB: Payment) =>
          new Date(paymentB.paid_at).getTime() - new Date(paymentA.paid_at).getTime()
      ),
    };
  });
}

// ── Add payment to a single sale ───────────────────────────────────────────

export async function addPayment(
  saleId:    string,
  priceSold: number,
  amount:    number,
  note:      string | null,
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

  const totalPaid = (payments ?? []).reduce(
    (total, payment: { amount: number }) => total + payment.amount, 0
  );

  if (totalPaid >= priceSold) {
    const { data: saleData } = await supabase
      .from("sales")
      .select("delivery_status, variant_id")
      .eq("id", saleId)
      .single();

    const isApartada = saleData?.delivery_status === DELIVERY_STATUS.APARTADA;
    const updates: Record<string, unknown> = { status: SALE_STATUS.COMPLETED };
    if (isApartada) updates.delivery_status = DELIVERY_STATUS.CONFIRMED;

    await supabase.from("sales").update(updates).eq("id", saleId);

    if (isApartada && saleData?.variant_id) {
      await supabase
        .from("product_variants")
        .update({ is_reserved: false })
        .eq("id", saleData.variant_id);
    }
  }
}

// ── Claim orders matching user's WhatsApp ──────────────────────────────────

export async function claimOrders(userId: string, whatsapp: string): Promise<number> {
  const last8 = whatsapp.replace(/\D/g, "").slice(-8);
  if (!last8) return 0;

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

// ── Get orders for logged-in customer ─────────────────────────────────────

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

  const pickPrimaryImage = (images: RawProductImage[]): string => {
    const sorted = [...images].sort((imageA, imageB) => {
      if (imageA.is_primary !== imageB.is_primary) return imageA.is_primary ? -1 : 1;
      return imageA.display_order - imageB.display_order;
    });
    return sorted[0]?.image_url ?? "";
  };

  const singleSales: UserOrder[] = (salesResult.data as unknown as RawUserSaleRow[]).map((saleRow) => {
    const totalPaid = saleRow.payments.reduce(
      (total, payment) => total + payment.amount, 0
    );
    return {
      id:              saleRow.id,
      sale_price:      saleRow.sale_price,
      shipping_cost:   saleRow.shipping_cost  ?? 0,
      shipping_method: saleRow.shipping_method ?? SHIPPING_METHOD.PERSONAL_GRECIA,
      delivery_status: saleRow.delivery_status ?? DELIVERY_STATUS.VALIDATING,
      tracking_number: saleRow.tracking_number ?? null,
      status:          saleRow.status as UserOrder["status"],
      sold_at:         saleRow.sold_at,
      note:            saleRow.note ?? null,
      product_name:    saleRow.product_variants?.products?.name ?? "—",
      variant_size:    saleRow.product_variants?.size ?? "—",
      image_url:       pickPrimaryImage(saleRow.product_variants?.products?.product_images ?? []),
      total_paid:      totalPaid,
    };
  });

  const multiOrders: UserOrder[] = (ordersResult.data as unknown as RawUserOrderRow[]).map((orderRow) => {
    const items      = orderRow.order_items;
    const itemsTotal = items.reduce(
      (total, item) => total + item.sale_price * item.quantity, 0
    );
    const totalPaid  = orderRow.payments.reduce(
      (total, payment) => total + payment.amount, 0
    );
    const firstItem  = items[0];
    const isMulti    = items.length > 1;

    const orderItems: OrderItemDetail[] = items.map((rawItem) => ({
      product_name: rawItem.product_variants?.products?.name ?? "Producto",
      variant_size: rawItem.product_variants?.size ?? "—",
      quantity:     rawItem.quantity,
      sale_price:   rawItem.sale_price,
      image_url:    pickPrimaryImage(rawItem.product_variants?.products?.product_images ?? []),
    }));

    return {
      id:              orderRow.id,
      sale_price:      itemsTotal,
      shipping_cost:   orderRow.shipping_cost  ?? 0,
      shipping_method: orderRow.shipping_method ?? SHIPPING_METHOD.PERSONAL_GRECIA,
      delivery_status: orderRow.delivery_status ?? DELIVERY_STATUS.VALIDATING,
      tracking_number: orderRow.tracking_number ?? null,
      status:          orderRow.status as UserOrder["status"],
      sold_at:         orderRow.sold_at,
      note:            orderRow.note ?? null,
      product_name:    isMulti ? `${items.length} productos` : (firstItem?.product_variants?.products?.name ?? "—"),
      variant_size:    isMulti ? "Varios" : (firstItem?.product_variants?.size ?? "—"),
      image_url:       pickPrimaryImage(firstItem?.product_variants?.products?.product_images ?? []),
      total_paid:      totalPaid,
      isMultiOrder:    true,
      items:           orderItems,
    };
  });

  return [...singleSales, ...multiOrders].sort(
    (orderA, orderB) => new Date(orderB.sold_at).getTime() - new Date(orderA.sold_at).getTime()
  );
}

// ── Admin: all single-item sales ───────────────────────────────────────────

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

  return (data as unknown as RawAdminSaleRow[]).map((saleRow) => {
    const rawImages = saleRow.product_variants?.products?.product_images ?? [];
    const images    = [...rawImages].sort((imageA, imageB) => {
      if (imageA.is_primary !== imageB.is_primary) return imageA.is_primary ? -1 : 1;
      return imageA.display_order - imageB.display_order;
    });
    const totalPaid = saleRow.payments.reduce(
      (total, payment) => total + payment.amount, 0
    );
    return {
      id:              saleRow.id,
      sold_at:         saleRow.sold_at,
      sale_price:      saleRow.sale_price,
      shipping_cost:   saleRow.shipping_cost   ?? 0,
      shipping_method: saleRow.shipping_method ?? SHIPPING_METHOD.PERSONAL_GRECIA,
      delivery_status: saleRow.delivery_status ?? DELIVERY_STATUS.VALIDATING,
      tracking_number: saleRow.tracking_number ?? null,
      status:          saleRow.status as AdminSale["status"],
      note:            saleRow.note            ?? null,
      guest_name:      saleRow.guest_name      ?? null,
      guest_phone:     saleRow.guest_phone     ?? null,
      product_name:    saleRow.product_variants?.products?.name ?? "—",
      variant_size:    saleRow.product_variants?.size           ?? "—",
      variant_id:      saleRow.variant_id                       ?? "",
      quantity:        saleRow.quantity                         ?? 1,
      image_url:       images[0]?.image_url                     ?? "",
      total_paid:      totalPaid,
    };
  });
}

// ── Refund log ─────────────────────────────────────────────────────────────

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

  return (data as unknown as RawRefundRow[]).map((refundRow) => ({
    id:           refundRow.id,
    sale_id:      refundRow.sale_id,
    guest_name:   refundRow.sales?.guest_name  ?? null,
    guest_phone:  refundRow.sales?.guest_phone ?? null,
    product_name: refundRow.sales?.product_variants?.products?.name ?? "—",
    variant_size: refundRow.sales?.product_variants?.size           ?? "—",
    amount:       refundRow.amount,
    reason:       refundRow.reason     ?? null,
    created_at:   refundRow.created_at,
  }));
}

// ── Payment log (sales + orders merged) ───────────────────────────────────

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

  const saleLogs: PaymentLog[] = (salesPmtsResult.data as unknown as RawSalePaymentLogRow[]).map((paymentRow) => ({
    id:              paymentRow.id,
    amount:          paymentRow.amount,
    note:            paymentRow.note               ?? null,
    paid_at:         paymentRow.paid_at,
    sale_id:         paymentRow.sales?.id          ?? "",
    guest_name:      paymentRow.sales?.guest_name  ?? null,
    guest_phone:     paymentRow.sales?.guest_phone ?? null,
    product_name:    paymentRow.sales?.product_variants?.products?.name ?? "—",
    variant_size:    paymentRow.sales?.product_variants?.size           ?? "—",
    delivery_status: paymentRow.sales?.delivery_status                  ?? DELIVERY_STATUS.VALIDATING,
    sale_price:      paymentRow.sales?.sale_price                       ?? 0,
    shipping_cost:   paymentRow.sales?.shipping_cost                    ?? 0,
  }));

  const orderLogs: PaymentLog[] = (orderPmtsResult.data as unknown as RawOrderPaymentLogRow[]).map((paymentRow) => {
    const order      = paymentRow.orders;
    const items      = order?.order_items ?? [];
    const itemsTotal = items.reduce(
      (total, item) => total + item.sale_price * item.quantity, 0
    );
    return {
      id:              paymentRow.id,
      amount:          paymentRow.amount,
      note:            paymentRow.note              ?? null,
      paid_at:         paymentRow.paid_at,
      sale_id:         order?.id                    ?? "",
      guest_name:      order?.guest_name            ?? null,
      guest_phone:     order?.guest_phone           ?? null,
      product_name:    items.length > 1 ? "Pedido multi-producto" : "Pedido",
      variant_size:    "—",
      delivery_status: order?.delivery_status       ?? DELIVERY_STATUS.VALIDATING,
      sale_price:      itemsTotal,
      shipping_cost:   order?.shipping_cost         ?? 0,
    };
  });

  return [...saleLogs, ...orderLogs].sort(
    (paymentA, paymentB) =>
      new Date(paymentB.paid_at).getTime() - new Date(paymentA.paid_at).getTime()
  );
}

// ── Admin: update single sale ──────────────────────────────────────────────

export async function updateSaleAdmin(
  saleId:          string,
  delivery_status: DeliveryStatus,
  tracking_number: string | null,
  note:            string | null,
  prevStatus?:     string,
  variantId?:      string,
  quantity?:       number,
): Promise<void> {
  const isCancelling = delivery_status === DELIVERY_STATUS.CANCELLED;
  const wasApartada  = prevStatus === DELIVERY_STATUS.APARTADA;

  const saleUpdate: Record<string, unknown> = { delivery_status, tracking_number, note };
  if (isCancelling) saleUpdate.status = SALE_STATUS.CANCELLED;

  const { error } = await supabase
    .from("sales")
    .update(saleUpdate)
    .eq("id", saleId);
  if (error) throw new Error(error.message);

  if (isCancelling) {
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

    const { data: paymentRows } = await supabase
      .from("payments")
      .select("amount")
      .eq("sale_id", saleId);

    const totalPaid = (paymentRows ?? []).reduce(
      (total, payment: { amount: number }) => total + payment.amount, 0
    );

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

  if (!variantId) return;

  if (delivery_status === DELIVERY_STATUS.APARTADA) {
    const { error: reserveErr } = await supabase
      .from("product_variants")
      .update({ is_reserved: true })
      .eq("id", variantId);
    if (reserveErr) throw new Error(reserveErr.message);
  } else if (wasApartada) {
    const { error: clearErr } = await supabase
      .from("product_variants")
      .update({ is_reserved: false })
      .eq("id", variantId);
    if (clearErr) throw new Error(clearErr.message);
  }
}
