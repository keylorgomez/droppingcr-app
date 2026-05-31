import { supabase } from "../lib/supabaseClient";
import { sendTransactionalEmail } from "../lib/emailService";
import { DELIVERY_STATUS, SALE_STATUS, SHIPPING_METHOD } from "../constants/domain";
import {
  triggerNewOrderEmail,
  type DeliveryStatus, type ShippingMethod,
} from "./salesService";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrderItemInput {
  product_id: string;
  variant_id: string;
  quantity:   number;
  sale_price: number;
}

export interface OrderInput {
  items:           OrderItemInput[];
  guest_name:      string | null;
  guest_phone:     string | null;
  status:          "completed" | "pending";
  initial_payment: number;
  shipping_method: ShippingMethod;
  shipping_cost:   number;
  delivery_status: DeliveryStatus;
  tracking_number: string | null;
  note:            string | null;
}

export interface AdminOrderItem {
  id:           string;
  product_name: string;
  variant_size: string;
  variant_id:   string;
  product_id:   string;
  quantity:     number;
  sale_price:   number;
  image_url:    string;
}

export interface AdminOrder {
  id:              string;
  sold_at:         string;
  guest_name:      string | null;
  guest_phone:     string | null;
  shipping_method: string;
  shipping_cost:   number;
  delivery_status: string;
  tracking_number: string | null;
  status:          "pending" | "completed" | "cancelled";
  note:            string | null;
  items:           AdminOrderItem[];
  items_total:     number;
  order_total:     number;
  total_paid:      number;
}

// ── Raw Supabase row types (internal) ────────────────────────────────────

interface RawOrderImage {
  image_url:     string;
  is_primary:    boolean;
  display_order: number;
}

interface RawOrderRow {
  id:              string;
  sold_at:         string;
  guest_name:      string | null;
  guest_phone:     string | null;
  shipping_method: string | null;
  shipping_cost:   number | null;
  delivery_status: string | null;
  tracking_number: string | null;
  status:          string;
  note:            string | null;
  order_items: Array<{
    id:         string;
    sale_price: number;
    quantity:   number;
    product_variants: {
      id:       string;
      size:     string;
      products: {
        id:             string;
        name:           string;
        product_images: RawOrderImage[];
      } | null;
    } | null;
  }>;
  payments: Array<{ amount: number }>;
}

interface RawOrderItemVariant {
  variant_id: string;
  quantity:   number;
}

interface RawOrderItemVariantId {
  variant_id: string;
}

// ── Record multi-item order ────────────────────────────────────────────────

export async function recordManualOrder(data: OrderInput): Promise<void> {
  const costPrices = new Map<string, number>();
  for (const item of data.items) {
    if (!costPrices.has(item.product_id)) {
      const { data: product, error } = await supabase
        .from("products")
        .select("price_purchase")
        .eq("id", item.product_id)
        .single();
      if (error) throw new Error(error.message);
      costPrices.set(item.product_id, product.price_purchase);
    }
  }

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

  for (const item of data.items) {
    const { error: stockError } = await supabase.rpc("decrement_variant_stock", {
      p_variant_id: item.variant_id,
      p_amount:     item.quantity,
    });
    if (stockError) throw new Error(stockError.message);

    if (data.delivery_status === DELIVERY_STATUS.APARTADA) {
      const { error: reserveErr } = await supabase
        .from("product_variants")
        .update({ is_reserved: true })
        .eq("id", item.variant_id);
      if (reserveErr) throw new Error(reserveErr.message);
    }
  }

  if (data.initial_payment > 0) {
    const { error: payError } = await supabase.from("payments").insert({
      order_id: orderId,
      sale_id:  null,
      amount:   data.initial_payment,
      note:     data.status === SALE_STATUS.PENDING ? "Abono inicial" : "Pago completo",
    });
    if (payError) throw new Error(payError.message);
  }

  triggerNewOrderEmail(
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

// ── Get all orders (admin) ─────────────────────────────────────────────────

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

  return (data as unknown as RawOrderRow[]).map((orderRow) => {
    const items: AdminOrderItem[] = (orderRow.order_items ?? []).map((item) => {
      const rawImages = item.product_variants?.products?.product_images ?? [];
      const images    = [...rawImages].sort((imgA, imgB) => {
        if (imgA.is_primary !== imgB.is_primary) return imgA.is_primary ? -1 : 1;
        return imgA.display_order - imgB.display_order;
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
      (total, item) => total + item.sale_price * item.quantity, 0
    );
    const totalPaid = (orderRow.payments ?? []).reduce(
      (total, payment) => total + payment.amount, 0
    );

    return {
      id:              orderRow.id,
      sold_at:         orderRow.sold_at,
      guest_name:      orderRow.guest_name      ?? null,
      guest_phone:     orderRow.guest_phone     ?? null,
      shipping_method: orderRow.shipping_method ?? SHIPPING_METHOD.PERSONAL_GRECIA,
      shipping_cost:   orderRow.shipping_cost   ?? 0,
      delivery_status: orderRow.delivery_status ?? DELIVERY_STATUS.VALIDATING,
      tracking_number: orderRow.tracking_number ?? null,
      status:          orderRow.status          as AdminOrder["status"],
      note:            orderRow.note            ?? null,
      items,
      items_total:     itemsTotal,
      order_total:     itemsTotal + (orderRow.shipping_cost ?? 0),
      total_paid:      totalPaid,
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
  const isCancelling = delivery_status === DELIVERY_STATUS.CANCELLED;
  const wasApartada  = prevStatus === DELIVERY_STATUS.APARTADA;

  const orderUpdate: Record<string, unknown> = { delivery_status, tracking_number, note };
  if (isCancelling) orderUpdate.status = SALE_STATUS.CANCELLED;

  const { error } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  if (isCancelling) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", orderId);

    for (const item of (orderItems ?? []) as RawOrderItemVariant[]) {
      if (wasApartada) {
        await supabase
          .from("product_variants")
          .update({ is_reserved: false })
          .eq("id", item.variant_id);
      }
      await supabase.rpc("increment_variant_stock", {
        p_variant_id: item.variant_id,
        p_amount:     item.quantity,
      });
    }

    const { data: paymentRows } = await supabase
      .from("payments")
      .select("amount")
      .eq("order_id", orderId);

    const totalPaid = (paymentRows ?? []).reduce(
      (total, payment: { amount: number }) => total + payment.amount, 0
    );

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

  if (delivery_status === DELIVERY_STATUS.APARTADA) {
    const { data: orderItems } = await supabase
      .from("order_items").select("variant_id").eq("order_id", orderId);
    for (const item of (orderItems ?? []) as RawOrderItemVariantId[]) {
      await supabase.from("product_variants")
        .update({ is_reserved: true }).eq("id", item.variant_id);
    }
  } else if (wasApartada) {
    const { data: orderItems } = await supabase
      .from("order_items").select("variant_id").eq("order_id", orderId);
    for (const item of (orderItems ?? []) as RawOrderItemVariantId[]) {
      await supabase.from("product_variants")
        .update({ is_reserved: false }).eq("id", item.variant_id);
    }
  }
}

// ── Add payment to an order ────────────────────────────────────────────────

export async function addOrderPayment(
  orderId:    string,
  orderTotal: number,
  amount:     number,
  note:       string | null,
  skipEmail = false,
): Promise<void> {
  const { error: payError } = await supabase.from("payments").insert({
    order_id: orderId,
    sale_id:  null,
    amount,
    note,
  });
  if (payError) throw new Error(payError.message);

  const { data: paymentRows } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", orderId);

  const totalPaid = (paymentRows ?? []).reduce(
    (total, payment: { amount: number }) => total + payment.amount, 0
  );

  const { data: orderData } = await supabase
    .from("orders")
    .select("delivery_status, guest_phone, guest_name")
    .eq("id", orderId)
    .single();

  if (totalPaid >= orderTotal) {
    const isApartada = orderData?.delivery_status === DELIVERY_STATUS.APARTADA;
    const updates: Record<string, unknown> = { status: SALE_STATUS.COMPLETED };
    if (isApartada) updates.delivery_status = DELIVERY_STATUS.CONFIRMED;

    await supabase.from("orders").update(updates).eq("id", orderId);

    if (isApartada) {
      const { data: orderItems } = await supabase
        .from("order_items").select("variant_id").eq("order_id", orderId);
      for (const item of (orderItems ?? []) as RawOrderItemVariantId[]) {
        await supabase.from("product_variants")
          .update({ is_reserved: false }).eq("id", item.variant_id);
      }
    }
  }

  if (!skipEmail && orderData?.guest_phone) {
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
